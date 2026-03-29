import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * P02-T03: Company attribute version history entity.
 *
 * Captures a point-in-time snapshot of a normalized company's attributes at
 * each version change.  Created by NormalizationService whenever a normalized
 * company record is updated with new attribute values.
 *
 * Use this table to:
 *  - Reconstruct the company's state at any historical version.
 *  - Detect which fields changed between consecutive versions.
 *  - Provide full lineage: version → snapshot → raw payload.
 */
@Entity({ name: 'company_versions' })
@Index(['tenantId', 'orgNumber', 'version'])
@Index(['tenantId', 'orgNumber', 'createdAt'])
@Index(['snapshotId'])
export class CompanyVersionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Tenant scope — all queries must filter by this column. */
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  /** Canonical organisation number — links to NormalizedCompanyEntity. */
  @Column({ name: 'org_number', type: 'varchar', length: 64 })
  orgNumber!: string;

  /** UUID of the parent NormalizedCompanyEntity record. */
  @Column({ name: 'normalized_company_id', type: 'uuid' })
  normalizedCompanyId!: string;

  /**
   * Version number at the time this record was written.
   * Matches the `version` field on NormalizedCompanyEntity at the moment of change.
   */
  @Column({ name: 'version', type: 'integer' })
  version!: number;

  /**
   * Full snapshot of the company's normalized attributes at this version.
   * Stored as JSONB to allow flexible schema evolution without additional columns.
   */
  @Column({ name: 'attributes', type: 'jsonb' })
  attributes!: Record<string, unknown>;

  /**
   * List of attribute field names that changed compared to the previous version.
   * Empty array for the initial (version 1) record.
   */
  @Column({ name: 'changed_fields', type: 'jsonb', default: () => "'[]'::jsonb" })
  changedFields!: string[];

  /**
   * Schema version of the attributes snapshot.
   * Useful when deserializing historical records after a schema change.
   */
  @Column({ name: 'schema_version', type: 'varchar', length: 16, default: '1' })
  schemaVersion!: string;

  /**
   * ID of the BvFetchSnapshot that produced this version's data.
   * Provides lineage: version → snapshot → raw payload.
   */
  @Column({ name: 'snapshot_id', type: 'uuid', nullable: true })
  snapshotId?: string | null;

  /**
   * ID of the BvRawPayload that was the source for this version.
   * Null when raw payload storage was unavailable at normalization time.
   */
  @Column({ name: 'raw_payload_id', type: 'uuid', nullable: true })
  rawPayloadId?: string | null;

  /** Wall-clock time when this version record was created. */
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
