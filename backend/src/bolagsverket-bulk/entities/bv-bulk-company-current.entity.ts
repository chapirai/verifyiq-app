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
@Index(['seedState'])
export class BvBulkCompanyCurrentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organisation_number', type: 'varchar', length: 32 })
  organisationNumber!: string;

  @Column({ name: 'identity_type', type: 'varchar', length: 64, nullable: true })
  identityType!: string | null;

  @Column({ name: 'name_primary', type: 'varchar', length: 255, nullable: true })
  namePrimary!: string | null;

  @Column({ name: 'name_all_jsonb', type: 'jsonb', default: () => "'[]'::jsonb" })
  nameAllJsonb!: Array<Record<string, unknown>>;

  @Column({ name: 'organisation_form_code', type: 'varchar', length: 64, nullable: true })
  organisationFormCode!: string | null;

  @Column({ name: 'organisation_form_text', type: 'varchar', length: 255, nullable: true })
  organisationFormText!: string | null;

  @Column({ name: 'registration_date', type: 'date', nullable: true })
  registrationDate!: string | null;

  @Column({ name: 'deregistration_date', type: 'date', nullable: true })
  deregistrationDate!: string | null;

  @Column({ name: 'deregistration_reason_code', type: 'varchar', length: 64, nullable: true })
  deregistrationReasonCode!: string | null;

  @Column({ name: 'deregistration_reason_text', type: 'text', nullable: true })
  deregistrationReasonText!: string | null;

  @Column({ name: 'restructuring_status_jsonb', type: 'jsonb', default: () => "'{}'::jsonb" })
  restructuringStatusJsonb!: Record<string, unknown>;

  @Column({ name: 'business_description', type: 'text', nullable: true })
  businessDescription!: string | null;

  @Column({ name: 'postal_address_jsonb', type: 'jsonb', default: () => "'{}'::jsonb" })
  postalAddressJsonb!: Record<string, unknown>;

  @Column({ name: 'registrations_country_code', type: 'varchar', length: 16, nullable: true })
  registrationsCountryCode!: string | null;

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

