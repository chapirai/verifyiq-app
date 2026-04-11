export type AnnualReportComparisonColumn = {
  year: number;
  headerId: string;
  filingPeriodEnd: string | null;
  companyName: string | null;
  currencyCode: string | null;
  auditorFirm: string | null;
  factCount: number;
};

export type AnnualReportComparisonRow = {
  canonicalField: string;
  label: string;
  byYear: Record<string, string | null>;
};

export type AnnualReportFinancialComparison = {
  organisationNumber: string;
  years: number[];
  columns: AnnualReportComparisonColumn[];
  rows: AnnualReportComparisonRow[];
};

export type IngestHvdAnnualReportResult = {
  bvStoredDocumentId: string;
  annualReportFileId: string;
  jobId: string;
  createdAnnualFile: boolean;
  storedNewBytes: boolean;
};

export type CompanyAnnualReportHeader = {
  id: string;
  filingPeriodStart?: string | null;
  filingPeriodEnd?: string | null;
  companyNameFromFiling?: string | null;
  currencyCode?: string | null;
  parserVersion?: string | null;
  extractedAt?: string | null;
};
