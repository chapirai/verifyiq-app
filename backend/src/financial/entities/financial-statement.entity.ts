import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'financial_statements' })
@Index(['tenantId', 'organisationNumber', 'fiscalYear'], { unique: true })
@Index(['tenantId', 'organisationNumber'])
export class FinancialStatementEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'organisation_number', type: 'varchar', length: 32 })
  organisationNumber!: string;

  @Column({ name: 'company_id', type: 'uuid', nullable: true })
  companyId!: string | null;

  @Column({ name: 'fiscal_year', type: 'varchar', length: 16 })
  fiscalYear!: string;

  @Column({ name: 'fiscal_year_start', type: 'date', nullable: true })
  fiscalYearStart!: Date | null;

  @Column({ name: 'fiscal_year_end', type: 'date', nullable: true })
  fiscalYearEnd!: Date | null;

  @Column({ name: 'report_type', type: 'varchar', length: 64, nullable: true })
  reportType!: string | null;

  @Column({ name: 'currency', type: 'varchar', length: 8, default: 'SEK' })
  currency!: string;

  @Column({ name: 'revenue', type: 'decimal', precision: 20, scale: 2, nullable: true })
  revenue!: string | null;

  @Column({ name: 'operating_result', type: 'decimal', precision: 20, scale: 2, nullable: true })
  operatingResult!: string | null;

  @Column({ name: 'net_result', type: 'decimal', precision: 20, scale: 2, nullable: true })
  netResult!: string | null;

  @Column({ name: 'total_assets', type: 'decimal', precision: 20, scale: 2, nullable: true })
  totalAssets!: string | null;

  @Column({ name: 'total_equity', type: 'decimal', precision: 20, scale: 2, nullable: true })
  totalEquity!: string | null;

  @Column({ name: 'total_liabilities', type: 'decimal', precision: 20, scale: 2, nullable: true })
  totalLiabilities!: string | null;

  @Column({ name: 'cash_and_equivalents', type: 'decimal', precision: 20, scale: 2, nullable: true })
  cashAndEquivalents!: string | null;

  @Column({ name: 'number_of_employees', type: 'integer', nullable: true })
  numberOfEmployees!: number | null;

  @Column({ name: 'ratios', type: 'jsonb', default: () => "'{}'::jsonb" })
  ratios!: Record<string, unknown>;

  @Column({ name: 'raw_data', type: 'jsonb', default: () => "'{}'::jsonb" })
  rawData!: Record<string, unknown>;

  @Column({ name: 'source_type', type: 'varchar', length: 64, nullable: true })
  sourceType!: string | null;

  @Column({ name: 'document_id', type: 'uuid', nullable: true })
  documentId!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
