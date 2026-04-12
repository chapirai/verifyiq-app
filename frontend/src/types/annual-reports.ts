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
