import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type BvBulkSeedState =
  | 'BULK_ONLY'
  | 'ENRICH_QUEUED'
  | 'ENRICHING'
  | 'ENRICHED'
  | 'ENRICH_FAILED'
  | 'STALE_ENRICHED';

@Entity({ name: 'bv_bulk_company_current' })
@Index(['organisationNumber'], { unique: true })
@Index(['sourceIdentityKey'], { unique: true })
@Index(['seedState'])
export class BvBulkCompanyCurrentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organisation_number', type: 'varchar', length: 32 })
  organisationNumber!: string;

  @Column({ name: 'source_identity_key', type: 'varchar', length: 160, nullable: true })
  sourceIdentityKey!: string | null;

  @Column({ name: 'identity_value', type: 'varchar', length: 64, nullable: true })
  identityValue!: string | null;

  @Column({ name: 'identity_type_code', type: 'varchar', length: 64, nullable: true })
  identityTypeCode!: string | null;

  @Column({ name: 'identity_type_label', type: 'varchar', length: 255, nullable: true })
  identityTypeLabel!: string | null;

  @Column({ name: 'personal_identity_number', type: 'varchar', length: 32, nullable: true })
  personalIdentityNumber!: string | null;

  @Column({ name: 'name_protection_sequence_number', type: 'varchar', length: 64, nullable: true })
  nameProtectionSequenceNumber!: string | null;

  @Column({ name: 'identity_type', type: 'varchar', length: 64, nullable: true })
  identityType!: string | null;

  @Column({ name: 'name_primary', type: 'varchar', length: 255, nullable: true })
  namePrimary!: string | null;

  @Column({ name: 'primary_name_type_code', type: 'varchar', length: 64, nullable: true })
  primaryNameTypeCode!: string | null;

  @Column({ name: 'primary_name_type_label', type: 'varchar', length: 255, nullable: true })
  primaryNameTypeLabel!: string | null;

  @Column({ name: 'name_all_jsonb', type: 'jsonb', default: () => "'[]'::jsonb" })
  nameAllJsonb!: Array<Record<string, unknown>>;

  @Column({ name: 'organisation_form_code', type: 'varchar', length: 64, nullable: true })
  organisationFormCode!: string | null;

  @Column({ name: 'organisation_form_text', type: 'varchar', length: 255, nullable: true })
  organisationFormText!: string | null;

  @Column({ name: 'legal_form_label', type: 'varchar', length: 255, nullable: true })
  legalFormLabel!: string | null;

  @Column({ name: 'registration_date', type: 'date', nullable: true })
  registrationDate!: string | null;

  @Column({ name: 'deregistration_date', type: 'date', nullable: true })
  deregistrationDate!: string | null;

  @Column({ name: 'deregistration_reason_code', type: 'varchar', length: 64, nullable: true })
  deregistrationReasonCode!: string | null;

  @Column({ name: 'deregistration_reason_text', type: 'text', nullable: true })
  deregistrationReasonText!: string | null;

  @Column({ name: 'deregistration_reason_label', type: 'varchar', length: 255, nullable: true })
  deregistrationReasonLabel!: string | null;

  @Column({ name: 'restructuring_status_jsonb', type: 'jsonb', default: () => "'{}'::jsonb" })
  restructuringStatusJsonb!: Record<string, unknown>;

  @Column({ name: 'business_description', type: 'text', nullable: true })
  businessDescription!: string | null;

  @Column({ name: 'postal_address_jsonb', type: 'jsonb', default: () => "'{}'::jsonb" })
  postalAddressJsonb!: Record<string, unknown>;

  @Column({ name: 'raw_postadress', type: 'text', nullable: true })
  rawPostadress!: string | null;

  @Column({ name: 'postal_parse_warning', type: 'text', nullable: true })
  postalParseWarning!: string | null;

  @Column({ name: 'postal_address_line', type: 'text', nullable: true })
  postalAddressLine!: string | null;

  @Column({ name: 'postal_co_address', type: 'text', nullable: true })
  postalCoAddress!: string | null;

  @Column({ name: 'postal_city', type: 'varchar', length: 255, nullable: true })
  postalCity!: string | null;

  @Column({ name: 'postal_code', type: 'varchar', length: 32, nullable: true })
  postalCode!: string | null;

  @Column({ name: 'postal_country_code', type: 'varchar', length: 16, nullable: true })
  postalCountryCode!: string | null;

  @Column({ name: 'postal_country_label', type: 'varchar', length: 255, nullable: true })
  postalCountryLabel!: string | null;

  @Column({ name: 'registrations_country_code', type: 'varchar', length: 16, nullable: true })
  registrationsCountryCode!: string | null;

  @Column({ name: 'registration_country_label', type: 'varchar', length: 255, nullable: true })
  registrationCountryLabel!: string | null;

  @Column({ name: 'has_active_restructuring_or_windup', type: 'boolean', default: false })
  hasActiveRestructuringOrWindup!: boolean;

  @Column({ name: 'active_restructuring_codes', type: 'jsonb', default: () => "'[]'::jsonb" })
  activeRestructuringCodes!: string[];

  @Column({ name: 'active_restructuring_labels', type: 'jsonb', default: () => "'[]'::jsonb" })
  activeRestructuringLabels!: string[];

  @Column({ name: 'source_ingestion_run_id', type: 'uuid', nullable: true })
  sourceIngestionRunId!: string | null;

  @Column({ name: 'source_raw_line_number', type: 'integer', nullable: true })
  sourceRawLineNumber!: number | null;

  @Column({ name: 'source_file_run_id', type: 'uuid', nullable: true })
  sourceFileRunId!: string | null;

  @Column({ name: 'source_last_seen_at', type: 'timestamptz', nullable: true })
  sourceLastSeenAt!: Date | null;

  @Column({ name: 'first_seen_at', type: 'timestamptz', nullable: true })
  firstSeenAt!: Date | null;

  @Column({ name: 'last_seen_at', type: 'timestamptz', nullable: true })
  lastSeenAt!: Date | null;

  @Column({ name: 'current_record_hash', type: 'varchar', length: 64, nullable: true })
  currentRecordHash!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'is_deregistered', type: 'boolean', default: false })
  isDeregistered!: boolean;

  @Column({ name: 'seed_state', type: 'varchar', length: 32, default: 'BULK_ONLY' })
  seedState!: BvBulkSeedState;

  @Column({ name: 'deep_data_fresh_at', type: 'timestamptz', nullable: true })
  deepDataFreshAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

