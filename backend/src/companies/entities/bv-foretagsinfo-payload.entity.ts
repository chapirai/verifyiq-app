import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Stores the full Företagsinformation v4 payload for each fetch snapshot.
 *
 * One row per snapshot fetch — linked to `bolagsverket_fetch_snapshots` via
 * `snapshot_id`.  The full response array is stored as JSONB so no data is lost.
 */
@Entity({ name: 'bv_foretagsinfo_payloads' })
@Index(['tenantId', 'snapshotId'])
@Index(['tenantId', 'organisationsnummer', 'fetchedAt'])
export class BvForetagsinfoPayloadEntity {
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

  /** Wall-clock time at which the Företagsinformation API was called. */
  @Column({ name: 'fetched_at', type: 'timestamptz' })
  fetchedAt!: Date;

  /**
   * Request/correlation ID returned by the API.
   * Useful for tracing individual API calls in provider logs.
   */
  @Column({ name: 'request_id', type: 'varchar', length: 128, nullable: true })
  requestId?: string | null;

  /** Full Företagsinformation v4 response body stored as JSONB. */
  @Column({ name: 'payload', type: 'jsonb' })
  payload!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
