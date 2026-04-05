import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Stores the full HVD /dokumentlista response for each fetch snapshot.
 *
 * One row per snapshot fetch — linked to `bolagsverket_fetch_snapshots` via
 * `snapshot_id`.  The full array of available documents (annual reports) is
 * stored as JSONB so no data is lost and the list can be displayed on the
 * company profile page without re-fetching from Bolagsverket.
 */
@Entity({ name: 'bv_document_lists' })
@Index(['tenantId', 'snapshotId'])
@Index(['tenantId', 'organisationsnummer', 'fetchedAt'])
export class BvDocumentListEntity {
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

  /** Wall-clock time at which the dokumentlista API was called. */
  @Column({ name: 'fetched_at', type: 'timestamptz' })
  fetchedAt!: Date;

  /**
   * Request/correlation ID returned by the HVD API.
   * Useful for tracing individual API calls in provider logs.
   */
  @Column({ name: 'request_id', type: 'varchar', length: 128, nullable: true })
  requestId?: string | null;

  /**
   * Full dokumentlista response (array of BvDokument entries) stored as JSONB.
   * Each entry has: dokumentId, filformat, rapporteringsperiodTom,
   * registreringstidpunkt, dokumenttyp.
   */
  @Column({ name: 'documents', type: 'jsonb', default: () => "'[]'::jsonb" })
  documents!: Array<{
    dokumentId?: string;
    filformat?: string;
    rapporteringsperiodTom?: string;
    registreringstidpunkt?: string;
    dokumenttyp?: string;
  }>;

  /** Total number of documents in the list (for quick querying). */
  @Column({ name: 'document_count', type: 'integer', default: 0 })
  documentCount!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
