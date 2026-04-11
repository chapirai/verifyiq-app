import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompanyEntity } from '../../companies/entities/company.entity';
import { BvDocumentStorageService } from '../../companies/services/bv-document-storage.service';
import type { ArelleExtractResult } from './annual-report-arelle.service';
import { AnnualReportArelleService } from './annual-report-arelle.service';
import { AnnualReportNormalizeService } from './annual-report-normalize.service';
import { AnnualReportZipError, AnnualReportZipService } from './annual-report-zip.service';
import { AnnualReportFileEntity } from '../entities/annual-report-file.entity';
import { AnnualReportFileEntryEntity } from '../entities/annual-report-file-entry.entity';
import { AnnualReportParseErrorEntity } from '../entities/annual-report-parse-error.entity';
import { AnnualReportParseRunEntity } from '../entities/annual-report-parse-run.entity';
import { AnnualReportXbrlContextEntity } from '../entities/annual-report-xbrl-context.entity';
import { AnnualReportXbrlDimensionEntity } from '../entities/annual-report-xbrl-dimension.entity';
import { AnnualReportXbrlFactEntity } from '../entities/annual-report-xbrl-fact.entity';
import { AnnualReportXbrlLabelEntity } from '../entities/annual-report-xbrl-label.entity';
import { AnnualReportXbrlUnitEntity } from '../entities/annual-report-xbrl-unit.entity';
import { CompanyAnnualReportHeaderEntity } from '../entities/company-annual-report-header.entity';

function parseIsoDate(s?: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function normalizeOrgNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 10 ? digits : raw.replace(/\s/g, '');
}

@Injectable()
export class AnnualReportPipelineService {
  private readonly logger = new Logger(AnnualReportPipelineService.name);

  constructor(
    @InjectRepository(AnnualReportFileEntity)
    private readonly fileRepo: Repository<AnnualReportFileEntity>,
    @InjectRepository(AnnualReportFileEntryEntity)
    private readonly entryRepo: Repository<AnnualReportFileEntryEntity>,
    @InjectRepository(AnnualReportParseRunEntity)
    private readonly parseRunRepo: Repository<AnnualReportParseRunEntity>,
    @InjectRepository(AnnualReportParseErrorEntity)
    private readonly errRepo: Repository<AnnualReportParseErrorEntity>,
    @InjectRepository(AnnualReportXbrlContextEntity)
    private readonly ctxRepo: Repository<AnnualReportXbrlContextEntity>,
    @InjectRepository(AnnualReportXbrlUnitEntity)
    private readonly unitRepo: Repository<AnnualReportXbrlUnitEntity>,
    @InjectRepository(AnnualReportXbrlFactEntity)
    private readonly factRepo: Repository<AnnualReportXbrlFactEntity>,
    @InjectRepository(AnnualReportXbrlDimensionEntity)
    private readonly dimRepo: Repository<AnnualReportXbrlDimensionEntity>,
    @InjectRepository(AnnualReportXbrlLabelEntity)
    private readonly labelRepo: Repository<AnnualReportXbrlLabelEntity>,
    @InjectRepository(CompanyEntity)
    private readonly companyRepo: Repository<CompanyEntity>,
    @InjectRepository(CompanyAnnualReportHeaderEntity)
    private readonly headerRepo: Repository<CompanyAnnualReportHeaderEntity>,
    private readonly zipService: AnnualReportZipService,
    private readonly arelle: AnnualReportArelleService,
    private readonly normalize: AnnualReportNormalizeService,
    private readonly bvDocs: BvDocumentStorageService,
  ) {}

