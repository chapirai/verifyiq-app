import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { createHash } from 'crypto';

/** How the fetch decision was made for this snapshot. */
export type SnapshotPolicyDecision = 'cache_hit' | 'fresh_fetch' | 'force_refresh' | 'stale_fallback';

/**
 * Generate a deterministic, immutable replay-safe identifier for a snapshot.
 *
 * The ID is a SHA-256 digest of `{tenantId}:{orgNr}:{snapshotId}:{payloadHash}`
 * prefixed with "rp-" for human readability.  Two snapshots with identical
 * inputs always produce the same replay ID — enabling content-addressable
 * storage compatibility while remaining globally unique (P02-T07).
 */
export function generateReplayId(
  tenantId: string,
  organisationsnummer: string,
  snapshotId: string,
  payloadHash?: string | null,
): string {
  const payload = `${tenantId}:${organisationsnummer}:${snapshotId}:${payloadHash ?? ''}`;
  const digest = createHash('sha256').update(payload, 'utf8').digest('hex');
  return `rp-${digest.slice(0, 48)}`;
}

@Entity({ name: 'bolagsverket_fetch_snapshots' })
@Index(['tenantId', 'organisationsnummer', 'fetchedAt'])
@Index(['tenantId', 'organisationsnummer', 'isFromCache'])
@Index(['tenantId', 'correlationId'])
// P02-T07: version chain traversal indexes
@Index(['previousSnapshotId'])
@Index(['tenantId', 'organisationsnummer', 'sequenceNumber'])
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

  // ── P02-T02: Raw payload linkage ───────────────────────────────────────────

  /**
   * FK to the BvRawPayload record that holds the full provider response
   * produced during this snapshot's fetch.  Null when:
   *   • the snapshot was served from cache (no fresh fetch occurred), or
   *   • raw-payload storage failed (graceful degradation).
   */
  @Column({ name: 'raw_payload_id', type: 'uuid', nullable: true })
  rawPayloadId?: string | null;

  // ── P02-T07: Version chain fields ─────────────────────────────────────────

  /**
   * ID of the preceding snapshot in the version chain for this entity.
   * Null for the first snapshot in a chain.  Forms a linked-list structure
   * enabling backwards traversal: snapshot → previousSnapshot → … → root.
   */
  @Column({ name: 'previous_snapshot_id', type: 'uuid', nullable: true })
  previousSnapshotId?: string | null;

  /**
   * Monotonically increasing version counter per (tenant, organisationsnummer).
   * First snapshot = 1, each subsequent snapshot increments by 1.
   * Used for human-readable version references and sequence integrity checks.
   */
  @Column({ name: 'version_number', type: 'integer', default: 1 })
  versionNumber!: number;

  /**
   * Sequence number for chain ordering within the tenant scope.
   * Assigned at link time; equals versionNumber for per-entity chains.
   * Reserved for cross-entity chain extensions in future phases.
   */
  @Column({ name: 'sequence_number', type: 'integer', default: 1 })
  sequenceNumber!: number;

  /**
   * Replay-safe immutable identifier for this snapshot.
   *
   * Generated deterministically as `rp-<sha256(tenantId:orgNr:snapshotId:payloadHash)[:48]>`.
   * Remains valid even if the underlying storage strategy changes, enabling
   * content-addressable retrieval and safe external references (P02-T07).
   */
  @Column({ name: 'replay_id', type: 'varchar', length: 64, nullable: true, unique: true })
  replayId?: string | null;

  /**
   * Set to true when the chain link to previousSnapshotId is known to be
   * broken (predecessor is missing or invalid).  Preserved for visibility
   * rather than silently repaired — see SnapshotChainService.reconstructChain.
   */
  @Column({ name: 'chain_broken', type: 'boolean', default: false })
  chainBroken!: boolean;
}
