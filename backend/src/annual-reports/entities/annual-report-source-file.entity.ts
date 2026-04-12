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
import { AnnualReportFileEntryEntity } from './annual-report-file-entry.entity';
import { AnnualReportImportEntity } from './annual-report-import.entity';

export type AnnualReportDocumentType = 'annual_report' | 'audit_report' | 'unknown';
export type AnnualReportSourceParseStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

@Entity({ name: 'annual_report_source_files' })
@Index(['annualReportImportId'])
@Index(['annualReportImportId', 'documentType'])
export class AnnualReportSourceFileEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'annual_report_import_id', type: 'uuid' })
  annualReportImportId!: string;

  @ManyToOne(() => AnnualReportImportEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'annual_report_import_id' })
  annualReportImport!: AnnualReportImportEntity;

  @Column({ name: 'annual_report_file_id', type: 'uuid', nullable: true })
  annualReportFileId?: string | null;

  @ManyToOne(() => AnnualReportFileEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'annual_report_file_id' })
  annualReportFile?: AnnualReportFileEntity | null;

  @Column({ name: 'file_entry_id', type: 'bigint', nullable: true })
  fileEntryId?: string | null;

  @ManyToOne(() => AnnualReportFileEntryEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'file_entry_id' })
  fileEntry?: AnnualReportFileEntryEntity | null;

  @Column({ name: 'document_type', type: 'varchar', length: 32 })
  documentType!: AnnualReportDocumentType;

  @Column({ name: 'original_filename', type: 'text', nullable: true })
  originalFilename?: string | null;

  @Column({ name: 'path_in_archive', type: 'text' })
  pathInArchive!: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 128, nullable: true })
  mimeType?: string | null;

  @Column({ name: 'title', type: 'text', nullable: true })
  title?: string | null;

  @Column({ name: 'file_hash', type: 'varchar', length: 64, nullable: true })
  fileHash?: string | null;

  @Column({ name: 'parse_status', type: 'varchar', length: 32, default: 'pending' })
  parseStatus!: AnnualReportSourceParseStatus;

  @Column({ name: 'parse_error', type: 'text', nullable: true })
  parseError?: string | null;

  @Column({ name: 'period_start', type: 'date', nullable: true })
  periodStart?: Date | null;

  @Column({ name: 'period_end', type: 'date', nullable: true })
  periodEnd?: Date | null;

  @Column({ name: 'fiscal_year', type: 'int', nullable: true })
  fiscalYear?: number | null;

  @Column({ name: 'entity_identifier', type: 'text', nullable: true })
  entityIdentifier?: string | null;

  @Column({ name: 'is_primary_document', type: 'boolean', default: false })
  isPrimaryDocument!: boolean;

  @Column({ name: 'classification_score', type: 'int', nullable: true })
  classificationScore?: number | null;

  @Column({ name: 'classification_reasons', type: 'jsonb', default: () => "'[]'::jsonb" })
  classificationReasons!: unknown[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