  async processFileId(
    tenantId: string,
    fileId: string,
    options?: { force?: boolean },
  ): Promise<{ ok: boolean; skipped?: boolean; parseRunId?: string; error?: string }> {
    const force = options?.force === true;

    const file = await this.fileRepo.findOne({ where: { id: fileId, tenantId } });
    if (!file) {
      return { ok: false, error: 'file_not_found' };
    }

    if (!force && file.status === 'normalized') {
      return { ok: true, skipped: true };
    }

    await this.fileRepo.update(
      { id: fileId },
      { status: 'extracting', updatedAt: new Date() },
    );

    let workDir: string | null = null;
    let parseRun: AnnualReportParseRunEntity | null = null;

    try {
      const buffer = await this.loadZipBuffer(file);
      const extracted = await this.zipService.extractSafe(buffer);
      workDir = extracted.workDir;

      await this.entryRepo.delete({ fileId: file.id });
      const entries = extracted.manifest.map(m =>
        this.entryRepo.create({
          fileId: file.id,
          pathInArchive: m.pathInArchive,
          uncompressedSize: String(m.uncompressedSize),
          isDirectory: m.isDirectory,
          contentSha256: m.contentSha256 ?? null,
          isCandidateIxbrl: m.isCandidateIxbrl,
        }),
      );
      if (entries.length) {
        await this.entryRepo.save(entries);
      }

      const ixPath = this.zipService.pickIxbrlPath(extracted.ixbrlCandidates);
      if (!ixPath) {
        throw new AnnualReportZipError('No Inline XBRL / XHTML entry found in archive', 'missing_ixbrl');
      }

      const ixAbs = this.zipService.resolvePath(workDir, ixPath);
      const parserVersion = process.env.AR_PARSER_VERSION ?? '1.0.0';

      parseRun = await this.parseRunRepo.save(
        this.parseRunRepo.create({
          fileId: file.id,
          parserName: 'arelle',
          parserVersion,
          status: 'running',
          sourceIxbrlPath: ixPath,
          rawModelSummary: {},
        }),
      );

      const arelleOut = await this.arelle.extractIxbrl(ixAbs);

      await this.persistRawModel(parseRun.id, arelleOut);

      parseRun.status = 'completed';
      parseRun.completedAt = new Date();
      parseRun.factCount = arelleOut.facts.length;
      parseRun.contextCount = arelleOut.contexts.length;
      parseRun.unitCount = arelleOut.units.length;
      parseRun.rawModelSummary = {
        arelleVersion: arelleOut.arelle_version ?? null,
        labelCount: arelleOut.labels.length,
      };
      await this.parseRunRepo.save(parseRun);

      await this.fileRepo.update(
        { id: file.id },
        { ixbrlEntryPath: ixPath, status: 'extracted', updatedAt: new Date() },
      );

      const savedHeader = await this.normalize.normalizeServingData({
        tenantId: file.tenantId,
        file: await this.fileRepo.findOneOrFail({ where: { id: file.id } }),
        parseRun: await this.parseRunRepo.findOneOrFail({ where: { id: parseRun.id } }),
        sourceFilename: ixPath,
      });

      await this.linkCompanyRecord(file.tenantId, file.id, savedHeader.id);

      await this.fileRepo.update({ id: file.id }, { status: 'normalized', updatedAt: new Date() });

      return { ok: true, parseRunId: String(parseRun.id) };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.warn(`Annual report pipeline failed file=${fileId}: ${message}`);

      if (parseRun) {
        parseRun.status = 'failed';
        parseRun.completedAt = new Date();
        await this.parseRunRepo.save(parseRun);
      }

      await this.errRepo.save(
        this.errRepo.create({
          parseRunId: parseRun?.id ?? null,
          fileId: file.id,
          phase: 'pipeline',
          code: e instanceof AnnualReportZipError ? e.code : 'pipeline_error',
          message,
          detail: { stack: e instanceof Error ? e.stack : undefined },
        }),
      );

      await this.fileRepo.update({ id: file.id }, { status: 'failed', updatedAt: new Date() });
      return { ok: false, error: message };
    } finally {
      if (workDir) {
        await this.zipService.cleanupWorkDir(workDir);
      }
    }
  }

  private async loadZipBuffer(file: AnnualReportFileEntity): Promise<Buffer> {
    if (file.storageBucket && file.storageKey) {
      return this.bvDocs.getObjectBuffer(file.storageBucket, file.storageKey);
    }
    throw new Error('annual_report_file_missing_storage');
  }

