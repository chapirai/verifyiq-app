import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnnualReportMappedValueEntity } from '../entities/annual-report-mapped-value.entity';
import { AnnualReportSummaryEntity } from '../entities/annual-report-summary.entity';
import { CompanyAnnualReportFinancialEntity } from '../entities/company-annual-report-financial.entity';
import { CompanyAnnualReportAuditorEntity } from '../entities/company-annual-report-auditor.entity';
import { CompanyAnnualReportHeaderEntity } from '../entities/company-annual-report-header.entity';
import { CANONICAL_FINANCIAL_LABELS } from '../config/canonical-field-labels';
import { statementTypeForCanonicalField } from '../config/canonical-field-statement-type';
import { AnnualReportApiFinancialRowEntity } from '../entities/annual-report-api-financial-row.entity';

/** Canonical field → summary entity field (current period only). */
const SUMMARY_FIELD: Record<string, keyof AnnualReportSummaryEntity> = {
  revenue: 'revenue',
  net_profit: 'netProfit',
  operating_profit: 'operatingProfit',
  total_assets: 'totalAssets',
  equity: 'equity',
  cash_and_equivalents: 'cashAndBank',
  employee_count: 'employeeCount',
};

@Injectable()
export class AnnualReportMappedSummaryService {
  constructor(
    @InjectRepository(AnnualReportMappedValueEntity)
    private readonly mappedRepo: Repository<AnnualReportMappedValueEntity>,
    @InjectRepository(AnnualReportSummaryEntity)
    private readonly summaryRepo: Repository<AnnualReportSummaryEntity>,
    @InjectRepository(AnnualReportApiFinancialRowEntity)
    private readonly apiFinancialRepo: Repository<AnnualReportApiFinancialRowEntity>,
    @InjectRepository(CompanyAnnualReportHeaderEntity)
    private readonly headerRepo: Repository<CompanyAnnualReportHeaderEntity>,
  ) {}

