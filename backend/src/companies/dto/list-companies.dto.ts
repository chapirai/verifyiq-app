import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  COMPANY_SORT_DIRECTIONS,
  COMPANY_SORT_FIELDS,
  COMPANY_STATUSES,
  type CompanySortDirection,
  type CompanySortField,
  type CompanyStatus,
} from '../constants/company-list.constants';

export {
  COMPANY_SORT_DIRECTIONS,
  COMPANY_SORT_FIELDS,
  COMPANY_STATUSES,
  type CompanySortDirection,
  type CompanySortField,
  type CompanyStatus,
} from '../constants/company-list.constants';

/** Swedish organisation number: 10 or 12 digits. */
const ORG_NR_REGEX = /^(\d{10}|\d{12})$/;

export class ListCompaniesDto {
  @IsOptional()
  @IsEnum(['deep_only', 'shallow_only', 'merged'])
  depth_mode?: 'deep_only' | 'shallow_only' | 'merged' = 'deep_only';

  @IsOptional()
  @IsEnum(['founder_exit', 'distressed', 'roll_up'], {
    message: 'deal_mode must be one of: founder_exit, distressed, roll_up',
  })
  deal_mode?: 'founder_exit' | 'distressed' | 'roll_up';

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
   * Case-insensitive substring match on `company_form` (e.g. Aktiebolag, enskild).
   * `%` characters are stripped server-side to avoid ILIKE injection.
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  company_form_contains?: string;

  /**
   * Industry / activity proxy: case-insensitive substring match on `business_description`
   * (Bolagsverket verksamhetsbeskrivning when present).
   */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  industry_contains?: string;

  /**
   * ISO-3166-1 alpha-2 country filter (companies.country_code, default SE).
   */
  @IsOptional()
  @ValidateIf((o) => o.country_code != null && o.country_code !== '')
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase().slice(0, 2) : value))
  @IsString()
  @Length(2, 2)
  country_code?: string;

  /**
   * When true, only companies with at least one entry in `financial_reports` JSONB.
   */
  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true' || value === '1') return true;
    if (value === false || value === 'false' || value === '0') return false;
    return undefined;
  })
  @IsBoolean()
  has_financial_reports?: boolean;

  /**
   * Case-insensitive match on serialised `officers` JSON (role / title keywords).
   */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  officer_role_contains?: string;

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

  /** Sort field. */
  @IsOptional()
  @IsEnum(COMPANY_SORT_FIELDS, {
    message: `sort_by must be one of: ${COMPANY_SORT_FIELDS.join(', ')}`,
  })
  sort_by?: CompanySortField = 'updatedAt';

  /** Sort direction. */
  @IsOptional()
  @IsEnum(COMPANY_SORT_DIRECTIONS, {
    message: `sort_dir must be one of: ${COMPANY_SORT_DIRECTIONS.join(', ')}`,
  })
  sort_dir?: CompanySortDirection = 'desc';
}
