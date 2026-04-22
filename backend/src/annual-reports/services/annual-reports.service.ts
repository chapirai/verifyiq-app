import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import Redis from 'ioredis';
import * as Minio from 'minio';
import { Brackets, Repository } from 'typeorm';
import { BvStoredDocumentEntity } from '../../companies/entities/bv-stored-document.entity';
import { CompanyEntity } from '../../companies/entities/company.entity';
import { BvDocumentStorageService } from '../../companies/services/bv-document-storage.service';
import { BolagsverketService } from '../../companies/services/bolagsverket.service';
import {
  ANNUAL_REPORT_PARSE_QUEUE,
  type AnnualReportAutoIngestHvdJobData,
  type AnnualReportBackfillJobData,
  type AnnualReportParseJobData,
  type AnnualReportRebuildServingJobData,
} from '../queues/annual-report-parse.queue';
import { AnnualReportFileEntity } from '../entities/annual-report-file.entity';
import { AnnualReportParseRunEntity } from '../entities/annual-report-parse-run.entity';
import { CompanyAnnualReportAuditorEntity } from '../entities/company-annual-report-auditor.entity';
import { CompanyAnnualReportFinancialEntity } from '../entities/company-annual-report-financial.entity';
import { CompanyAnnualReportHeaderEntity } from '../entities/company-annual-report-header.entity';
import { CANONICAL_FINANCIAL_LABELS } from '../config/canonical-field-labels';
import { statementTypeForCanonicalField } from '../config/canonical-field-statement-type';
import { AnnualReportNormalizeService } from './annual-report-normalize.service';
import {
  AnnualReportWorkspaceReadModelService,
  type AnnualReportWorkspaceReadModel,
} from './annual-report-workspace-read-model.service';
import { AnnualReportApiFinancialRowEntity } from '../entities/annual-report-api-financial-row.entity';

function normalizeOrgNumber(raw: string): string {
  return raw.replace(/\D/g, '') || raw;
}

function bufferLooksLikeZip(buf: Buffer): boolean {
  return (
    buf.length >= 4 &&
    buf[0] === 0x50 &&
    buf[1] === 0x4b &&
    (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07) &&
    (buf[3] === 0x04 || buf[3] === 0x06 || buf[3] === 0x08)
  );
}

@Injectable()
export class AnnualReportsService {
  private readonly logger = new Logger(AnnualReportsService.name);
  private readonly minioClient: Minio.Client;
  private readonly redis: Redis;
  private readonly bucket: string;
  private readonly region: string;
  private redisErrorLoggedAt = 0;

  constructor(
    @InjectRepository(AnnualReportFileEntity)
    private readonly fileRepo: Repository<AnnualReportFileEntity>,
    @InjectRepository(AnnualReportParseRunEntity)
    private readonly parseRunRepo: Repository<AnnualReportParseRunEntity>,
    @InjectRepository(CompanyAnnualReportHeaderEntity)
    private readonly headerRepo: Repository<CompanyAnnualReportHeaderEntity>,
    @InjectRepository(CompanyAnnualReportFinancialEntity)
    private readonly finRepo: Repository<CompanyAnnualReportFinancialEntity>,
    @InjectRepository(CompanyEntity)
    private readonly companyRepo: Repository<CompanyEntity>,
    @InjectRepository(BvStoredDocumentEntity)
    private readonly bvDocRepo: Repository<BvStoredDocumentEntity>,
    @InjectRepository(CompanyAnnualReportAuditorEntity)
    private readonly audRepo: Repository<CompanyAnnualReportAuditorEntity>,
    @InjectRepository(AnnualReportApiFinancialRowEntity)
    private readonly apiFinancialRepo: Repository<AnnualReportApiFinancialRowEntity>,
    private readonly bvDocs: BvDocumentStorageService,
    private readonly bolagsverket: BolagsverketService,
    private readonly normalize: AnnualReportNormalizeService,
    private readonly workspaceReadModel: AnnualReportWorkspaceReadModelService,
    private readonly config: ConfigService,
    @InjectQueue(ANNUAL_REPORT_PARSE_QUEUE)
    private readonly parseQueue: Queue<
      | AnnualReportParseJobData
      | AnnualReportBackfillJobData
      | AnnualReportRebuildServingJobData
      | AnnualReportAutoIngestHvdJobData
    >,
  ) {
    this.bucket = this.config.get<string>('S3_BUCKET', 'verifyiq-documents');
    this.region = this.config.get<string>('MINIO_REGION', 'eu-west-1');
    this.minioClient = new Minio.Client({
      endPoint: this.config.get<string>('MINIO_ENDPOINT', 'localhost'),
      port: this.config.get<number>('MINIO_PORT', 9000),
      useSSL: this.config.get<string>('MINIO_USE_SSL', 'false').toLowerCase() === 'true',
      accessKey: this.config.get<string>('AWS_ACCESS_KEY_ID', 'minioadmin'),
      secretKey: this.config.get<string>('AWS_SECRET_ACCESS_KEY', 'minioadmin'),
    });
    this.redis = new Redis({
      host: this.config.getOrThrow<string>('REDIS_HOST'),
      port: this.config.getOrThrow<number>('REDIS_PORT'),
      password: this.config.get<string>('REDIS_PASSWORD') || undefined,
      lazyConnect: true,
      maxRetriesPerRequest: 2,
    });
    this.redis.on('error', (err: unknown) => {
      const now = Date.now();
      if (now - this.redisErrorLoggedAt > 60_000) {
        this.redisErrorLoggedAt = now;
        this.logger.warn(`AnnualReports Redis issue (lock fallback): ${err instanceof Error ? err.message : String(err)}`);
      }
    });
  }

