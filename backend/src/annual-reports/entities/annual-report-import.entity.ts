import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AnnualReportFileEntity } from './annual-report-file.entity';

export type AnnualReportImportStatus =
  | 'pending'
  | 'extracting'
  | 'parsing'
  | 'completed'
  | 'partial'
  | 'failed';

@Entity({ name: 'annual_report_imports' })
@Index(['tenantId', 'annualReportFileId'])
@Index(['tenantId', 'organisationsnummer'])
export class AnnualReportImportEntity {
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

  @Column({ name: 'source_zip_filename', type: 'varchar', length: 512 })
  sourceZipFilename!: string;

  @Column({ name: 'source_zip_storage_key', type: 'text', nullable: true })
  sourceZipStorageKey?: string | null;

  @Column({ name: 'import_status', type: 'varchar', length: 32, default: 'pending' })
  importStatus!: AnnualReportImportStatus;

  @Column({ name: 'period_start', type: 'date', nullable: true })
  periodStart?: Date | null;

  @Column({ name: 'period_end', type: 'date', nullable: true })
  periodEnd?: Date | null;

  @Column({ name: 'fiscal_year', type: 'int', nullable: true })
  fiscalYear?: number | null;

  @Column({ name: 'primary_source_file_id', type: 'uuid', nullable: true })
  primarySourceFileId?: string | null;

  @Column({ name: 'primary_context_id', type: 'varchar', length: 512, nullable: true })
  primaryContextId?: string | null;

  @Column({ name: 'primary_parse_run_id', type: 'bigint', nullable: true })
  primaryParseRunId?: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string | null;

  @Column({ name: 'validation_flags', type: 'jsonb', default: () => "'{}'::jsonb" })
  validationFlags!: Record<string, unknown>;

  @Column({ name: 'imported_at', type: 'timestamptz' })
  importedAt!: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