  async rebuildMappedAndSummary(params: {
    annualReportImportId: string;
    tenantId: string;
    orgNumber: string | null;
    fiscalYear: number | null;
    documentTypeForFinancial: string;
    headerId: string;
    primaryParseRunId: string | null;
    primarySourceFileId: string | null;
  }): Promise<void> {
    const {
      annualReportImportId,
      orgNumber,
      fiscalYear,
      documentTypeForFinancial,
      headerId,
      primaryParseRunId,
      primarySourceFileId,
    } = params;

    await this.mappedRepo.delete({ annualReportImportId });

    const header = await this.headerRepo.findOne({ where: { id: headerId } });
    const resolvedOrg =
      orgNumber ??
      header?.organisationsnummer ??
      header?.organisationNumberFiling ??
      null;
    const resolvedFiscalYear =
      fiscalYear ?? header?.fiscalYear ?? header?.filingPeriodEnd?.getUTCFullYear() ?? null;

    const financials = await this.mappedRepo.manager.find(CompanyAnnualReportFinancialEntity, {
      where: { headerId },
    });

    if (resolvedOrg) {
      await this.apiFinancialRepo.delete({
        tenantId: params.tenantId,
        organisationsnummer: resolvedOrg,
        sourceHeaderId: headerId,
      });
      const apiRows = financials.map(fin =>
        this.apiFinancialRepo.create({
          tenantId: params.tenantId,
          organisationsnummer: resolvedOrg,
          fiscalYear: resolvedFiscalYear,
          statementType: statementTypeForCanonicalField(fin.canonicalField),
          valueCode: fin.canonicalField,
          valueLabel: CANONICAL_FINANCIAL_LABELS[fin.canonicalField] ?? fin.canonicalField,
          periodKind: fin.periodKind,
          valueNumeric: fin.valueNumeric,
          valueText: fin.valueText,
          currencyCode: fin.currencyCode ?? null,
          sourceHeaderId: headerId,
          sourceImportId: annualReportImportId,
          sourceFactIds: fin.sourceFactIds ?? [],
          rankingScore: fin.rankingScore ?? 0,
        }),
      );
      if (apiRows.length) {
        await this.apiFinancialRepo.save(apiRows);
      }
    }

    const rows: Partial<AnnualReportMappedValueEntity>[] = [];
    for (const fin of financials) {
      const st = statementTypeForCanonicalField(fin.canonicalField);
      const factId = fin.sourceFactIds?.[0] ?? null;
      rows.push({
        annualReportImportId,
        sourceFileId: primarySourceFileId,
        parseRunId: primaryParseRunId,
        factId,
        orgNumber: resolvedOrg,
        fiscalYear: resolvedFiscalYear,
        documentType: documentTypeForFinancial,
        statementType: st,
        valueCode: fin.canonicalField,
        valueLabel: CANONICAL_FINANCIAL_LABELS[fin.canonicalField] ?? fin.canonicalField,
        valueText: fin.valueText,
        valueNumeric: fin.valueNumeric,
        currency: fin.currencyCode,
        priorityRank: fin.rankingScore ?? 0,
        mappingRule: `canonical_xbrl:${fin.canonicalField}`,
        mappingConfidence: null,
      });
    }

    const auditor = await this.mappedRepo.manager.findOne(CompanyAnnualReportAuditorEntity, {
      where: { headerId },
    });
    if (auditor) {
      if (auditor.auditorName) {
        rows.push({
          annualReportImportId,
          parseRunId: primaryParseRunId,
          factId: auditor.sourceFactIds?.[0] ?? null,
          orgNumber: resolvedOrg,
          fiscalYear: resolvedFiscalYear,
          documentType: 'audit_report',
          statementType: 'audit',
          valueCode: 'auditor_name',
          valueLabel: 'Auditor name',
          valueText: auditor.auditorName,
          priorityRank: 100,
          mappingRule: 'auditor_field',
        });
      }
      if (auditor.auditorFirm) {
        rows.push({
          annualReportImportId,
          parseRunId: primaryParseRunId,
          factId: auditor.sourceFactIds?.[1] ?? auditor.sourceFactIds?.[0] ?? null,
          orgNumber: resolvedOrg,
          fiscalYear: resolvedFiscalYear,
          documentType: 'audit_report',
          statementType: 'audit',
          valueCode: 'auditor_firm',
          valueLabel: 'Audit firm',
          valueText: auditor.auditorFirm,
          priorityRank: 100,
          mappingRule: 'auditor_field',
        });
      }
      if (auditor.auditOpinionHint) {
        rows.push({
          annualReportImportId,
          parseRunId: primaryParseRunId,
          orgNumber: resolvedOrg,
          fiscalYear: resolvedFiscalYear,
          documentType: 'audit_report',
          statementType: 'audit',
          valueCode: 'audit_opinion',
          valueLabel: 'Audit opinion',
          valueText: auditor.auditOpinionHint,
          priorityRank: 100,
          mappingRule: 'auditor_field',
        });
      }
    }

    if (rows.length) {
      await this.mappedRepo.save(rows.map(r => this.mappedRepo.create(r)));
    }

    let summary = await this.summaryRepo.findOne({ where: { annualReportImportId } });
    if (!summary) {
      summary = this.summaryRepo.create({ annualReportImportId });
    }
    summary.orgNumber = resolvedOrg;
    summary.fiscalYear = resolvedFiscalYear;
    summary.periodStart = header?.filingPeriodStart ?? summary.periodStart ?? null;
    summary.periodEnd = header?.filingPeriodEnd ?? summary.periodEnd ?? null;
    summary.currency = header?.currencyCode ?? summary.currency ?? null;
    for (const fin of financials) {
      const col = SUMMARY_FIELD[fin.canonicalField];
      if (!col || fin.periodKind !== 'current') continue;
      (summary as unknown as Record<string, string | null | undefined>)[col] = fin.valueNumeric;
    }
    if (auditor) {
      summary.auditorName = auditor.auditorName ?? null;
      summary.auditOpinion = auditor.auditOpinionHint ?? null;
    }
    await this.summaryRepo.save(summary);
  }
}