  private async ensureRedisConnected(): Promise<boolean> {
    if (this.redis.status !== 'ready' && this.redis.status !== 'connect') {
      try {
        await this.redis.connect();
      } catch {
        return false;
      }
    }
    return true;
  }

  private staleThresholdMs(): number {
    const days = Number(this.config.get<string>('AR_FINANCIAL_STALE_DAYS') ?? '31');
    return Math.max(1, days) * 24 * 60 * 60 * 1000;
  }

  async getApiFinancialTableWithFreshness(
    tenantId: string,
    organisationNumber: string,
  ): Promise<{
    status: 'fresh' | 'stale_rebuild_started' | 'processing';
    rows: AnnualReportApiFinancialRowEntity[];
    stale: boolean;
    lastUpdatedAt: string | null;
  }> {
    const org = normalizeOrgNumber(organisationNumber);
    const rows = await this.getApiFinancialTable(tenantId, org, { ensureBuilt: false });
    const threshold = this.staleThresholdMs();
    const latest = rows.reduce<Date | null>((acc, r) => {
      if (!acc) return r.updatedAt;
      return r.updatedAt > acc ? r.updatedAt : acc;
    }, null);
    const stale = !latest || Date.now() - latest.getTime() > threshold;

    if (!rows.length) {
      await this.triggerAsyncRebuildForOrg(tenantId, org);
      return {
        status: 'processing',
        rows: [],
        stale: true,
        lastUpdatedAt: null,
      };
    }

    if (stale) {
      await this.triggerAsyncRebuildForOrg(tenantId, org);
      return {
        status: 'stale_rebuild_started',
        rows,
        stale: true,
        lastUpdatedAt: latest ? latest.toISOString() : null,
      };
    }

    return {
      status: 'fresh',
      rows,
      stale: false,
      lastUpdatedAt: latest ? latest.toISOString() : null,
    };
  }

  private async triggerAsyncRebuildForOrg(tenantId: string, organisationNumber: string): Promise<void> {
    const redisReady = await this.ensureRedisConnected();
    const org = normalizeOrgNumber(organisationNumber);
    if (!redisReady) {
      // If Redis is unavailable, run rebuild without lock to keep API responsive on constrained tiers.
      void this.rebuildApiFinancialTableForOrg(tenantId, org).catch(e =>
        this.logger.warn(`Async financial rebuild failed org=${org}: ${e instanceof Error ? e.message : e}`),
      );
      return;
    }
    const lockKey = `lock:financial-rebuild:${tenantId}:${org}`;
    const locked = await this.redis.set(lockKey, '1', 'EX', 20 * 60, 'NX');
    if (locked !== 'OK') return;
    void this.rebuildApiFinancialTableForOrg(tenantId, org)
      .catch(e => this.logger.warn(`Async financial rebuild failed org=${org}: ${e instanceof Error ? e.message : e}`))
      .finally(async () => {
        try {
          await this.redis.del(lockKey);
        } catch {
          // ignore
        }
      });
  }

