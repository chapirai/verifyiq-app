import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'bv_bulk_companies_staging' })
@Index(['fileRunId', 'identityValue'])
export class BvBulkCompanyStagingEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'file_run_id', type: 'uuid' })
  fileRunId!: string;

  @Column({ name: 'organisation_identity_raw', type: 'text', nullable: true })
  organisationIdentityRaw!: string | null;

  @Column({ name: 'identity_value', type: 'varchar', length: 64, nullable: true })
  identityValue!: string | null;

  @Column({ name: 'identity_type', type: 'varchar', length: 64, nullable: true })
  identityType!: string | null;

  @Column({ name: 'namnskyddslopnummer', type: 'varchar', length: 64, nullable: true })
  namnskyddslopnummer!: string | null;

  @Column({ name: 'registration_country_code', type: 'varchar', length: 16, nullable: true })
  registrationCountryCode!: string | null;

  @Column({ name: 'organisation_names_raw', type: 'text', nullable: true })
  organisationNamesRaw!: string | null;

  @Column({ name: 'organisation_form_code', type: 'varchar', length: 64, nullable: true })
  organisationFormCode!: string | null;

  @Column({ name: 'deregistration_date', type: 'date', nullable: true })
  deregistrationDate!: string | null;

  @Column({ name: 'deregistration_reason_code', type: 'varchar', length: 64, nullable: true })
  deregistrationReasonCode!: string | null;

  @Column({ name: 'deregistration_reason_text', type: 'text', nullable: true })
  deregistrationReasonText!: string | null;

  @Column({ name: 'restructuring_raw', type: 'text', nullable: true })
  restructuringRaw!: string | null;

  @Column({ name: 'registration_date', type: 'date', nullable: true })
  registrationDate!: string | null;

  @Column({ name: 'business_description', type: 'text', nullable: true })
  businessDescription!: string | null;

  @Column({ name: 'postal_address_raw', type: 'text', nullable: true })
  postalAddressRaw!: string | null;

  @Column({ name: 'delivery_address', type: 'text', nullable: true })
  deliveryAddress!: string | null;

  @Column({ name: 'co_address', type: 'text', nullable: true })
  coAddress!: string | null;

  @Column({ name: 'postal_code', type: 'varchar', length: 32, nullable: true })
  postalCode!: string | null;

  @Column({ name: 'city', type: 'varchar', length: 255, nullable: true })
  city!: string | null;

  @Column({ name: 'country_code', type: 'varchar', length: 16, nullable: true })
  countryCode!: string | null;

  @Column({ name: 'content_hash', type: 'varchar', length: 64, nullable: true })
  contentHash!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