  private async persistRawModel(parseRunId: string, data: ArelleExtractResult): Promise<void> {
    const ctxRows = data.contexts.map(c =>
      this.ctxRepo.create({
        parseRunId,
        xbrlContextId: c.xbrl_context_id,
        periodInstant: parseIsoDate(c.period_instant ?? null),
        periodStart: parseIsoDate(c.period_start ?? null),
        periodEnd: parseIsoDate(c.period_end ?? null),
        dimensions: c.dimensions ?? {},
        rawJson: (c.raw_json ?? {}) as Record<string, unknown>,
      }),
    );
    if (ctxRows.length) await this.ctxRepo.save(ctxRows);

    const unitRows = data.units.map(u =>
      this.unitRepo.create({
        parseRunId,
        xbrlUnitId: u.xbrl_unit_id,
        measures: u.measures ?? [],
        rawJson: (u.raw_json ?? {}) as Record<string, unknown>,
      }),
    );
    if (unitRows.length) await this.unitRepo.save(unitRows);

    const chunkSize = 200;
    for (let i = 0; i < data.facts.length; i += chunkSize) {
      const slice = data.facts.slice(i, i + chunkSize);
      const factEntities = slice.map(f =>
        this.factRepo.create({
          parseRunId,
          sequenceIndex: f.sequence_index,
          contextRef: f.context_ref ?? null,
          unitRef: f.unit_ref ?? null,
          conceptQname: f.concept_qname,
          valueText: f.value_text ?? null,
          valueNumeric:
            f.value_numeric != null && !Number.isNaN(f.value_numeric) ? String(f.value_numeric) : null,
          decimals: f.decimals ?? null,
          precisionValue: f.precision_value ?? null,
          isNil: f.is_nil === true,
          footnotes: f.footnotes ?? [],
          rawJson: {
            ...(f.raw_json ?? {}),
            dimensions: f.dimensions ?? undefined,
          },
        }),
      );
      const saved = await this.factRepo.save(factEntities);
      const dimRows: AnnualReportXbrlDimensionEntity[] = [];
      for (let j = 0; j < saved.length; j++) {
        const raw = slice[j];
        const sf = saved[j];
        const dims = raw.dimensions;
        if (dims && typeof dims === 'object') {
          for (const [dimQn, memQn] of Object.entries(dims)) {
            dimRows.push(
              this.dimRepo.create({
                factId: sf.id,
                dimensionQname: dimQn,
                memberQname: memQn,
                rawJson: {},
              }),
            );
          }
        }
      }
      if (dimRows.length) await this.dimRepo.save(dimRows);
    }

    const seen = new Set<string>();
    const labelRows: AnnualReportXbrlLabelEntity[] = [];
    for (const lb of data.labels) {
      const lang = lb.lang ?? 'en';
      const role = lb.label_role ?? 'http://www.xbrl.org/2003/role/label';
      const key = `${lb.concept_qname}|${lang}|${role}`;
      if (seen.has(key)) continue;
      seen.add(key);
      labelRows.push(
        this.labelRepo.create({
          parseRunId,
          conceptQname: lb.concept_qname,
          lang,
          labelRole: role,
          labelText: lb.label_text,
        }),
      );
    }
    if (labelRows.length) {
      await this.labelRepo.save(labelRows);
    }
  }

  private async linkCompanyRecord(tenantId: string, fileId: string, headerId: string): Promise<void> {
    const file = await this.fileRepo.findOne({ where: { id: fileId } });
    const row = await this.headerRepo.findOne({ where: { id: headerId } });
    const org = row?.organisationNumberFiling ?? row?.organisationsnummer ?? file?.organisationsnummer;
    if (!org) return;
    const norm = normalizeOrgNumber(org);
    const company = await this.companyRepo.findOne({
      where: { tenantId, organisationNumber: norm },
    });
    if (!company) return;
    await this.fileRepo.update({ id: fileId }, { companyId: company.id });
    await this.headerRepo.update({ id: headerId }, { companyId: company.id });
  }
}
