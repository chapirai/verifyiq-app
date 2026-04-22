/** Valid company status values (shared by list DTO and sourcing parser; no decorators). */
export const COMPANY_STATUSES = ['ACTIVE', 'INACTIVE', 'LIQUIDATION', 'BANKRUPT', 'DISSOLVED'] as const;
export type CompanyStatus = (typeof COMPANY_STATUSES)[number];

export const COMPANY_SORT_FIELDS = ['updatedAt', 'legalName', 'createdAt', 'sourcing_rank', 'ownership_risk'] as const;
export type CompanySortField = (typeof COMPANY_SORT_FIELDS)[number];

export const COMPANY_SORT_DIRECTIONS = ['asc', 'desc'] as const;
export type CompanySortDirection = (typeof COMPANY_SORT_DIRECTIONS)[number];