  /**
   * Idempotent registration by (tenant_id, content_sha256). Uploads bytes to object storage when new.
   */
  async registerZipBuffer(params: {
    tenantId: string;
    buffer: Buffer;
    originalFilename: string;
    contentType?: string;
    organisationsnummer?: string;
    companyId?: string;
    bvStoredDocumentId?: string;
  }): Promise<{ file: AnnualReportFileEntity; created: boolean }> {
    const {
      tenantId,
      buffer,
      originalFilename,
      contentType = 'application/zip',
      organisationsnummer,
      companyId,
      bvStoredDocumentId,
    } = params;

    const contentSha256 = createHash('sha256').update(buffer).digest('hex');
    const existing = await this.fileRepo.findOne({
      where: { tenantId, contentSha256 },
    });
    if (existing) {
      return { file: existing, created: false };
    }

    const storageKey = `annual-reports/${tenantId}/${contentSha256}.zip`;
    await this.ensureBucket();
    await this.minioClient.putObject(this.bucket, storageKey, buffer, buffer.length, {
      'Content-Type': contentType,
    });

    let resolvedCompanyId = companyId ?? null;
    let org = organisationsnummer ? normalizeOrgNumber(organisationsnummer) : null;
    if (!resolvedCompanyId && org) {
      const co = await this.companyRepo.findOne({ where: { tenantId, organisationNumber: org } });
      resolvedCompanyId = co?.id ?? null;
    }

    const file = await this.fileRepo.save(
      this.fileRepo.create({
        tenantId,
        companyId: resolvedCompanyId,
        organisationsnummer: org,
        bvStoredDocumentId: bvStoredDocumentId ?? null,
        originalFilename,
        contentType,
        contentSha256,
        sizeBytes: String(buffer.length),
        storageBucket: this.bucket,
        storageKey,
        status: 'pending',
        metadata: {},
      }),
    );
    return { file, created: true };
  }

  async registerFromBvStoredDocument(
    tenantId: string,
    bvDocumentId: string,
  ): Promise<{ file: AnnualReportFileEntity; created: boolean }> {
    const doc = await this.bvDocRepo.findOne({ where: { id: bvDocumentId, tenantId } });
    if (!doc) {
      throw new NotFoundException('bolagsverket_stored_document_not_found');
    }
    const buffer = await this.bvDocs.getObjectBuffer(doc.storageBucket, doc.storageKey);
    const sha = doc.checksumSha256 ?? createHash('sha256').update(buffer).digest('hex');
    const existing = await this.fileRepo.findOne({ where: { tenantId, contentSha256: sha } });
    if (existing) {
      if (!existing.bvStoredDocumentId) {
        await this.fileRepo.update({ id: existing.id }, { bvStoredDocumentId: doc.id });
      }
      return { file: await this.fileRepo.findOneOrFail({ where: { id: existing.id } }), created: false };
    }

    return this.registerZipBuffer({
      tenantId,
      buffer,
      originalFilename: doc.fileName,
      contentType: doc.contentType ?? (bufferLooksLikeZip(buffer) ? 'application/zip' : 'application/octet-stream'),
      organisationsnummer: normalizeOrgNumber(doc.organisationsnummer),
      companyId: doc.organisationId ?? undefined,
      bvStoredDocumentId: doc.id,
    });
  }

  async enqueueParse(tenantId: string, fileId: string, force?: boolean): Promise<{ jobId: string }> {
    const payload: AnnualReportParseJobData = { tenantId, annualReportFileId: fileId, force };
    const jobId = force ? `ar-parse-${fileId}-${Date.now()}` : `ar-parse-${fileId}`;
    await this.parseQueue.add('parse', payload, {
      jobId,
      attempts: 5,
      backoff: { type: 'exponential', delay: 10_000 },
      removeOnComplete: { count: 200 },
      removeOnFail: { count: 50 },
    });
    return { jobId };
  }

