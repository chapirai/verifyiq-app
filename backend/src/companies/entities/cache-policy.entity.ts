import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * P02-T04: Cache policy entity.
 *
 * Stores configurable freshness windows and cache-decision parameters at
 * system level (tenant_id IS NULL) or per-tenant level (tenant_id set).
 *
 * Evaluation priority:
 *   1. Entity-specific policy  (entity_id set)
 *   2. Tenant-level policy     (tenant_id set, entity_id NULL)
 *   3. System default policy   (tenant_id NULL, is_system_default TRUE)
 */
@Entity({ name: 'cache_policies' })
@Index(['tenantId', 'isActive'])
@Index(['isSystemDefault', 'isActive'])
export class CachePolicyEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Scoping tenant. NULL means this is the system-wide default policy.
   * When set, this policy overrides the system default for that tenant.
   */
  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId?: string | null;

  /**
   * Optional entity-level scope: entity type (e.g. 'company').
   * When set together with entity_id, this policy applies to a specific entity.
   */
  @Column({ name: 'entity_type', type: 'varchar', length: 64, nullable: true })
  entityType?: string | null;

  /**
   * Optional entity-level scope: specific entity identifier (e.g. org number).
   * Must be combined with entity_type.
   */
  @Column({ name: 'entity_id', type: 'varchar', length: 128, nullable: true })
  entityId?: string | null;

  /**
   * Human-readable name for this policy (e.g. "Default 30-day window",
   * "Acme Corp aggressive refresh").
   */
  @Column({ name: 'policy_name', type: 'varchar', length: 255, default: 'Default Policy' })
  policyName!: string;

  // ── Freshness window ───────────────────────────────────────────────────────

  /**
   * Number of hours within which data is considered "fresh" and served
   * directly from cache without any provider call.
   * Default: 720 hours (30 days).
   */
  @Column({ name: 'freshness_window_hours', type: 'integer', default: 720 })
  freshnessWindowHours!: number;

  /**
   * Maximum age in hours before data is considered "expired" and a provider
   * call is unconditionally triggered (unless stale_fallback_allowed and the
   * provider call fails).
   * Default: 2160 hours (90 days).
   */
  @Column({ name: 'max_age_hours', type: 'integer', default: 2160 })
  maxAgeHours!: number;

  /**
   * Age in hours at which a background/async refresh is triggered while still
   * serving cached data.  Must be between freshness_window_hours and
   * max_age_hours.
   * Default: 1440 hours (60 days).
   */
  @Column({ name: 'refresh_trigger_hours', type: 'integer', default: 1440 })
  refreshTriggerHours!: number;

  // ── Fallback / cost control ────────────────────────────────────────────────

  /**
   * Whether stale data may be served when the provider call fails or when data
   * is between freshness_window_hours and max_age_hours.
   * Default: true (safe fallback behaviour).
   */
  @Column({ name: 'stale_fallback_allowed', type: 'boolean', default: true })
  staleFallbackAllowed!: boolean;

  /**
   * JSONB cost/quota flags propagated to BvFetchSnapshotEntity.costImpactFlags.
   * Can include keys like: { forceRefreshCharges: true, highFrequencyFlag: true }.
   */
  @Column({
    name: 'force_refresh_cost_flags',
    type: 'jsonb',
    default: () => "'{}'::jsonb",
  })
  forceRefreshCostFlags!: Record<string, unknown>;

  // ── Administrative metadata ────────────────────────────────────────────────

  /**
   * Whether this is the authoritative system-wide default.
   * Only one row should have this set to true at any time.
   */
  @Column({ name: 'is_system_default', type: 'boolean', default: false })
  isSystemDefault!: boolean;

  /** Soft-delete / disable flag.  Inactive policies are ignored during lookup. */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
