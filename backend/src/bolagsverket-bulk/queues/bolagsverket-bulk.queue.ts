export const BOLAGSVERKET_BULK_QUEUE = 'bolagsverket-bulk';

export const BolagsverketBulkJobName = {
  RUN_WEEKLY_INGESTION: 'run-weekly-ingestion',
  PROCESS_ENRICHMENT_REQUEST: 'process-enrichment-request',
} as const;

export interface RunWeeklyIngestionJobData {
  sourceUrl?: string;
}

export interface ProcessEnrichmentRequestJobData {
  requestId: string;
}

