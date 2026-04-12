import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CANONICAL_FINANCIAL_LABELS } from '../config/canonical-field-labels';
import { statementTypeForCanonicalField } from '../config/canonical-field-statement-type';
import { AnnualReportImportEntity } from '../entities/annual-report-import.entity';
import { AnnualReportMappedValueEntity } from '../entities/annual-report-mapped-value.entity';
import { AnnualReportSourceFileEntity } from '../entities/annual-report-source-file.entity';
import { AnnualReportSummaryEntity } from '../entities/annual-report-summary.entity';
import { AnnualReportXbrlFactEntity } from '../entities/annual-report-xbrl-fact.entity';
import { AnnualReportParseRunEntity } from '../entities/annual-report-parse-run.entity';
import { CompanyAnnualReportAuditorEntity } from '../entities/company-annual-report-auditor.entity';
import { CompanyAnnualReportFinancialEntity } from '../entities/company-annual-report-financial.entity';
import { CompanyAnnualReportHeaderEntity } from '../entities/company-annual-report-header.entity';

const RAW_FACT_CAP_PER_BUCKET = 2000;

export type AnnualReportWorkspaceMappedRow = {
  id: string;
  valueCode: string;
  valueLabel: string | null;
  valueText: string | null;
  valueNumeric: string | null;
  documentType: string;
  statementType: string | null;
  factId: string | null;
  sourceFileId: string | null;
  priorityRank: number;
};

export type AnnualReportWorkspaceStatementRow = {
  code: string;
  label: string;
  current: string | null;
  prior: string | null;
};

export type AnnualReportWorkspaceReadModel = {
  organisationNumber: string;
  importId: string | null;
  orgNumber: string | null;
  fiscalYear: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  headerId: string | null;
  annualReportFileId: string | null;
  extractedAt: string | null;
  currency: string | null;
  importRecord: {
    id: string;
    importStatus: string;
    primaryContextId: string | null;
    importedAt: string | null;
    updatedAt: string | null;
    errorMessage: string | null;
  } | null;
  sourceFiles: Array<{
    id: string;
    documentType: string;
    originalFilename: string | null;
    pathInArchive: string;
    parseStatus: string;
    fiscalYear: number | null;
  }>;
  summary: Record<string, string | number | null> | null;
  mappedValues: {
    incomeStatement: AnnualReportWorkspaceMappedRow[];
    balanceSheet: AnnualReportWorkspaceMappedRow[];
    cashFlow: AnnualReportWorkspaceMappedRow[];
    equity: AnnualReportWorkspaceMappedRow[];
    notes: AnnualReportWorkspaceMappedRow[];
    audit: AnnualReportWorkspaceMappedRow[];
    metadata: AnnualReportWorkspaceMappedRow[];
    other: AnnualReportWorkspaceMappedRow[];
  };
  statementTables: {
    incomeStatement: AnnualReportWorkspaceStatementRow[];
    balanceSheet: AnnualReportWorkspaceStatementRow[];
    cashFlow: AnnualReportWorkspaceStatementRow[];
    equity: AnnualReportWorkspaceStatementRow[];
    other: AnnualReportWorkspaceStatementRow[];
  };
  rawFacts: {
    annualReport: Array<{
      id: string;
      conceptQname: string;
      contextRef: string | null;
      valueText: string | null;
      valueNumeric: string | null;
      documentType: string | null;
      parseRunId: string;
    }>;
    auditReport: Array<{
      id: string;
      conceptQname: string;
      contextRef: string | null;
      valueText: string | null;
      valueNumeric: string | null;
      documentType: string | null;
      parseRunId: string;
    }>;
  };
  rawFactTotals: { annualReport: number; auditReport: number };
  workspaceView: {
    overviewCards: { label: string; value: string }[];
    auditPanel: {
      auditorName: string | null;
      auditorFirm: string | null;
      auditOpinion: string | null;
    };
    sourceAttribution: Record<
      string,
      { documentType: string | null; factId: string | null; valueCode: string }
    >;
  };
};

function isoDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function isoDateTime(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString();
}

@Injectable()
export class AnnualReportWorkspaceReadModelService {
  constructor(
    @InjectRepository(AnnualReportImportEntity)
    private readonly importRepo: Repository<AnnualReportImportEntity>,
    @InjectRepository(AnnualReportSourceFileEntity)
    private readonly sourceFileRepo: Repository<AnnualReportSourceFileEntity>,
    @InjectRepository(AnnualReportMappedValueEntity)
    private readonly mappedRepo: Repository<AnnualReportMappedValueEntity>,
    @InjectRepository(AnnualReportSummaryEntity)
    private readonly summaryRepo: Repository<AnnualReportSummaryEntity>,
    @InjectRepository(AnnualReportXbrlFactEntity)
    private readonly factRepo: Repository<AnnualReportXbrlFactEntity>,
    @InjectRepository(AnnualReportParseRunEntity)
    private readonly parseRunRepo: Repository<AnnualReportParseRunEntity>,
    @InjectRepository(CompanyAnnualReportFinancialEntity)
    private readonly finRepo: Repository<CompanyAnnualReportFinancialEntity>,
    @InjectRepository(CompanyAnnualReportAuditorEntity)
    private readonly audRepo: Repository<CompanyAnnualReportAuditorEntity>,
  ) {}

