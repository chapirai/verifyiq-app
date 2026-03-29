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
  /** ID of the snapshot record that sourced this response — for audit trail linkage. */
  snapshot_id!: string;
  /** Request-scoped correlation ID for end-to-end lineage tracing. */
  correlation_id!: string;
  /** Policy decision that produced the snapshot (cache_hit | fresh_fetch | force_refresh | stale_fallback). */
  policy_decision!: string;
  /** True when stale fallback was used due to provider failure or policy. */
  degraded!: boolean;
  /** Failure state label when degraded fallback is used. */
  failure_state!: string | null;
}

export class LookupCompanyResponseDto {
  company!: Record<string, unknown>;
  metadata!: CompanyMetadataDto;
}
