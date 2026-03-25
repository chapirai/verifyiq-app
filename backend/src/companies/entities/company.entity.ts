import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'companies' })
@Index(['tenantId', 'organisationNumber'], { unique: true })
@Index(['tenantId', 'status'])
@Index(['tenantId', 'legalName'])
export class CompanyEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'organisation_number', type: 'varchar', length: 64 })
  organisationNumber!: string;

  @Column({ name: 'legal_name', type: 'varchar', length: 255 })
  legalName!: string;

  @Column({ name: 'company_form', type: 'varchar', length: 100, nullable: true })
  companyForm?: string | null;

  @Column({ name: 'status', type: 'varchar', length: 100, nullable: true })
  status?: string | null;

  @Column({ name: 'registered_at', type: 'timestamptz', nullable: true })
  registeredAt?: Date | null;

  @Column({ name: 'country_code', type: 'varchar', length: 2, default: 'SE' })
  countryCode!: string;

  @Column({ name: 'business_description', type: 'text', nullable: true })
  businessDescription?: string | null;

  @Column({ name: 'signatory_text', type: 'text', nullable: true })
  signatoryText?: string | null;

  @Column({ name: 'officers', type: 'jsonb', default: () => "'[]'::jsonb" })
  officers!: Array<Record<string, unknown>>;

  @Column({ name: 'share_information', type: 'jsonb', default: () => "'{}'::jsonb" })
  shareInformation!: Record<string, unknown>;

  @Column({ name: 'financial_reports', type: 'jsonb', default: () => "'[]'::jsonb" })
  financialReports!: Array<Record<string, unknown>>;

  @Column({ name: 'source_payload_summary', type: 'jsonb', default: () => "'{}'::jsonb" })
  sourcePayloadSummary!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