  async enqueueBackfill(tenantId: string, limit = 50): Promise<{ jobId: string }> {
    const payload: AnnualReportBackfillJobData = { tenantId, limit };
    const jobId = `ar-backfill-${tenantId}-${Date.now()}`;
    await this.parseQueue.add('backfill', payload, {
      jobId,
      attempts: 1,
      removeOnComplete: { count: 50 },
    });
    return { jobId };
  }

  async enqueueRebuildServing(tenantId: string, fileId: string): Promise<{ jobId: string }> {
    const payload: AnnualReportRebuildServingJobData = { tenantId, annualReportFileId: fileId };
    const jobId = `ar-rebuild-${fileId}-${Date.now()}`;
    await this.parseQueue.add('rebuild-serving', payload, {
      jobId,
      attempts: 2,
    });
    return { jobId };
  }

  /**
   * Download HVD dokument (server-side), persist to bolagsverket_stored_documents, register annual_report_files, queue Arelle parse.
   * Required because browser-only downloads never hit MinIO or the pipeline.
   */
  async ingestHvdDokument(
    tenantId: string,
    identitetsbeteckning: string,
    dokumentId: string,
  ): Promise<{
    bvStoredDocumentId: string;
    annualReportFileId: string;
    jobId: string;
    createdAnnualFile: boolean;
    storedNewBytes: boolean;
  }> {
    const id = dokumentId?.trim();
    if (!id) {
      throw new BadRequestException('dokumentId is required');
    }
    const org = normalizeOrgNumber(identitetsbeteckning);
    if (org.length < 10) {
      throw new BadRequestException('identitetsbeteckning must yield at least 10 digits');
    }

    const download = await this.bolagsverket.getDocument(id, { tenantId });
    if (!bufferLooksLikeZip(download.data)) {
      throw new BadRequestException(
        'Bolagsverket dokument is not a ZIP archive (expected årsredovisningspaket).',
      );
    }

    const company = await this.companyRepo.findOne({ where: { tenantId, organisationNumber: org } });
    const stored = await this.bvDocs.storeDocument({
      tenantId,
      organisationsnummer: org,
      organisationId: company?.id,
      documentIdSource: id,
      documentType: 'hvd_arsredovisning',
      fileBuffer: download.data,
      contentType: download.contentType || 'application/zip',
      upstreamFileName: download.fileName,
    });

    if (stored.downloadStatus === 'failed') {
      throw new BadRequestException(stored.errorMessage ?? 'Failed to store document in object storage');
    }
    if (stored.downloadStatus === 'skipped' && !stored.storageKey) {
      throw new BadRequestException('Document was not stored (no buffer path)');
    }

    const { file, created } = await this.registerFromBvStoredDocument(tenantId, stored.id);
    const { jobId } = await this.enqueueParse(tenantId, file.id, false);

    return {
      bvStoredDocumentId: stored.id,
      annualReportFileId: file.id,
      jobId,
      createdAnnualFile: created,
      storedNewBytes: stored.downloadStatus === 'downloaded' && !stored.isDuplicate,
    };
  }

