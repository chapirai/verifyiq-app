import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

/**
 * P02-T02: Raw payload storage entity.
 *
 * Stores immutable provider response payloads for auditability, debugging,
 * compliance, and cost analysis.  The payload is stored in a flat,
 * compression-ready JSON structure: `content` holds the provider response
 * body and `metadata` carries separable context (provider name, version,
 * fetch timestamp, etc.) so that a future compression pass can operate on
 * `content` without touching query-relevant metadata.
 *
 * Deduplication is enforced at the DB level via UNIQUE (tenant_id, checksum).
 */
@Entity({ name: 'bv_raw_payloads' })
@Unique('uq_bv_raw_payloads_tenant_checksum', ['tenantId', 'checksum'])
@Index(['tenantId', 'snapshotId'])
@Index(['tenantId', 'providerSource'])
export class BvRawPayloadEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Tenant scope — all queries must be tenant-scoped. */
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  /**
   * SHA-256 hex digest of the deterministically serialised `content` JSON.
   * Used for deduplication: if a payload with the same (tenant_id, checksum)
   * already exists, the new snapshot links to the existing record.
   */
  @Column({ name: 'checksum', type: 'varchar', length: 64 })
  checksum!: string;

  /**
   * Provider that produced this payload (e.g. 'bolagsverket').
   * Indexed to support "all payloads from provider X" queries.
   */
  @Column({ name: 'provider_source', type: 'varchar', length: 64 })
  providerSource!: string;

  /** Organisation or person identifier used for the fetch. */
  @Column({ name: 'organisationsnummer', type: 'varchar', length: 64 })
  organisationsnummer!: string;

  /**
   * The raw provider response body stored as flat JSONB.
   * Kept as flat as possible so a future compressor can deflate the value
   * without structural changes to the column or indexes.
   */
  @Column({ name: 'content', type: 'jsonb' })
  content!: Record<string, unknown>;

  /**
   * Separable metadata that describes the payload but is not the payload itself.
   * Keeping metadata out of `content` allows selective compression of `content`
   * and efficient querying of provenance without decompression.
   *
   * Shape: { payloadVersion, fetchedAt, sourceEndpoints[], partialFields[] }
   */
  @Column({ name: 'metadata', type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  /**
   * Semantic version of the payload format.
   * Increment when the shape of `content` changes to enable forward-compatible
   * consumers and future migration scripts.
   */
  @Column({ name: 'payload_version', type: 'varchar', length: 32, default: '1' })
  payloadVersion!: string;

  /**
   * Approximate size of the serialised `content` in bytes.
   * Used for retention tracking, archival thresholds, and cost analysis.
   */
  @Column({ name: 'payload_size_bytes', type: 'integer', default: 0 })
  payloadSizeBytes!: number;

  /**
   * Compression algorithm used, or null when stored uncompressed.
   * Intentionally nullable so the column can be added now without breaking
   * existing rows; set by a future compression job.
   */
  @Column({ name: 'compression_algorithm', type: 'varchar', length: 32, nullable: true })
  compressionAlgorithm?: string | null;

  /**
   * Compression ratio achieved (compressed_size / original_size), or null.
   * Populated only after compression has been applied (future phase).
   */
  @Column({ name: 'compression_ratio', type: 'numeric', precision: 5, scale: 4, nullable: true })
  compressionRatio?: number | null;

  /**
   * ID of the BvFetchSnapshot that first produced this payload.
   * When a duplicate is detected, this points to the original snapshot.
   */
  @Column({ name: 'snapshot_id', type: 'uuid', nullable: true })
  snapshotId?: string | null;

  /**
   * True when this raw payload record was created as a result of a
   * deduplication match (i.e. the same checksum existed and was reused).
   * Diagnostic only — the record itself is always the canonical one.
   */
  @Column({ name: 'is_duplicate', type: 'boolean', default: false })
  isDuplicate!: boolean;

  /** Wall-clock time at which this record was persisted. */
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
