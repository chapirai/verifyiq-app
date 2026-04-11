import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import * as Minio from 'minio';
import { Repository } from 'typeorm';
import { BvStoredDocumentEntity } from '../../companies/entities/bv-stored-document.entity';
import { CompanyEntity } from '../../companies/entities/company.entity';
import { BvDocumentStorageService } from '../../companies/services/bv-document-storage.service';
import {
  ANNUAL_REPORT_PARSE_QUEUE,
  type AnnualReportBackfillJobData,
  type AnnualReportParseJobData,
  type AnnualReportRebuildServingJobData,
} from '../queues/annual-report-parse.queue';
import { AnnualReportFileEntity } from '../entities/annual-report-file.entity';
import { AnnualReportParseRunEntity } from '../entities/annual-report-parse-run.entity';
import { CompanyAnnualReportFinancialEntity } from '../entities/company-annual-report-financial.entity';
import { CompanyAnnualReportHeaderEntity } from '../entities/company-annual-report-header.entity';
import { AnnualReportNormalizeService } from './annual-report-normalize.service';

function normalizeOrgNumber(raw: string): string {
  return raw.replace(/\D/g, '') || raw;
}

@Injectable()
export class AnnualReportsService {
  private readonly logger = new Logger(AnnualReportsService.name);
  private readonly minioClient: Minio.Client;
  private readonly bucket: string;
  private readonly region: string;

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
    private readonly bvDocs: BvDocumentStorageService,
    private readonly normalize: AnnualReportNormalizeService,
    private readonly config: ConfigService,
    @InjectQueue(ANNUAL_REPORT_PARSE_QUEUE)
    private readonly parseQueue: Queue<
      AnnualReportParseJobData | AnnualReportBackfillJobData | AnnualReportRebuildServingJobData
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
    let org = organisationsnummer ?? null;
    if (!resolvedCompanyId && org) {
      const norm = normalizeOrgNumber(org);
      const co = await this.companyRepo.findOne({ where: { tenantId, organisationNumber: norm } });
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
      contentType: doc.contentType ?? 'application/zip',
      organisationsnummer: doc.organisationsnummer,
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

  async getLatestHeader(
    tenantId: string,
    organisationNumber: string,
  ): Promise<CompanyAnnualReportHeaderEntity | null> {
    const org = normalizeOrgNumber(organisationNumber);
    return this.headerRepo.findOne({
      where: { tenantId, organisationsnummer: org, isSuperseded: false },
      order: { extractedAt: 'DESC' },
    });
  }

  async getHistory(tenantId: string, organisationNumber: string): Promise<CompanyAnnualReportHeaderEntity[]> {
    const org = normalizeOrgNumber(organisationNumber);
    return this.headerRepo.find({
      where: { tenantId, organisationsnummer: org, isSuperseded: false },
      order: { extractedAt: 'DESC' },
      take: 50,
    });
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
      if (!name.endsWith('.zip')) continue;
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