  /**
   * Worker: sequential HVD ZIP ingest (rate-friendly). Non-ZIP or API errors are logged per dokument.
   */
  async runAutoIngestHvdDocumentsWorker(data: AnnualReportAutoIngestHvdJobData): Promise<{
    dokumentCount: number;
    results: Array<{ dokumentId: string; ok: boolean; error?: string }>;
  }> {
    const delayMs = Math.max(0, Number(process.env.AR_HVD_INGEST_DELAY_MS ?? 400));
    const results: Array<{ dokumentId: string; ok: boolean; error?: string }> = [];
    for (const dokumentId of data.dokumentIds) {
      try {
        await this.ingestHvdDokument(data.tenantId, data.organisationNumber, dokumentId);
        results.push({ dokumentId, ok: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`auto-ingest HVD ${dokumentId}: ${msg}`);
        results.push({ dokumentId, ok: false, error: msg });
      }
      if (delayMs > 0) {
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
    return { dokumentCount: data.dokumentIds.length, results };
  }

  async getLatestHeader(
    tenantId: string,
    organisationNumber: string,
  ): Promise<CompanyAnnualReportHeaderEntity | null> {
    const org = normalizeOrgNumber(organisationNumber);
    return this.headerRepo
      .createQueryBuilder('h')
      .where('h.tenantId = :tenantId', { tenantId })
      .andWhere('h.isSuperseded = :sup', { sup: false })
      .andWhere(
        new Brackets(qb => {
          qb.where('h.organisationsnummer = :org', { org }).orWhere(
            "regexp_replace(coalesce(h.organisationNumberFiling, ''), '[^0-9]', '', 'g') = :org",
            { org },
          );
        }),
      )
      .orderBy('h.extractedAt', 'DESC')
      .getOne();
  }

  async getHistory(
    tenantId: string,
    organisationNumber: string,
    limit = 200,
  ): Promise<CompanyAnnualReportHeaderEntity[]> {
    const org = normalizeOrgNumber(organisationNumber);
    const cap = Math.min(500, Math.max(1, limit));
    return this.headerRepo
      .createQueryBuilder('h')
      .where('h.tenantId = :tenantId', { tenantId })
      .andWhere('h.isSuperseded = :sup', { sup: false })
      .andWhere(
        new Brackets(qb => {
          qb.where('h.organisationsnummer = :org', { org }).orWhere(
            "regexp_replace(coalesce(h.organisationNumberFiling, ''), '[^0-9]', '', 'g') = :org",
            { org },
          );
        }),
      )
      .orderBy('h.filingPeriodEnd IS NULL', 'ASC')
      .addOrderBy('h.filingPeriodEnd', 'DESC')
      .addOrderBy('h.extractedAt', 'DESC')
      .take(cap)
      .getMany();
  }

  /**
   * Up to `maxYears` distinct fiscal years (by filing_period_end), pivoted financial lines for year-over-year comparison.
   */
  async getFinancialComparisonForOrg(
    tenantId: string,
    organisationNumber: string,
    maxYears = 30,
  ): Promise<{
    organisationNumber: string;
    years: number[];
    columns: Array<{
      year: number;
      headerId: string;
      filingPeriodEnd: string | null;
      companyName: string | null;
      currencyCode: string | null;
      auditorFirm: string | null;
      factCount: number;
    }>;
    rows: Array<{
      canonicalField: string;
      label: string;
      byYear: Record<string, string | null>;
    }>;
  }> {
    const org = normalizeOrgNumber(organisationNumber);
    const candidateCap = Math.min(500, Math.max(maxYears * 4, 80));
    const candidates = await this.headerRepo
      .createQueryBuilder('h')
      .where('h.tenantId = :tenantId', { tenantId })
      .andWhere('h.isSuperseded = :sup', { sup: false })
      .andWhere('h.filingPeriodEnd IS NOT NULL')
      .andWhere(
        new Brackets(qb => {
          qb.where('h.organisationsnummer = :org', { org }).orWhere(
            "regexp_replace(coalesce(h.organisationNumberFiling, ''), '[^0-9]', '', 'g') = :org",
            { org },
          );
        }),
      )
      .orderBy('h.filingPeriodEnd', 'DESC')
      .addOrderBy('h.extractedAt', 'DESC')
      .take(candidateCap)
      .getMany();

    const picked: CompanyAnnualReportHeaderEntity[] = [];
    const seenYears = new Set<number>();
    for (const h of candidates) {
      if (!h.filingPeriodEnd) continue;
      const y = h.filingPeriodEnd.getUTCFullYear();
      if (seenYears.has(y)) continue;
      seenYears.add(y);
      picked.push(h);
      if (picked.length >= maxYears) break;
    }

    picked.sort((a, b) => {
      const ya = a.filingPeriodEnd!.getUTCFullYear();
      const yb = b.filingPeriodEnd!.getUTCFullYear();
      return ya - yb;
    });

    const years = picked.map(h => h.filingPeriodEnd!.getUTCFullYear());
    const finByHeader = new Map<string, CompanyAnnualReportFinancialEntity[]>();
    const allFields = new Set<string>();

    for (const h of picked) {
      const fins = await this.finRepo.find({ where: { headerId: h.id } });
      finByHeader.set(h.id, fins);
      for (const f of fins) {
        if (f.periodKind === 'current' || f.periodKind === 'instant' || f.periodKind === 'prior') {
          allFields.add(f.canonicalField);
        }
      }
    }

    const rows = [...allFields].sort().map(field => {
      const byYear: Record<string, string | null> = {};
      for (const h of picked) {
        const y = String(h.filingPeriodEnd!.getUTCFullYear());
        const fins = finByHeader.get(h.id) ?? [];
        const hit =
          fins.find(
            x => x.canonicalField === field && (x.periodKind === 'current' || x.periodKind === 'instant'),
          ) ??
          fins.find(x => x.canonicalField === field && x.periodKind === 'prior');
        byYear[y] = hit?.valueNumeric != null ? String(hit.valueNumeric) : hit?.valueText ?? null;
      }
      return {
        canonicalField: field,
        label: CANONICAL_FINANCIAL_LABELS[field] ?? field,
        byYear,
      };
    });

    const columns: Array<{
      year: number;
      headerId: string;
      filingPeriodEnd: string | null;
      companyName: string | null;
      currencyCode: string | null;
      auditorFirm: string | null;
      factCount: number;
    }> = [];

    for (const h of picked) {
      const run = await this.parseRunRepo.findOne({ where: { id: h.parseRunId } });
      const aud = await this.audRepo.findOne({ where: { headerId: h.id } });
      columns.push({
        year: h.filingPeriodEnd!.getUTCFullYear(),
        headerId: h.id,
        filingPeriodEnd: h.filingPeriodEnd!.toISOString().slice(0, 10),
        companyName: h.companyNameFromFiling ?? null,
        currencyCode: h.currencyCode ?? null,
        auditorFirm: aud?.auditorFirm ?? aud?.auditorName ?? null,
        factCount: run?.factCount ?? 0,
      });
    }

    return { organisationNumber: org, years, columns, rows };
  }

  async getFinancialsForOrg(
    tenantId: string,
    organisationNumber: string,
  ): Promise<{ header: CompanyAnnualReportHeaderEntity; financials: CompanyAnnualReportFinancialEntity[] } | null> {
    const header = await this.getLatestHeader(tenantId, organisationNumber);
    if (!header) return null;
    const financials = await this.finRepo.find({ where: { headerId: header.id } });
    return { header, financials };
  }

  async getWorkspaceReadModel(
    tenantId: string,
    organisationNumber: string,
  ): Promise<AnnualReportWorkspaceReadModel> {
    const org = normalizeOrgNumber(organisationNumber);
    const header = await this.getLatestHeader(tenantId, org);
    return this.workspaceReadModel.buildFromHeader(tenantId, org, header);
  }

  async getApiFinancialTable(
    tenantId: string,
    organisationNumber: string,
    opts?: { ensureBuilt?: boolean },
  ) {
    const org = normalizeOrgNumber(organisationNumber);
    const readRows = async () =>
      this.apiFinancialRepo.find({
      where: { tenantId, organisationsnummer: org },
      order: {
        fiscalYear: 'DESC',
        statementType: 'ASC',
        valueCode: 'ASC',
        periodKind: 'ASC',
      },
    });
    let rows = await readRows();
    if (opts?.ensureBuilt !== false && rows.length === 0) {
      await this.rebuildApiFinancialTableForOrg(tenantId, org);
      rows = await readRows();
    }
    return rows;
  }

  async rebuildApiFinancialTableForOrg(
    tenantId: string,
    organisationNumber: string,
  ): Promise<{ rowsInserted: number; headersProcessed: number }> {
    const org = normalizeOrgNumber(organisationNumber);
    const headers = await this.headerRepo
      .createQueryBuilder('h')
      .where('h.tenantId = :tenantId', { tenantId })
      .andWhere('h.isSuperseded = :sup', { sup: false })
      .andWhere(
        new Brackets(qb => {
          qb.where('h.organisationsnummer = :org', { org }).orWhere(
            "regexp_replace(coalesce(h.organisationNumberFiling, ''), '[^0-9]', '', 'g') = :org",
            { org },
          );
        }),
      )
      .orderBy('h.extractedAt', 'DESC')
      .getMany();

    await this.apiFinancialRepo.delete({ tenantId, organisationsnummer: org });

    let rowsInserted = 0;
    for (const h of headers) {
      const fins = await this.finRepo.find({ where: { headerId: h.id } });
      if (!fins.length) continue;
      const fiscalYear = h.fiscalYear ?? h.filingPeriodEnd?.getUTCFullYear() ?? null;
      const rows = fins.map(fin =>
        this.apiFinancialRepo.create({
          tenantId,
          organisationsnummer: org,
          fiscalYear,
          statementType: statementTypeForCanonicalField(fin.canonicalField),
          valueCode: fin.canonicalField,
          valueLabel: CANONICAL_FINANCIAL_LABELS[fin.canonicalField] ?? fin.canonicalField,
          periodKind: fin.periodKind,
          valueNumeric: fin.valueNumeric ?? null,
          valueText: fin.valueText ?? null,
          currencyCode: fin.currencyCode ?? h.currencyCode ?? null,
          sourceHeaderId: h.id,
          sourceImportId: h.annualReportImportId ?? null,
          sourceFactIds: fin.sourceFactIds ?? [],
          rankingScore: fin.rankingScore ?? 0,
        }),
      );
      await this.apiFinancialRepo.save(rows);
      rowsInserted += rows.length;
    }
    return { rowsInserted, headersProcessed: headers.length };
  }

  async getFileMeta(tenantId: string, fileId: string) {
    const file = await this.fileRepo.findOne({ where: { id: fileId, tenantId } });
    if (!file) throw new NotFoundException('annual_report_file_not_found');
    const runs = await this.parseRunRepo.find({
      where: { fileId },
      order: { startedAt: 'DESC' },
      take: 10,
    });
    return { file, parseRuns: runs };
  }

  async getFileDetail(tenantId: string, fileId: string) {
    const meta = await this.getFileMeta(tenantId, fileId);
    const header = await this.headerRepo.findOne({
      where: { annualReportFileId: fileId, isSuperseded: false },
      order: { extractedAt: 'DESC' },
    });
    let factCount = 0;
    if (header) {
      const run = await this.parseRunRepo.findOne({ where: { id: header.parseRunId } });
      factCount = run?.factCount ?? 0;
    }
    return { ...meta, activeHeader: header, factCount };
  }

  async runBackfillWorker(data: AnnualReportBackfillJobData): Promise<{ processed: number; errors: number }> {
    const limit = data.limit ?? 50;
    const docs = await this.bvDocRepo.find({
      where: { tenantId: data.tenantId, downloadStatus: 'downloaded' },
      order: { createdAt: 'DESC' },
      take: limit * 3,
    });

    let processed = 0;
    let errors = 0;
    for (const doc of docs) {
      const name = doc.fileName.toLowerCase();
      const ct = (doc.contentType ?? '').toLowerCase();
      const isZipCandidate = name.endsWith('.zip') || ct.includes('zip') || ct.includes('x-zip');
      if (!isZipCandidate) continue;
      try {
        const { file, created } = await this.registerFromBvStoredDocument(data.tenantId, doc.id);
        if (created || file.status === 'pending' || file.status === 'failed') {
          await this.enqueueParse(data.tenantId, file.id, false);
        }
        processed++;
        if (processed >= limit) break;
      } catch (e) {
        this.logger.warn(`Backfill skip doc ${doc.id}: ${e instanceof Error ? e.message : e}`);
        errors++;
      }
    }
    return { processed, errors };
  }

  async runRebuildServingWorker(data: AnnualReportRebuildServingJobData): Promise<{ ok: boolean }> {
    const file = await this.fileRepo.findOne({
      where: { id: data.annualReportFileId, tenantId: data.tenantId },
    });
    if (!file) return { ok: false };
    await this.normalize.rebuildServingForFile(file);
    await this.fileRepo.update({ id: file.id }, { status: 'normalized', updatedAt: new Date() });
    return { ok: true };
  }

  private async ensureBucket(): Promise<void> {
    try {
      const exists = await this.minioClient.bucketExists(this.bucket);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucket, this.region);
      }
    } catch (e) {
      this.logger.warn(`MinIO bucket check failed: ${e}`);
    }
  }
}
