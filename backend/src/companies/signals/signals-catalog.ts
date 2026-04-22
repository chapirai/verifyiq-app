import { CompanyEntity } from '../entities/company.entity';

/** Public catalog — definitions are returned with each computed row for UI transparency. */
export const SIGNAL_CATALOG = [
  {
    type: 'acquisition_likelihood',
    definition:
      'Heuristic likelihood that the entity could be an acquisition target: legal health, dataset richness, and absence of distress flags.',
  },
  {
    type: 'ownership_transition_probability',
    definition:
      'Proxy for governance churn using officer roster size and company status (no predictive model; index-only).',
  },
  {
    type: 'seller_readiness',
    definition:
      'Readiness proxy: active registration, presence of signing / share metadata, and data completeness flags.',
  },
  {
    type: 'growth_vs_stagnation',
    definition:
      'Uses count of stored FI financial report stubs and record freshness — not audited financial performance.',
  },
  {
    type: 'compliance_ownership_complexity',
    definition:
      'Higher when many officers/roles are stored or when status implies structural events (liquidation, etc.).',
  },
  {
    type: 'financial_stress',
    definition:
      'Distress proxy from legal status and absence of financial report metadata on the index row.',
  },
  {
    type: 'board_network_signals',
    definition:
      'Board depth proxy from officer array length (Bolagsverket funktionärer payload on the company row).',
  },
] as const;

export type CatalogSignalType = (typeof SIGNAL_CATALOG)[number]['type'];

export type SignalComputationRow = {
  signalType: CatalogSignalType;
  score: number;
  explanation: Record<string, unknown>;
};

export const SIGNAL_ENGINE_VERSION = '2026.04.1';