  async buildFromHeader(
    tenantId: string,
    organisationNumber: string,
    header: CompanyAnnualReportHeaderEntity | null,
  ): Promise<AnnualReportWorkspaceReadModel> {
    const empty: AnnualReportWorkspaceReadModel = {
      organisationNumber,
      importId: null,
      orgNumber: null,
      fiscalYear: null,
      periodStart: null,
      periodEnd: null,
      headerId: null,
      annualReportFileId: null,
      extractedAt: null,
      currency: null,
      importRecord: null,
      sourceFiles: [],
      summary: null,
      mappedValues: {
        incomeStatement: [],
        balanceSheet: [],
        cashFlow: [],
        equity: [],
        notes: [],
        audit: [],
        metadata: [],
        other: [],
      },
      statementTables: {
        incomeStatement: [],
        balanceSheet: [],
        cashFlow: [],
        equity: [],
        other: [],
      },
      rawFacts: { annualReport: [], auditReport: [] },
      rawFactTotals: { annualReport: 0, auditReport: 0 },
      workspaceView: {
        overviewCards: [],
        auditPanel: { auditorName: null, auditorFirm: null, auditOpinion: null },
        sourceAttribution: {},
      },
    };

    if (!header || header.tenantId !== tenantId) {
      return empty;
    }

    const financials = await this.finRepo.find({ where: { headerId: header.id } });
    const auditor = await this.audRepo.findOne({ where: { headerId: header.id } });
    const importId = header.annualReportImportId ?? null;

    const importRow = importId
      ? await this.importRepo.findOne({ where: { id: importId, tenantId } })
      : null;

    const sourceFiles = importId
      ? await this.sourceFileRepo.find({
          where: { annualReportImportId: importId },
          order: { createdAt: 'ASC' },
        })
      : [];

    const summaryRow = importId
      ? await this.summaryRepo.findOne({ where: { annualReportImportId: importId } })
      : null;

    const mappedRows = importId
      ? await this.mappedRepo.find({
          where: { annualReportImportId: importId },
          order: { priorityRank: 'DESC', valueCode: 'ASC' },
        })
      : [];

    const mappedValues = this.partitionMappedValues(mappedRows);
    const statementTables = this.buildStatementTablesFromFinancials(financials);

    let rawAnnual: AnnualReportXbrlFactEntity[] = [];
    let rawAudit: AnnualReportXbrlFactEntity[] = [];
    let totalAnnual = 0;
    let totalAudit = 0;

    if (importId && importRow) {
      const runs = await this.parseRunRepo.find({
        where: { annualReportImportId: importId, status: 'completed' },
      });
      const runIds = runs.map(r => r.id);
      if (runIds.length) {
        const qb = () =>
          this.factRepo
            .createQueryBuilder('f')
            .where('f.parse_run_id IN (:...ids)', { ids: runIds });

        totalAnnual = await qb()
          .andWhere('(f.document_type IS NULL OR f.document_type <> :aud)', { aud: 'audit_report' })
          .getCount();
        totalAudit = await qb().andWhere('f.document_type = :aud', { aud: 'audit_report' }).getCount();

        rawAnnual = await qb()
          .andWhere('(f.document_type IS NULL OR f.document_type <> :aud)', { aud: 'audit_report' })
          .orderBy('f.sequence_index', 'ASC')
          .take(RAW_FACT_CAP_PER_BUCKET)
          .getMany();
        rawAudit = await qb()
          .andWhere('f.document_type = :aud', { aud: 'audit_report' })
          .orderBy('f.sequence_index', 'ASC')
          .take(RAW_FACT_CAP_PER_BUCKET)
          .getMany();
      }
    } else {
      const runId = header.parseRunId;
      const qb = () =>
        this.factRepo.createQueryBuilder('f').where('f.parse_run_id = :runId', { runId });
      totalAnnual = await qb()
        .andWhere('(f.document_type IS NULL OR f.document_type <> :aud)', { aud: 'audit_report' })
        .getCount();
      totalAudit = await qb().andWhere('f.document_type = :aud', { aud: 'audit_report' }).getCount();
      rawAnnual = await qb()
        .andWhere('(f.document_type IS NULL OR f.document_type <> :aud)', { aud: 'audit_report' })
        .orderBy('f.sequence_index', 'ASC')
        .take(RAW_FACT_CAP_PER_BUCKET)
        .getMany();
      rawAudit = await qb()
        .andWhere('f.document_type = :aud', { aud: 'audit_report' })
        .orderBy('f.sequence_index', 'ASC')
        .take(RAW_FACT_CAP_PER_BUCKET)
        .getMany();
    }

    const fiscalYear =
      header.fiscalYear ??
      importRow?.fiscalYear ??
      (header.filingPeriodEnd ? header.filingPeriodEnd.getUTCFullYear() : null);

    const orgNumber =
      header.organisationsnummer ??
      header.organisationNumberFiling ??
      importRow?.organisationsnummer ??
      null;

    const summary = summaryRow ? this.serializeSummary(summaryRow) : null;

    const hasAnnualSource = sourceFiles.some(
      f => f.documentType === 'annual_report' && f.parseStatus === 'completed',
    );
    const hasAuditSource = sourceFiles.some(
      f => f.documentType === 'audit_report' && f.parseStatus === 'completed',
    );

    const overviewCards: { label: string; value: string }[] = [
      { label: 'Fiscal year', value: fiscalYear != null ? String(fiscalYear) : '—' },
      {
        label: 'Reporting period',
        value:
          isoDate(header.filingPeriodStart) && isoDate(header.filingPeriodEnd)
            ? `${isoDate(header.filingPeriodStart)} → ${isoDate(header.filingPeriodEnd)}`
            : isoDate(header.filingPeriodEnd) ?? '—',
      },
      {
        label: 'Currency',
        value: String(header.currencyCode ?? summary?.currency ?? '—'),
      },
      {
        label: 'Import status',
        value: importRow?.importStatus ?? (header.id ? 'legacy_header' : '—'),
      },
      {
        label: 'Årsredovisning file',
        value: hasAnnualSource ? 'Found' : importId ? 'Not found or not parsed' : '—',
      },
      {
        label: 'Revisionsberättelse file',
        value: hasAuditSource ? 'Found' : importId ? 'Not found or not parsed' : '—',
      },
      {
        label: 'Last extracted',
        value: isoDateTime(header.extractedAt) ?? '—',
      },
    ];

    const sourceAttribution: AnnualReportWorkspaceReadModel['workspaceView']['sourceAttribution'] =
      {};
    for (const m of mappedRows) {
      if (!m.valueCode) continue;
      sourceAttribution[m.valueCode] = {
        documentType: m.documentType,
        factId: m.factId ?? null,
        valueCode: m.valueCode,
      };
    }

    return {
      organisationNumber,
      importId,
      orgNumber,
      fiscalYear,
      periodStart: isoDate(header.filingPeriodStart ?? importRow?.periodStart),
      periodEnd: isoDate(header.filingPeriodEnd ?? importRow?.periodEnd),
      headerId: header.id,
      annualReportFileId: header.annualReportFileId,
      extractedAt: isoDateTime(header.extractedAt),
      currency: header.currencyCode ?? null,
      importRecord: importRow
        ? {
            id: importRow.id,
            importStatus: importRow.importStatus,
            primaryContextId: importRow.primaryContextId ?? null,
            importedAt: isoDateTime(importRow.importedAt),
            updatedAt: isoDateTime(importRow.updatedAt),
            errorMessage: importRow.errorMessage ?? null,
          }
        : null,
      sourceFiles: sourceFiles.map(s => ({
        id: s.id,
        documentType: s.documentType,
        originalFilename: s.originalFilename ?? null,
        pathInArchive: s.pathInArchive,
        parseStatus: s.parseStatus,
        fiscalYear: s.fiscalYear ?? null,
      })),
      summary,
      mappedValues,
      statementTables,
      rawFacts: {
        annualReport: rawAnnual.map(f => this.toRawFactDto(f)),
        auditReport: rawAudit.map(f => this.toRawFactDto(f)),
      },
      rawFactTotals: { annualReport: totalAnnual, auditReport: totalAudit },
      workspaceView: {
        overviewCards,
        auditPanel: {
          auditorName: auditor?.auditorName ?? summaryRow?.auditorName ?? null,
          auditorFirm: auditor?.auditorFirm ?? null,
          auditOpinion: auditor?.auditOpinionHint ?? summaryRow?.auditOpinion ?? null,
        },
        sourceAttribution,
      },
    };
  }

