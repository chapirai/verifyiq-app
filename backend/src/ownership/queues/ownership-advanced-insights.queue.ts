export const OWNERSHIP_ADVANCED_INSIGHTS_QUEUE = 'ownership-advanced-insights';

export const OwnershipAdvancedInsightsJobName = {
  PRECOMPUTE: 'precompute-ownership-advanced-insights',
} as const;

export interface OwnershipAdvancedInsightsJobData {
  tenantId: string;
  organisationNumber: string;
}

