export type SourcingParsedFilters = {
  q?: string;
  org_number?: string;
  status?: string;
  company_form_contains?: string;
  deal_mode?: 'founder_exit' | 'distressed' | 'roll_up';
};

export type SourcingParseResult = {
  filters: SourcingParsedFilters;
  notes: string[];
};

export type SimilarCompaniesStrategy =
  | 'invalid_org'
  | 'not_indexed'
  | 'no_company_form'
  | 'same_company_form'
  | 'no_industry_text'
  | 'industry_narrative_overlap'
  | 'no_financial_reports'
  | 'financial_report_count_proximity'
  | 'no_officers'
  | 'officer_count_proximity';

export interface SimilarCompanyRow {
  id: string;
  organisationNumber: string;
  legalName: string;
  status: string;
  companyForm: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SimilarCompaniesMode = 'form' | 'industry' | 'financial' | 'ownership';

export interface SimilarCompaniesResponse {
  data: SimilarCompanyRow[];
  total: number;
  anchorOrganisationNumber: string;
  strategy: SimilarCompaniesStrategy;
  companyForm: string | null;
  mode: SimilarCompaniesMode;
  industrySnippet?: string | null;
  anchorFinancialReportsCount?: number;
  anchorOfficersCount?: number;
}