export type SignalEvidence = {
  financialStatementsCount: number;
  ownershipLinksCount: number;
  companyCasesCount: number;
  latestRevenue: number | null;
  latestNetResult: number | null;
  latestEquityRatio: number | null;
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function summaryFlags(company: CompanyEntity): { rich: boolean; hvd: boolean } {
  const s = company.sourcePayloadSummary ?? {};
  const rich = String(s['hasRichOrganisationInformation'] ?? '') === 'true';
  const hvd = String(s['hasHighValueDataset'] ?? '') === 'true';
  return { rich, hvd };
}

function statusStress(status: string | null | undefined): number {
  const u = (status ?? '').toUpperCase();
  if (u === 'BANKRUPT') return 90;
  if (u === 'LIQUIDATION') return 70;
  if (u === 'INACTIVE' || u === 'DISSOLVED') return 55;
  return 15;
}

/**
 * Deterministic v0 heuristics from persisted `companies` row only (VerifyIQ index).
 * Replace incrementally as Phase 5 models connect to annual reports / ownership graph.
 */
export function computeAllSignalsForCompany(
  company: CompanyEntity,
  evidence?: Partial<SignalEvidence>,
): SignalComputationRow[] {
  const { rich, hvd } = summaryFlags(company);
  const frLen = Array.isArray(company.financialReports) ? company.financialReports.length : 0;
  const offLen = Array.isArray(company.officers) ? company.officers.length : 0;
  const descLen = (company.businessDescription ?? '').trim().length;
  const active = (company.status ?? '').toUpperCase() === 'ACTIVE';
  const shareKeys = company.shareInformation && typeof company.shareInformation === 'object'
    ? Object.keys(company.shareInformation).length
    : 0;
  const signLen = (company.signatoryText ?? '').trim().length;
  const fsCount = Math.max(0, evidence?.financialStatementsCount ?? 0);
  const olCount = Math.max(0, evidence?.ownershipLinksCount ?? 0);
  const ccCount = Math.max(0, evidence?.companyCasesCount ?? 0);
  const latestRevenue = evidence?.latestRevenue ?? null;
  const latestNetResult = evidence?.latestNetResult ?? null;
  const latestEquityRatio = evidence?.latestEquityRatio ?? null;

  const financialStress = clamp01(
    statusStress(company.status) +
      (frLen === 0 ? 8 : 0) +
      (fsCount === 0 ? 10 : 0) +
      (latestNetResult != null && latestNetResult < 0 ? 12 : 0) +
      (latestEquityRatio != null && latestEquityRatio < 0.2 ? 10 : 0),
  );

  const complianceComplexity = clamp01(
    offLen * 5 +
      olCount * 3 +
      ccCount * 4 +
      (company.status?.toUpperCase() === 'LIQUIDATION' ? 25 : 0) +
      (rich ? 5 : 0),
  );

  const acquisitionLikelihood = clamp01(
    (active ? 42 : 10)
      + (rich ? 22 : 0)
      + (hvd ? 12 : 0)
      + Math.min(18, frLen * 4)
      + Math.min(14, fsCount * 3)
      + Math.min(12, Math.floor(descLen / 40))
      + (latestRevenue != null && latestRevenue > 0 ? 8 : 0)
      - (financialStress > 60 ? 28 : 0),
  );

  const ownershipTransition = clamp01(20 + offLen * 4 + olCount * 6 + ccCount * 2 + (active ? 10 : 25));

  const sellerReadiness = clamp01(
    (active ? 30 : 5)
      + (signLen > 0 ? 18 : 0)
      + (shareKeys > 2 ? 20 : shareKeys > 0 ? 10 : 0)
      + (rich ? 22 : 0),
  );

  const growthVsStagnation = clamp01(
    Math.min(40, frLen * 9) +
      Math.min(35, fsCount * 8) +
      (latestRevenue != null && latestRevenue > 0 ? 10 : 0) +
      (latestNetResult != null && latestNetResult > 0 ? 10 : 0) +
      (descLen >= 80 ? 8 : descLen >= 24 ? 4 : 0),
  );

  const boardNetwork = clamp01(Math.min(100, offLen * 10 + olCount * 5 + (rich ? 8 : 0)));

  const def = (t: CatalogSignalType) => SIGNAL_CATALOG.find((x) => x.type === t)?.definition ?? '';

  return [
    {
      signalType: 'acquisition_likelihood',
      score: acquisitionLikelihood,
      explanation: {
        definition: def('acquisition_likelihood'),
        drivers: [
          { key: 'active', value: active, weight: 'high' },
          { key: 'hasRichOrganisationInformation', value: rich, weight: 'high' },
          { key: 'hasHighValueDataset', value: hvd, weight: 'medium' },
          { key: 'financial_report_rows', value: frLen, weight: 'medium' },
          { key: 'financial_statement_rows', value: fsCount, weight: 'medium' },
          { key: 'latest_revenue', value: latestRevenue, weight: 'low' },
          { key: 'financial_stress_penalty', value: financialStress > 60, weight: 'high' },
        ],
      },
    },
    {
      signalType: 'ownership_transition_probability',
      score: ownershipTransition,
      explanation: {
        definition: def('ownership_transition_probability'),
        drivers: [
          { key: 'officer_rows', value: offLen, weight: 'high' },
          { key: 'ownership_links_rows', value: olCount, weight: 'high' },
          { key: 'company_cases_rows', value: ccCount, weight: 'medium' },
          { key: 'status', value: company.status ?? null, weight: 'medium' },
        ],
      },
    },
    {
      signalType: 'seller_readiness',
      score: sellerReadiness,
      explanation: {
        definition: def('seller_readiness'),
        drivers: [
          { key: 'active', value: active, weight: 'high' },
          { key: 'signatory_text_chars', value: signLen, weight: 'medium' },
          { key: 'share_information_keys', value: shareKeys, weight: 'medium' },
          { key: 'hasRichOrganisationInformation', value: rich, weight: 'high' },
        ],
      },
    },
    {
      signalType: 'growth_vs_stagnation',
      score: growthVsStagnation,
      explanation: {
        definition: def('growth_vs_stagnation'),
        drivers: [
          { key: 'financial_report_rows', value: frLen, weight: 'high' },
          { key: 'financial_statement_rows', value: fsCount, weight: 'high' },
          { key: 'latest_net_result', value: latestNetResult, weight: 'medium' },
          { key: 'business_description_chars', value: descLen, weight: 'medium' },
        ],
      },
    },
    {
      signalType: 'compliance_ownership_complexity',
      score: complianceComplexity,
      explanation: {
        definition: def('compliance_ownership_complexity'),
        drivers: [
          { key: 'officer_rows', value: offLen, weight: 'high' },
          { key: 'ownership_links_rows', value: olCount, weight: 'medium' },
          { key: 'company_cases_rows', value: ccCount, weight: 'high' },
          { key: 'status', value: company.status ?? null, weight: 'high' },
          { key: 'hasRichOrganisationInformation', value: rich, weight: 'low' },
        ],
      },
    },
    {
      signalType: 'financial_stress',
      score: financialStress,
      explanation: {
        definition: def('financial_stress'),
        drivers: [
          { key: 'status', value: company.status ?? null, weight: 'high' },
          { key: 'financial_report_rows', value: frLen, weight: 'medium' },
          { key: 'financial_statement_rows', value: fsCount, weight: 'high' },
          { key: 'latest_net_result', value: latestNetResult, weight: 'high' },
          { key: 'latest_equity_ratio', value: latestEquityRatio, weight: 'medium' },
        ],
      },
    },
    {
      signalType: 'board_network_signals',
      score: boardNetwork,
      explanation: {
        definition: def('board_network_signals'),
        drivers: [
          { key: 'officer_rows', value: offLen, weight: 'high' },
          { key: 'ownership_links_rows', value: olCount, weight: 'medium' },
          { key: 'hasRichOrganisationInformation', value: rich, weight: 'low' },
        ],
      },
    },
  ];
}
