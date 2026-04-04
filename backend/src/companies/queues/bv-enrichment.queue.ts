export const BV_ENRICHMENT_QUEUE = 'bv-enrichment';

export const BvEnrichmentJobName = {
  FETCH_FINANCIAL_REPORTS: 'fetch-financial-reports',
  FETCH_ARENDEN: 'fetch-arenden',
  FETCH_ENGAGEMENTS: 'fetch-engagements',
  AGGREGATE_HVD: 'aggregate-hvd',
} as const;

export type BvEnrichmentJobName =
  (typeof BvEnrichmentJobName)[keyof typeof BvEnrichmentJobName];

export interface FetchFinancialReportsJobData {
  identitetsbeteckning: string;
  fromdatum?: string;
  tomdatum?: string;
  tenantId: string;
  correlationId?: string;
  actorId?: string;
}

export interface FetchArendenJobData {
  organisationIdentitetsbeteckning: string;
  fromdatum?: string;
  tomdatum?: string;
  tenantId: string;
  correlationId?: string;
  actorId?: string;
}

export interface FetchEngagementsJobData {
  identitetsbeteckning: string;
  pageNumber?: number;
  pageSize?: number;
  tenantId: string;
  correlationId?: string;
  actorId?: string;
}

export interface AggregateHvdJobData {
  identitetsbeteckning: string;
  tenantId: string;
  correlationId?: string;
  actorId?: string;
}
