import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/**
 * P02-T03: Freshness status of the normalized company record.
 *
 * - 'fresh'    – Normalized data was updated within the cache TTL window.
 * - 'stale'    – Data is older than the TTL but normalization has not failed.
 * - 'degraded' – Last normalization attempt failed; previous version preserved.
 */
export type NormalizedCompanyFreshnessStatus = 'fresh' | 'stale' | 'degraded';

/**
 * P02-T03: Normalized company serving layer entity.
 *
 * Represents the canonical, tenant-scoped, operational view of a company.
 * This is the single source of truth for UI queries (profile pages, search,
 * recent lists).  It is populated and refreshed by NormalizationService after
 * each successful Bolagsverket fetch snapshot.
 *
 * Key design decisions:
 *  - Canonical identity: (tenant_id, org_number) is unique and immutable.
 *  - Raw payload content is never stored here; lineage is maintained via
 *    last_snapshot_id and last_raw_payload_id FKs.
 *  - Freshness metadata allows consumers to surface staleness warnings.
 *  - Version counter is incremented on every attribute change to enable
 *    history queries via CompanyVersionEntity.
 */
@Entity({ name: 'normalized_companies' })
@Unique('uq_normalized_companies_tenant_org', ['tenantId', 'orgNumber'])
@Index(['tenantId', 'updatedAt'])
@Index(['tenantId', 'legalName'])
@Index(['tenantId', 'freshnessStatus'])
export class NormalizedCompanyEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Tenant scope — all queries must filter by this column. */
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  /**
   * Canonical organisation number — the immutable primary business identifier.
   * All versions of a company share the same org_number within a tenant.
   */
  @Column({ name: 'org_number', type: 'varchar', length: 64 })
  orgNumber!: string;

  // ── Normalized business attributes ─────────────────────────────────────────

  /** Registered legal name of the company. */
  @Column({ name: 'legal_name', type: 'varchar', length: 255 })
  legalName!: string;

  /** Company form (e.g. "Aktiebolag", "Handelsbolag"). Nullable when unknown. */
  @Column({ name: 'company_form', type: 'varchar', length: 100, nullable: true })
  companyForm?: string | null;

  /** Current registration status (e.g. "Aktiv", "Avregistrerad"). */
  @Column({ name: 'status', type: 'varchar', length: 100, nullable: true })
  status?: string | null;

  /** ISO 3166-1 alpha-2 country code. Defaults to 'SE'. */
  @Column({ name: 'country_code', type: 'varchar', length: 2, default: 'SE' })
  countryCode!: string;

  /** Date when the company was registered with the authorities. */
  @Column({ name: 'registered_at', type: 'timestamptz', nullable: true })
  registeredAt?: Date | null;

  /** Structured address information extracted from the provider payload. */
  @Column({ name: 'address', type: 'jsonb', default: () => "'{}'::jsonb" })
  address!: Record<string, unknown>;

  /** Narrative description of the company's business activities. */
  @Column({ name: 'business_description', type: 'text', nullable: true })
  businessDescription?: string | null;

  /** Signatory power text extracted from the provider data. */
  @Column({ name: 'signatory_text', type: 'text', nullable: true })
  signatoryText?: string | null;

  /** Officers/board members extracted from the provider data. */
  @Column({ name: 'officers', type: 'jsonb', default: () => "'[]'::jsonb" })
  officers!: Array<Record<string, unknown>>;

  /** Share capital and equity information. */
  @Column({ name: 'share_information', type: 'jsonb', default: () => "'{}'::jsonb" })
  shareInformation!: Record<string, unknown>;

  /** Financial reports summary (not raw payload content). */
  @Column({ name: 'financial_reports', type: 'jsonb', default: () => "'[]'::jsonb" })
  financialReports!: Array<Record<string, unknown>>;

  // ── Freshness and lineage metadata ─────────────────────────────────────────

  /**
   * Monotonically increasing version counter.
   * Incremented on every attribute change to support version-history queries.
   */
  @Column({ name: 'version', type: 'integer', default: 1 })
  version!: number;

  /**
   * Schema version of the normalised attribute structure.
   * Increment when the column layout or attribute semantics change.
   */
  @Column({ name: 'schema_version', type: 'varchar', length: 16, default: '1' })
  schemaVersion!: string;

  /**
   * Freshness classification of the current normalized record.
   * Updated by NormalizationService after each normalization attempt.
   */
  @Column({ name: 'freshness_status', type: 'varchar', length: 16, default: 'fresh' })
  freshnessStatus!: NormalizedCompanyFreshnessStatus;

  /**
   * Timestamp of the last successful normalization.
   * Null until the first successful normalization run.
   */
  @Column({ name: 'last_normalized_at', type: 'timestamptz', nullable: true })
  lastNormalizedAt?: Date | null;

  /**
   * ID of the BvFetchSnapshot that produced the current version's data.
   * Null when the record was never successfully normalized from a snapshot.
   */
  @Column({ name: 'last_snapshot_id', type: 'uuid', nullable: true })
  lastSnapshotId?: string | null;

  /**
   * ID of the BvRawPayload that was the source for the current version.
   * Null when raw payload storage was unavailable at normalization time.
   */
  @Column({ name: 'last_raw_payload_id', type: 'uuid', nullable: true })
  lastRawPayloadId?: string | null;

  /** Wall-clock time when this record was first created. */
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  /** Wall-clock time of the most recent attribute update. */
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
