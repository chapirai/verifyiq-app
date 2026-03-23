export interface PaginatedResponse<T> {
  items: T[];
  total: number;
}

export interface CompanyRecord {
  id: string;
  organisationNumber: string;
  name: string;
  status: string;
}

export interface OnboardingCaseRecord {
  id: string;
  subject: string;
  state: string;
}

export interface ScreeningMatchRecord {
  id: string;
  finding: string;
  severity: string;
}

export interface MonitoringAlertRecord {
  id: string;
  title: string;
  type: string;
}
