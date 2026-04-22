export const COMPANY_SIGNALS_QUEUE = 'company-signals';

export const CompanySignalsJobName = {
  RECOMPUTE_ORG: 'recompute-org-signals',
} as const;

export type CompanySignalsJobName = (typeof CompanySignalsJobName)[keyof typeof CompanySignalsJobName];

export interface CompanySignalsJobData {
  tenantId: string;
  organisationNumber: string;
  actorId: string | null;
  engineVersion: string;
}
