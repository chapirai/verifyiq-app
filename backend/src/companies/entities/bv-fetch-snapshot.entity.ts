import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** How the fetch decision was made for this snapshot. */
export type SnapshotPolicyDecision = 'cache_hit' | 'fresh_fetch' | 'force_refresh' | 'stale_fallback';

@Entity({ name: 'bolagsverket_fetch_snapshots' })
@Index(['tenantId', 'organisationsnummer', 'fetchedAt'])
@Index(['tenantId', 'organisationsnummer', 'isFromCache'])
@Index(['tenantId', 'correlationId'])
export class BvFetchSnapshotEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'organisation_id', type: 'uuid', nullable: true })
  organisationId?: string | null;

  @Column({ name: 'organisationsnummer', type: 'varchar', length: 20 })
  organisationsnummer!: string;

  @Column({ name: 'source_name', type: 'varchar', length: 64, default: 'bolagsverket' })
  sourceName!: string;

  @Column({ name: 'identifier_used', type: 'varchar', length: 64 })
  identifierUsed!: string;

  @Column({ name: 'identifier_type', type: 'varchar', length: 32 })
  identifierType!: string;

  @Column({ name: 'fetch_status', type: 'varchar', length: 32, default: 'success' })
  fetchStatus!: string;

  @Column({ name: 'is_from_cache', type: 'boolean', default: false })
  isFromCache!: boolean;

  @Column({ name: 'cache_hit_reason', type: 'text', nullable: true })
  cacheHitReason?: string | null;

  @Column({ name: 'payload_hash', type: 'varchar', length: 64, nullable: true })
  payloadHash?: string | null;

  @Column({ name: 'raw_payload_summary', type: 'jsonb', default: () => "'{}'::jsonb" })
  rawPayloadSummary!: Record<string, unknown>;

  @Column({ name: 'normalised_summary', type: 'jsonb', default: () => "'{}'::jsonb" })
  normalisedSummary!: Record<string, unknown>;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string | null;

  @Column({ name: 'fetched_at', type: 'timestamptz', default: () => 'NOW()' })
  fetchedAt!: Date;

  @Column({ name: 'api_call_count', type: 'integer', default: 0 })
  apiCallCount!: number;

  @Column({ name: 'data_freshness_days', type: 'integer', nullable: true })
  dataFreshnessDays?: number | null;

  // ── P02-T01: Lineage, cost, and policy fields ──────────────────────────────

  /**
   * Correlation ID from the originating request — enables full lineage tracing
   * from API call → orchestration → snapshot → audit log.
   */
  @Column({ name: 'correlation_id', type: 'varchar', length: 128, nullable: true })
  correlationId?: string | null;

  /**
   * Actor (user/service) that triggered the fetch — stored for audit purposes.
   * Nullable to support unauthenticated/system-initiated fetches.
   */
  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId?: string | null;

  /**
   * Policy decision that led to this snapshot being created:
   * - 'cache_hit'     – data served from an existing fresh snapshot
   * - 'fresh_fetch'   – normal cache miss, fetched from external API
   * - 'force_refresh' – caller explicitly requested a bypass of the cache
   * - 'stale_fallback'– provider unavailable; stale data served with warning
   */
  @Column({ name: 'policy_decision', type: 'varchar', length: 32, default: 'fresh_fetch' })
  policyDecision!: SnapshotPolicyDecision;

  /**
   * Cost / quota impact flags for downstream billing and quota enforcement.
   * Keys are provider-specific (e.g. { apiCallCharged: true, quotaUnit: 'hvd' }).
   */
  @Column({ name: 'cost_impact_flags', type: 'jsonb', default: () => "'{}'::jsonb" })
  costImpactFlags!: Record<string, unknown>;

  /**
   * Whether this snapshot represents a stale-data fallback (provider unavailable).
   * When true, downstream consumers should surface a staleness warning to users.
   */
  @Column({ name: 'is_stale_fallback', type: 'boolean', default: false })
  isStaleFallback!: boolean;
}
