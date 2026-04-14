import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'annual_report_api_financial_rows' })
@Index(['tenantId', 'organisationsnummer', 'fiscalYear'])
@Index(['statementType', 'valueCode'])
export class AnnualReportApiFinancialRowEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'organisationsnummer', type: 'varchar', length: 64 })
  organisationsnummer!: string;

  @Column({ name: 'fiscal_year', type: 'int', nullable: true })
  fiscalYear?: number | null;

  @Column({ name: 'statement_type', type: 'varchar', length: 64 })
  statementType!: string;

  @Column({ name: 'value_code', type: 'varchar', length: 128 })
  valueCode!: string;

  @Column({ name: 'value_label', type: 'text', nullable: true })
  valueLabel?: string | null;

  @Column({ name: 'period_kind', type: 'varchar', length: 32 })
  periodKind!: string;

  @Column({ name: 'value_numeric', type: 'decimal', precision: 30, scale: 10, nullable: true })
  valueNumeric?: string | null;

  @Column({ name: 'value_text', type: 'text', nullable: true })
  valueText?: string | null;

  @Column({ name: 'currency_code', type: 'varchar', length: 16, nullable: true })
  currencyCode?: string | null;

  @Column({ name: 'source_header_id', type: 'uuid' })
  sourceHeaderId!: string;

  @Column({ name: 'source_import_id', type: 'uuid', nullable: true })
  sourceImportId?: string | null;

  @Column({ name: 'source_fact_ids', type: 'bigint', array: true, default: '{}' })
  sourceFactIds!: string[];

  @Column({ name: 'ranking_score', type: 'int', default: 0 })
  rankingScore!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
