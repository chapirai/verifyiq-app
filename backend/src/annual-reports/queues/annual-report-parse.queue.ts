export const ANNUAL_REPORT_PARSE_QUEUE = 'annual-report-parse' as const;

export type AnnualReportParseJobData = {
  tenantId: string;
  annualReportFileId: string;
  /** When true, parse even if file already normalized */
  force?: boolean;
};

export type AnnualReportBackfillJobData = {
  tenantId: string;
  limit?: number;
};

export type AnnualReportRebuildServingJobData = {
  tenantId: string;
  annualReportFileId: string;
};

/** After HVD dokumentlista: download each ZIP, store, queue iXBRL parse (worker runs sequentially). */
export type AnnualReportAutoIngestHvdJobData = {
  tenantId: string;
  organisationNumber: string;
  dokumentIds: string[];
};
