import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Repository } from 'typeorm';
import { CompanyEntity } from '../../companies/entities/company.entity';
import { BvDocumentStorageService } from '../../companies/services/bv-document-storage.service';
import type { ArelleExtractResult } from './annual-report-arelle.service';
import { AnnualReportArelleService } from './annual-report-arelle.service';
import { AnnualReportMappedSummaryService } from './annual-report-mapped-summary.service';
import { AnnualReportNormalizeService } from './annual-report-normalize.service';
import { AnnualReportSectionExtractorService } from './annual-report-section-extractor.service';
import { AnnualReportXhtmlClassifierService } from './annual-report-xhtml-classifier.service';
import { AnnualReportZipError, AnnualReportZipService } from './annual-report-zip.service';
import { AnnualReportFileEntity } from '../entities/annual-report-file.entity';
import { AnnualReportFileEntryEntity } from '../entities/annual-report-file-entry.entity';
import { AnnualReportImportEntity } from '../entities/annual-report-import.entity';
import { AnnualReportParseErrorEntity } from '../entities/annual-report-parse-error.entity';
import { AnnualReportParseRunEntity } from '../entities/annual-report-parse-run.entity';
import { AnnualReportSectionEntity } from '../entities/annual-report-section.entity';
import type { AnnualReportDocumentType } from '../entities/annual-report-source-file.entity';
import { AnnualReportSourceFileEntity } from '../entities/annual-report-source-file.entity';
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
    @InjectRepository(AnnualReportImportEntity)
    private readonly importRepo: Repository<AnnualReportImportEntity>,
    @InjectRepository(AnnualReportSourceFileEntity)
    private readonly sourceFileRepo: Repository<AnnualReportSourceFileEntity>,
    @InjectRepository(AnnualReportSectionEntity)
    private readonly sectionRepo: Repository<AnnualReportSectionEntity>,
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
    private readonly mappedSummary: AnnualReportMappedSummaryService,
    private readonly bvDocs: BvDocumentStorageService,
    private readonly classifier: AnnualReportXhtmlClassifierService,
    private readonly sectionExtractor: AnnualReportSectionExtractorService,
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

    await this.fileRepo.update({ id: fileId }, { status: 'extracting', updatedAt: new Date() });

    let workDir: string | null = null;
    let importRow: AnnualReportImportEntity | null = null;

    try {
      const buffer = await this.loadZipBuffer(file);
      const extracted = await this.zipService.extractSafe(buffer);
      workDir = extracted.workDir;

      await this.entryRepo.delete({ fileId: file.id });
      const entryEntities = extracted.manifest.map(m =>
        this.entryRepo.create({
          fileId: file.id,
          pathInArchive: m.pathInArchive,
          uncompressedSize: String(m.uncompressedSize),
          isDirectory: m.isDirectory,
          contentSha256: m.contentSha256 ?? null,
          isCandidateIxbrl: m.isCandidateIxbrl,
        }),
      );
      const savedEntries =
        entryEntities.length > 0 ? await this.entryRepo.save(entryEntities) : [];

      importRow = await this.importRepo.save(
        this.importRepo.create({
          tenantId: file.tenantId,
          companyId: file.companyId ?? null,
          organisationsnummer: file.organisationsnummer ?? null,
          annualReportFileId: file.id,
          sourceZipFilename: file.originalFilename,
          sourceZipStorageKey: file.storageKey ?? null,
          importStatus: 'parsing',
          importedAt: new Date(),
          validationFlags: {},
        }),
      );

      const sortedIx = [...extracted.ixbrlCandidates].sort((a, b) => b.score - a.score);
      const parserVersion = process.env.AR_PARSER_VERSION ?? '2.0.0';
      let anySuccess = false;
      let anyFailure = false;
      let lastParseRunId: string | undefined;

      for (let idx = 0; idx < sortedIx.length; idx++) {
        const cand = sortedIx[idx]!;
        const abs = this.zipService.resolvePath(workDir, cand.pathInArchive);
        const xhtml = await fs.readFile(abs, 'utf8');
        let classification = this.classifier.classifyXhtmlDocument(
          { pathInArchive: cand.pathInArchive, originalFilename: path.basename(cand.pathInArchive) },
          xhtml,
        );
        let docType: AnnualReportDocumentType = classification.documentType;
        if (docType === 'unknown' && sortedIx.length === 1) {
          docType = 'annual_report';
          classification = {
            documentType: docType,
            score: classification.score + 2,
            reasons: [...classification.reasons, 'fallback_single_ixbrl_package'],
          };
        }

        const entryRow = savedEntries.find(e => e.pathInArchive === cand.pathInArchive);

        const sourceFile = await this.sourceFileRepo.save(
          this.sourceFileRepo.create({
            annualReportImportId: importRow.id,
            annualReportFileId: file.id,
            fileEntryId: entryRow?.id ?? null,
            documentType: docType,
            originalFilename: path.basename(cand.pathInArchive),
            pathInArchive: cand.pathInArchive,
            mimeType: 'application/xhtml+xml',
            classificationScore: classification.score,
            classificationReasons: classification.reasons,
            parseStatus: docType === 'unknown' ? 'skipped' : 'pending',
          }),
        );

        if (entryRow) {
          await this.entryRepo.update({ id: entryRow.id }, { sourceFileId: sourceFile.id });
        }

        const sections = this.sectionExtractor.extractSections(xhtml);
        if (sections.length) {
          await this.sectionRepo.save(
            sections.map(s =>
              this.sectionRepo.create({
                sourceFileId: sourceFile.id,
                sectionOrder: s.sectionOrder,
                headingText: s.headingText,
                headingLevel: s.headingLevel,
                normalizedHeading: s.normalizedHeading,
                textContent: s.textContent,
              }),
            ),
          );
        }

        if (docType === 'unknown') {
          this.logger.log(
            `Skip Arelle for unknown-classified IXBRL import=${importRow.id} path=${cand.pathInArchive}`,
          );
          continue;
        }

        await this.sourceFileRepo.update({ id: sourceFile.id }, { parseStatus: 'running' });

        const parseRun = await this.parseRunRepo.save(
          this.parseRunRepo.create({
            fileId: file.id,
            annualReportImportId: importRow.id,
            sourceFileId: sourceFile.id,
            documentType: docType,
            parserName: 'arelle',
            parserVersion,
            status: 'running',
            sourceIxbrlPath: cand.pathInArchive,
            rawModelSummary: {},
          }),
        );
        lastParseRunId = parseRun.id;

        try {
          const arelleOut = await this.arelle.extractIxbrl(abs);
          await this.persistRawModel(parseRun.id, arelleOut, {
            sourceFileId: sourceFile.id,
            documentType: docType,
          });

          parseRun.status = 'completed';
          parseRun.completedAt = new Date();
          parseRun.factCount = arelleOut.facts.length;
          parseRun.contextCount = arelleOut.contexts.length;
          parseRun.unitCount = arelleOut.units.length;
          parseRun.rawModelSummary = {
            arelleVersion: arelleOut.arelle_version ?? null,
            labelCount: arelleOut.labels.length,
            documentType: docType,
          };
          await this.parseRunRepo.save(parseRun);
          anySuccess = true;

          await this.sourceFileRepo.update(
            { id: sourceFile.id },
            { parseStatus: 'completed', parseError: null },
          );
        } catch (pe) {
          const msg = pe instanceof Error ? pe.message : String(pe);
          anyFailure = true;
          parseRun.status = 'failed';
          parseRun.completedAt = new Date();
          await this.parseRunRepo.save(parseRun);
          await this.sourceFileRepo.update({ id: sourceFile.id }, { parseStatus: 'failed', parseError: msg });
          await this.errRepo.save(
            this.errRepo.create({
              parseRunId: parseRun.id,
              fileId: file.id,
              phase: 'arelle',
              code: 'parse_error',
              message: msg,
              detail: { path: cand.pathInArchive, documentType: docType },
            }),
          );
          this.logger.warn(`Parse failed for ${cand.pathInArchive}: ${msg}`);
        }
      }

      if (!anySuccess) {
        throw new AnnualReportZipError('No Inline XBRL document could be parsed successfully', 'all_sources_failed');
      }

      await this.fileRepo.update(
        { id: file.id },
        {
          ixbrlEntryPath: sortedIx[0]?.pathInArchive ?? null,
          status: 'extracted',
          updatedAt: new Date(),
        },
      );

      const savedHeader = await this.normalize.normalizeServingFromZipImport({
        tenantId: file.tenantId,
        file,
        importId: importRow.id,
      });

      const primaryAnnual = await this.parseRunRepo
        .createQueryBuilder('r')
        .where('r.annual_report_import_id = :i', { i: importRow.id })
        .andWhere('r.status = :s', { s: 'completed' })
        .andWhere('(r.document_type IS NULL OR r.document_type <> :aud)', { aud: 'audit_report' })
        .orderBy('r.fact_count', 'DESC')
        .addOrderBy('r.started_at', 'DESC')
        .getOne();

      const primarySourceId = primaryAnnual?.sourceFileId ?? savedHeader.primarySourceFileId ?? null;
      const primaryContextId = savedHeader.primaryContextId ?? null;

      await this.importRepo.update(
        { id: importRow.id },
        {
          importStatus: anyFailure ? 'partial' : 'completed',
          periodStart: savedHeader.filingPeriodStart ?? null,
          periodEnd: savedHeader.filingPeriodEnd ?? null,
          fiscalYear: savedHeader.fiscalYear ?? null,
          primarySourceFileId: primarySourceId,
          primaryContextId,
          primaryParseRunId: primaryAnnual?.id ?? null,
          updatedAt: new Date(),
        },
      );

      await this.mappedSummary.rebuildMappedAndSummary({
        annualReportImportId: importRow.id,
        tenantId: file.tenantId,
        orgNumber: savedHeader.organisationsnummer ?? savedHeader.organisationNumberFiling ?? null,
        fiscalYear: savedHeader.fiscalYear ?? null,
        documentTypeForFinancial: 'annual_report',
        headerId: savedHeader.id,
        primaryParseRunId: primaryAnnual?.id ?? null,
        primarySourceFileId: primarySourceId,
      });

      await this.linkCompanyRecord(file.tenantId, file.id, savedHeader.id);
      await this.fileRepo.update({ id: file.id }, { status: 'normalized', updatedAt: new Date() });

      return { ok: true, parseRunId: lastParseRunId };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.warn(`Annual report pipeline failed file=${fileId}: ${message}`);

      if (importRow) {
        await this.importRepo.update(
          { id: importRow.id },
          { importStatus: 'failed', errorMessage: message, updatedAt: new Date() },
        );
      }

      await this.errRepo.save(
        this.errRepo.create({
          parseRunId: null,
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

  private async persistRawModel(
    parseRunId: string,
    data: ArelleExtractResult,
    opts: { sourceFileId: string; documentType: string },
  ): Promise<void> {
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
          sourceFileId: opts.sourceFileId,
          documentType: opts.documentType,
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
