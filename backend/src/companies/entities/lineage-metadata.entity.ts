import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// ── P02-T06: Lineage Metadata ─────────────────────────────────────────────────

/**
 * Enumeration of trigger types that can initiate a data operation.
 * Stored as a plain string in the DB for forward-compatibility.
 */
export enum TriggerType {
  API_REQUEST = 'API_REQUEST',
  SCHEDULED_REFRESH = 'SCHEDULED_REFRESH',
  FORCE_REFRESH = 'FORCE_REFRESH',
  BACKGROUND_JOB = 'BACKGROUND_JOB',
  ALERT_TRIGGERED = 'ALERT_TRIGGERED',
}

/**
 * P02-T06: Lineage metadata record.
 *
 * Persists the full context of every data operation so that auditors can
 * answer "who requested this data, from where, and when?" and so that
 * engineers can replay or debug any operation.
 *
 * Design notes:
 * - `request_parameters` stores a sanitised snapshot of the inbound params
 *   (passwords, tokens, and other sensitive keys are removed before storage).
 * - `correlation_id` links records produced within a single request chain.
 * - All writes are best-effort; capture failures must not abort the main path.
 * - Tenant isolation: every query MUST include tenant_id in the WHERE clause.
 */
@Entity({ name: 'lineage_metadata' })
@Index('idx_lineage_correlation_id', ['correlationId'])
@Index('idx_lineage_user_id', ['userId'])
@Index('idx_lineage_created_at', ['createdAt'])
@Index('idx_lineage_trigger_type', ['triggerType'])
@Index('idx_lineage_tenant_correlation', ['tenantId', 'correlationId'])
@Index('idx_lineage_tenant_user', ['tenantId', 'userId'])
@Index('idx_lineage_tenant_created', ['tenantId', 'createdAt'])
export class LineageMetadataEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // ── Tenant / user context ──────────────────────────────────────────────────

  /** Tenant that owns this lineage record. Required for tenant isolation. */
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  /**
   * Actor (user or service account) that triggered the operation.
   * Nullable to support unauthenticated / system-initiated operations.
   */
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string | null;

  // ── Correlation / tracing ─────────────────────────────────────────────────

  /**
   * Request-scoped UUID propagated from the entry point through the entire
   * operation chain.  All lineage records produced within a single logical
   * request share the same correlation_id.
   */
  @Column({ name: 'correlation_id', type: 'varchar', length: 128 })
  correlationId!: string;

  // ── Operation classification ──────────────────────────────────────────────

  /**
   * How this operation was triggered.
   * One of: API_REQUEST | SCHEDULED_REFRESH | FORCE_REFRESH |
   *         BACKGROUND_JOB | ALERT_TRIGGERED
   */
  @Column({ name: 'trigger_type', type: 'varchar', length: 64 })
  triggerType!: TriggerType;

  /** HTTP method used for the inbound request (e.g. GET, POST, PATCH). */
  @Column({ name: 'http_method', type: 'varchar', length: 16, nullable: true })
  httpMethod?: string | null;

  /** API path / endpoint that was invoked (e.g. /companies/lookup). */
  @Column({ name: 'source_endpoint', type: 'varchar', length: 512, nullable: true })
  sourceEndpoint?: string | null;

  // ── Request data (sanitised) ──────────────────────────────────────────────

  /**
   * Sanitised copy of inbound request parameters.
   * Sensitive fields (passwords, tokens, secrets) are removed before
   * storage — see LineageMetadataCaptureService.sanitizeParameters().
   */
  @Column({ name: 'request_parameters', type: 'jsonb', default: () => "'{}'::jsonb" })
  requestParameters!: Record<string, unknown>;

  // ── Timestamps ────────────────────────────────────────────────────────────

  /** When this lineage record was created (set by the DB on INSERT). */
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
