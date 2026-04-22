export const DECISION_REFRESH_QUEUE = 'decision-refresh';

export const DecisionRefreshJobName = {
  REFRESH_ORG: 'refresh-org-decision-snapshots',
} as const;

export type DecisionRefreshJobName = (typeof DecisionRefreshJobName)[keyof typeof DecisionRefreshJobName];

export interface DecisionRefreshJobData {
  tenantId: string;
  organisationNumber: string;
  reason: 'signal_recompute' | 'ownership_change' | 'filings_change';
  triggerId: string;
}

