import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AnnualReportFileEntity } from './annual-report-file.entity';
import { AnnualReportParseRunEntity } from './annual-report-parse-run.entity';
import { AnnualReportImportEntity } from './annual-report-import.entity';

@Entity({ name: 'company_annual_report_headers' })
@Index(['tenantId', 'organisationsnummer', 'extractedAt'])
@Index(['companyId', 'extractedAt'], { where: 'company_id IS NOT NULL' })
@Index(['tenantId', 'organisationsnummer'], { where: 'is_superseded = false' })
export class CompanyAnnualReportHeaderEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'company_id', type: 'uuid', nullable: true })
  companyId?: string | null;

  @Column({ name: 'organisationsnummer', type: 'varchar', length: 64, nullable: true })
  organisationsnummer?: string | null;

  @Column({ name: 'annual_report_file_id', type: 'uuid' })
  annualReportFileId!: string;

  @ManyToOne(() => AnnualReportFileEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'annual_report_file_id' })
  annualReportFile!: AnnualReportFileEntity;

  @Column({ name: 'parse_run_id', type: 'bigint' })
  parseRunId!: string;

  @ManyToOne(() => AnnualReportParseRunEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parse_run_id' })
  parseRun!: AnnualReportParseRunEntity;

  @Column({ name: 'company_name_from_filing', type: 'text', nullable: true })
  companyNameFromFiling?: string | null;

  @Column({ name: 'organisation_number_filing', type: 'varchar', length: 64, nullable: true })
  organisationNumberFiling?: string | null;

  @Column({ name: 'filing_type_hint', type: 'varchar', length: 128, nullable: true })
  filingTypeHint?: string | null;

  @Column({ name: 'report_type_hint', type: 'varchar', length: 128, nullable: true })
  reportTypeHint?: string | null;

  @Column({ name: 'filing_period_start', type: 'date', nullable: true })
  filingPeriodStart?: Date | null;

  @Column({ name: 'filing_period_end', type: 'date', nullable: true })
  filingPeriodEnd?: Date | null;

  @Column({ name: 'currency_code', type: 'varchar', length: 16, nullable: true })
  currencyCode?: string | null;

  @Column({ name: 'source_filename', type: 'varchar', length: 512, nullable: true })
  sourceFilename?: string | null;

  @Column({ name: 'parser_name', type: 'varchar', length: 64 })
  parserName!: string;

  @Column({ name: 'parser_version', type: 'varchar', length: 32 })
  parserVersion!: string;

  @CreateDateColumn({ name: 'extracted_at' })
  extractedAt!: Date;

  @Column({ name: 'is_superseded', type: 'boolean', default: false })
  isSuperseded!: boolean;

  @Column({ name: 'superseded_by_header_id', type: 'uuid', nullable: true })
  supersededByHeaderId?: string | null;

  @ManyToOne(() => CompanyAnnualReportHeaderEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'superseded_by_header_id' })
  supersededByHeader?: CompanyAnnualReportHeaderEntity | null;

  @Column({ name: 'metadata', type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @Column({ name: 'annual_report_import_id', type: 'uuid', nullable: true })
  annualReportImportId?: string | null;

  @ManyToOne(() => AnnualReportImportEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'annual_report_import_id' })
  annualReportImport?: AnnualReportImportEntity | null;

  @Column({ name: 'primary_context_id', type: 'varchar', length: 512, nullable: true })
  primaryContextId?: string | null;

  @Column({ name: 'primary_source_file_id', type: 'uuid', nullable: true })
  primarySourceFileId?: string | null;

  @Column({ name: 'fiscal_year', type: 'int', nullable: true })
  fiscalYear?: number | null;
}
