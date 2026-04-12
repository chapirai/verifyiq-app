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
import { AnnualReportImportEntity } from './annual-report-import.entity';
import { AnnualReportSourceFileEntity } from './annual-report-source-file.entity';

export type AnnualReportParseRunStatus = 'running' | 'completed' | 'failed';

@Entity({ name: 'annual_report_parse_runs' })
@Index(['fileId', 'startedAt'])
@Index(['annualReportImportId'])
export class AnnualReportParseRunEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'file_id', type: 'uuid' })
  fileId!: string;

  @ManyToOne(() => AnnualReportFileEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'file_id' })
  file!: AnnualReportFileEntity;

  @Column({ name: 'parser_name', type: 'varchar', length: 64, default: 'arelle' })
  parserName!: string;

  @Column({ name: 'parser_version', type: 'varchar', length: 32 })
  parserVersion!: string;

  @Column({ name: 'status', type: 'varchar', length: 32, default: 'running' })
  status!: AnnualReportParseRunStatus;

  @Column({ name: 'fact_count', type: 'int', default: 0 })
  factCount!: number;

  @Column({ name: 'context_count', type: 'int', default: 0 })
  contextCount!: number;

  @Column({ name: 'unit_count', type: 'int', default: 0 })
  unitCount!: number;

  @CreateDateColumn({ name: 'started_at' })
  startedAt!: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date | null;

  @Column({ name: 'source_ixbrl_path', type: 'text', nullable: true })
  sourceIxbrlPath?: string | null;

  @Column({ name: 'raw_model_summary', type: 'jsonb', default: () => "'{}'::jsonb" })
  rawModelSummary!: Record<string, unknown>;

  @Column({ name: 'annual_report_import_id', type: 'uuid', nullable: true })
  annualReportImportId?: string | null;

  @ManyToOne(() => AnnualReportImportEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'annual_report_import_id' })
  annualReportImport?: AnnualReportImportEntity | null;

  @Column({ name: 'source_file_id', type: 'uuid', nullable: true })
  sourceFileId?: string | null;

  @ManyToOne(() => AnnualReportSourceFileEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'source_file_id' })
  sourceFile?: AnnualReportSourceFileEntity | null;

  @Column({ name: 'document_type', type: 'varchar', length: 32, nullable: true })
  documentType?: string | null;
}