  private toRawFactDto(f: AnnualReportXbrlFactEntity) {
    return {
      id: f.id,
      conceptQname: f.conceptQname,
      contextRef: f.contextRef ?? null,
      valueText: f.valueText ?? null,
      valueNumeric: f.valueNumeric != null ? String(f.valueNumeric) : null,
      documentType: f.documentType ?? null,
      parseRunId: f.parseRunId,
    };
  }

  private serializeSummary(s: AnnualReportSummaryEntity): Record<string, string | number | null> {
    const dec = (v: string | null | undefined) => (v != null ? String(v) : null);
    return {
      orgNumber: s.orgNumber ?? null,
      fiscalYear: s.fiscalYear ?? null,
      periodStart: isoDate(s.periodStart),
      periodEnd: isoDate(s.periodEnd),
      currency: s.currency ?? null,
      revenue: dec(s.revenue),
      grossProfit: dec(s.grossProfit),
      operatingProfit: dec(s.operatingProfit),
      profitBeforeTax: dec(s.profitBeforeTax),
      netProfit: dec(s.netProfit),
      totalAssets: dec(s.totalAssets),
      fixedAssets: dec(s.fixedAssets),
      currentAssets: dec(s.currentAssets),
      equity: dec(s.equity),
      untaxedReserves: dec(s.untaxedReserves),
      provisions: dec(s.provisions),
      longTermLiabilities: dec(s.longTermLiabilities),
      shortTermLiabilities: dec(s.shortTermLiabilities),
      cashAndBank: dec(s.cashAndBank),
      netSales: dec(s.netSales),
      employeeCount: dec(s.employeeCount),
      auditorName: s.auditorName ?? null,
      auditOpinion: s.auditOpinion ?? null,
    };
  }

