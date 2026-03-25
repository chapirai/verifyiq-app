import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';

/** Swedish organisation number: 10 or 12 digits. */
const ORG_NR_REGEX = /^(\d{10}|\d{12})$/;

export class LookupCompanyDto {
  @IsString()
  @Matches(ORG_NR_REGEX, {
    message: 'orgNumber must be a 10-digit or 12-digit Swedish organisation number',
  })
  orgNumber!: string;

  @IsOptional()
  @IsBoolean()
  force_refresh?: boolean;
}

export type FreshnessStatus = 'fresh' | 'stale' | 'expired';
export type LookupSource = 'DB' | 'API';

export class CompanyMetadataDto {
  source!: LookupSource;
  fetched_at!: string;
  age_days!: number;
  freshness!: FreshnessStatus;
  cache_ttl_days!: number;
}

export class LookupCompanyResponseDto {
  company!: Record<string, unknown>;
  metadata!: CompanyMetadataDto;
}
