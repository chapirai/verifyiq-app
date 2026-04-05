import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Stores the full HVD (Värdefulla datamängder) payload for each fetch snapshot.
 *
 * One row per snapshot fetch — linked to `bolagsverket_fetch_snapshots` via
 * `snapshot_id`.  The full response body is stored as JSONB so no data is lost
 * and queries can filter/project individual fields without application-level
 * deserialization.
 */
@Entity({ name: 'bv_hvd_payloads' })
@Index(['tenantId', 'snapshotId'])
@Index(['tenantId', 'organisationsnummer', 'fetchedAt'])
export class BvHvdPayloadEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Tenant scope — all queries must be tenant-scoped. */
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  /**
   * ID of the BvFetchSnapshotEntity that produced this payload.
   * Nullable until the snapshot record is created, then backfilled.
   */
  @Column({ name: 'snapshot_id', type: 'uuid', nullable: true })
  snapshotId?: string | null;

  /** Swedish organisation number (identitetsbeteckning). */
  @Column({ name: 'organisationsnummer', type: 'varchar', length: 20 })
  organisationsnummer!: string;

  /** Wall-clock time at which the HVD API was called. */
  @Column({ name: 'fetched_at', type: 'timestamptz' })
  fetchedAt!: Date;

  /**
   * Request/correlation ID returned by the HVD API (X-Request-Id header).
   * Useful for tracing individual API calls in provider logs.
   */
  @Column({ name: 'request_id', type: 'varchar', length: 128, nullable: true })
  requestId?: string | null;

  /** Full HVD response body stored as JSONB. */
  @Column({ name: 'payload', type: 'jsonb' })
  payload!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