  private partitionMappedValues(
    rows: AnnualReportMappedValueEntity[],
  ): AnnualReportWorkspaceReadModel['mappedValues'] {
    const empty = (): AnnualReportWorkspaceMappedRow[] => [];
    const out: AnnualReportWorkspaceReadModel['mappedValues'] = {
      incomeStatement: empty(),
      balanceSheet: empty(),
      cashFlow: empty(),
      equity: empty(),
      notes: empty(),
      audit: empty(),
      metadata: empty(),
      other: empty(),
    };
    const mapRow = (r: AnnualReportMappedValueEntity): AnnualReportWorkspaceMappedRow => ({
      id: r.id,
      valueCode: r.valueCode,
      valueLabel: r.valueLabel ?? null,
      valueText: r.valueText ?? null,
      valueNumeric: r.valueNumeric != null ? String(r.valueNumeric) : null,
      documentType: r.documentType,
      statementType: r.statementType ?? null,
      factId: r.factId ?? null,
      sourceFileId: r.sourceFileId ?? null,
      priorityRank: r.priorityRank,
    });
    for (const r of rows) {
      const st = r.statementType ?? 'other';
      const dto = mapRow(r);
      if (st === 'income_statement') out.incomeStatement.push(dto);
      else if (st === 'balance_sheet') out.balanceSheet.push(dto);
      else if (st === 'cash_flow') out.cashFlow.push(dto);
      else if (st === 'equity') out.equity.push(dto);
      else if (st === 'notes') out.notes.push(dto);
      else if (st === 'audit') out.audit.push(dto);
      else if (st === 'metadata') out.metadata.push(dto);
      else out.other.push(dto);
    }
    return out;
  }

  private buildStatementTablesFromFinancials(
    financials: CompanyAnnualReportFinancialEntity[],
  ): AnnualReportWorkspaceReadModel['statementTables'] {
    type Agg = { label: string; current: string | null; prior: string | null };
    const byCode = new Map<string, Agg>();
    for (const f of financials) {
      const code = f.canonicalField;
      const label = CANONICAL_FINANCIAL_LABELS[code] ?? code;
      const agg = byCode.get(code) ?? { label, current: null, prior: null };
      const val = f.valueNumeric != null ? String(f.valueNumeric) : f.valueText ?? null;
      if (f.periodKind === 'current' || f.periodKind === 'instant') agg.current = val;
      if (f.periodKind === 'prior') agg.prior = val;
      byCode.set(code, agg);
    }

    const buckets: AnnualReportWorkspaceReadModel['statementTables'] = {
      incomeStatement: [],
      balanceSheet: [],
      cashFlow: [],
      equity: [],
      other: [],
    };

    for (const [code, agg] of byCode) {
      const row: AnnualReportWorkspaceStatementRow = {
        code,
        label: agg.label,
        current: agg.current,
        prior: agg.prior,
      };
      const st = statementTypeForCanonicalField(code);
      if (st === 'income_statement') buckets.incomeStatement.push(row);
      else if (st === 'balance_sheet') buckets.balanceSheet.push(row);
      else if (st === 'cash_flow') buckets.cashFlow.push(row);
      else if (st === 'equity') buckets.equity.push(row);
      else buckets.other.push(row);
    }

    const sortByLabel = (a: AnnualReportWorkspaceStatementRow, b: AnnualReportWorkspaceStatementRow) =>
      a.label.localeCompare(b.label, 'sv');
    buckets.incomeStatement.sort(sortByLabel);
    buckets.balanceSheet.sort(sortByLabel);
    buckets.cashFlow.sort(sortByLabel);
    buckets.equity.sort(sortByLabel);
    buckets.other.sort(sortByLabel);
    return buckets;
  }
}
