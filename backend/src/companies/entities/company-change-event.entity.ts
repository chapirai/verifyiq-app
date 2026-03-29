import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// ── P02-T08: Snapshot Change Event ───────────────────────────────────────────

/**
 * Classification of the type of change detected between two consecutive
 * snapshots for a given attribute.
 */
export enum ChangeType {
  /** Attribute was not present in the before-snapshot but exists in the after-snapshot. */
  ADDED = 'ADDED',
  /** Attribute existed in both snapshots but its value changed. */
  MODIFIED = 'MODIFIED',
  /** Attribute was present in the before-snapshot but absent in the after-snapshot. */
  REMOVED = 'REMOVED',
  /** Attribute exists in both snapshots with the same value (no change). */
  UNCHANGED = 'UNCHANGED',
  /** Comparison could not be completed (e.g., snapshot read failure). */
  UNKNOWN = 'UNKNOWN',
}

/**
 * P02-T08: Company change event entity.
 *
 * Records a single attribute-level change detected by comparing two consecutive
 * BvFetchSnapshot records for the same company.  One comparison run produces
 * one change event per attribute inspected.
 *
 * Design notes:
 *  - `old_value` / `new_value` are stored as serialised JSON strings so that
 *    any value type (string, number, boolean, object, null) can be persisted
 *    uniformly without schema changes.
 *  - `snapshot_id_before` is nullable to support the first-ever snapshot for an
 *    entity (no predecessor exists).
 *  - Tenant isolation: every query MUST include tenant_id in the WHERE clause.
 *  - All writes are best-effort; failures must NOT block snapshot creation.
 *  - `correlation_id` links change events back to the originating request chain.
 */
@Entity({ name: 'company_change_events' })
// P02-T08: indexes for efficient change queries
@Index('idx_change_event_snapshot_before', ['snapshotIdBefore'], { where: 'snapshot_id_before IS NOT NULL' })
@Index('idx_change_event_snapshot_after', ['snapshotIdAfter'])
@Index('idx_change_event_tenant_org_attr', ['tenantId', 'orgNumber', 'attributeName'])
@Index('idx_change_event_tenant_created', ['tenantId', 'createdAt'])
@Index('idx_change_event_tenant_change_type', ['tenantId', 'changeType'])
@Index('idx_change_event_correlation_id', ['correlationId'], { where: 'correlation_id IS NOT NULL' })
export class CompanyChangeEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // ── Tenant / company identification ─────────────────────────────────────────

  /** Tenant that owns this change event. Required for tenant isolation. */
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  /** Organisation number of the company whose data changed. */
  @Column({ name: 'org_number', type: 'varchar', length: 64 })
  orgNumber!: string;

  // ── Snapshot linkage ─────────────────────────────────────────────────────────

  /**
   * ID of the preceding snapshot used as the "before" state.
   * Null when this is the first-ever snapshot for the entity (nothing to compare against).
   */
  @Column({ name: 'snapshot_id_before', type: 'uuid', nullable: true })
  snapshotIdBefore?: string | null;

  /** ID of the snapshot that was just created, used as the "after" state. */
  @Column({ name: 'snapshot_id_after', type: 'uuid' })
  snapshotIdAfter!: string;

  // ── Change details ────────────────────────────────────────────────────────────

  /**
   * Dot-notation path to the attribute that changed.
   * e.g. 'legalName', 'registeredAddress.street', 'directors[0].name'
   */
  @Column({ name: 'attribute_name', type: 'varchar', length: 512 })
  attributeName!: string;

  /**
   * Serialised JSON representation of the attribute's value in the before-snapshot.
   * Null when `changeType` is ADDED (attribute did not exist before).
   */
  @Column({ name: 'old_value', type: 'text', nullable: true })
  oldValue?: string | null;

  /**
   * Serialised JSON representation of the attribute's value in the after-snapshot.
   * Null when `changeType` is REMOVED (attribute no longer exists).
   */
  @Column({ name: 'new_value', type: 'text', nullable: true })
  newValue?: string | null;

  /**
   * Classification of the change: ADDED | MODIFIED | REMOVED | UNCHANGED | UNKNOWN.
   */
  @Column({ name: 'change_type', type: 'varchar', length: 32 })
  changeType!: ChangeType;

  // ── Tracing / context ────────────────────────────────────────────────────────

  /**
   * Correlation ID propagated from the originating request.
   * Links change events back to the full lineage chain.
   */
  @Column({ name: 'correlation_id', type: 'varchar', length: 128, nullable: true })
  correlationId?: string | null;

  /**
   * Actor (user/service) that triggered the snapshot fetch.
   * Nullable for system-initiated comparisons.
   */
  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId?: string | null;

  // ── Timestamp ────────────────────────────────────────────────────────────────

  /** When this change event was persisted (set by the database on INSERT). */
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
