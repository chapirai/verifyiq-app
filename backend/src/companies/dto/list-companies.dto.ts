import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

/** Valid company status values. */
export const COMPANY_STATUSES = ['ACTIVE', 'INACTIVE', 'LIQUIDATION', 'BANKRUPT', 'DISSOLVED'] as const;
export type CompanyStatus = (typeof COMPANY_STATUSES)[number];

/** Swedish organisation number: 10 or 12 digits. */
const ORG_NR_REGEX = /^(\d{10}|\d{12})$/;

export class ListCompaniesDto {
  /**
   * Fuzzy search on legal_name (ILIKE %q%).
   * Max 255 characters.
   */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  q?: string;

  /**
   * Exact match on organisation_number.
   * Must be a 10-digit or 12-digit Swedish organisation number.
   */
  @IsOptional()
  @Matches(ORG_NR_REGEX, {
    message: 'org_number must be a 10-digit or 12-digit Swedish organisation number',
  })
  org_number?: string;

  /**
   * Filter by company status.
   * Allowed values: ACTIVE, INACTIVE, LIQUIDATION, BANKRUPT, DISSOLVED.
   */
  @IsOptional()
  @IsEnum(COMPANY_STATUSES, {
    message: `status must be one of: ${COMPANY_STATUSES.join(', ')}`,
  })
  status?: CompanyStatus;

  /**
   * Page number (1-based). Defaults to 1.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  /**
   * Results per page. Defaults to 10. Max 100.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}
