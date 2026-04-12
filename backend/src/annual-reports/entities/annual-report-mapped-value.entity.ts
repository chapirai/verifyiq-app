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
import { AnnualReportImportEntity } from './annual-report-import.entity';
import { AnnualReportSourceFileEntity } from './annual-report-source-file.entity';
import { AnnualReportParseRunEntity } from './annual-report-parse-run.entity';
import { AnnualReportXbrlFactEntity } from './annual-report-xbrl-fact.entity';

@Entity({ name: 'annual_report_mapped_values' })
@Index(['annualReportImportId'])
@Index(['annualReportImportId', 'statementType'])
export class AnnualReportMappedValueEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'annual_report_import_id', type: 'uuid' })
  annualReportImportId!: string;

  @ManyToOne(() => AnnualReportImportEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'annual_report_import_id' })
  annualReportImport!: AnnualReportImportEntity;

  @Column({ name: 'source_file_id', type: 'uuid', nullable: true })
  sourceFileId?: string | null;

  @ManyToOne(() => AnnualReportSourceFileEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'source_file_id' })
  sourceFile?: AnnualReportSourceFileEntity | null;

  @Column({ name: 'parse_run_id', type: 'bigint', nullable: true })
  parseRunId?: string | null;

  @ManyToOne(() => AnnualReportParseRunEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'parse_run_id' })
  parseRun?: AnnualReportParseRunEntity | null;

  @Column({ name: 'fact_id', type: 'bigint', nullable: true })
  factId?: string | null;

  @ManyToOne(() => AnnualReportXbrlFactEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'fact_id' })
  fact?: AnnualReportXbrlFactEntity | null;

  @Column({ name: 'org_number', type: 'varchar', length: 64, nullable: true })
  orgNumber?: string | null;

  @Column({ name: 'fiscal_year', type: 'int', nullable: true })
  fiscalYear?: number | null;

  @Column({ name: 'document_type', type: 'varchar', length: 32 })
  documentType!: string;

  @Column({ name: 'statement_type', type: 'varchar', length: 64, nullable: true })
  statementType?: string | null;

  @Column({ name: 'value_code', type: 'varchar', length: 128 })
  valueCode!: string;

  @Column({ name: 'value_label', type: 'text', nullable: true })
  valueLabel?: string | null;

  @Column({ name: 'value_text', type: 'text', nullable: true })
  valueText?: string | null;

  @Column({ name: 'value_numeric', type: 'decimal', precision: 30, scale: 10, nullable: true })
  valueNumeric?: string | null;

  @Column({ name: 'value_date', type: 'date', nullable: true })
  valueDate?: Date | null;

  @Column({ name: 'currency', type: 'varchar', length: 16, nullable: true })
  currency?: string | null;

  @Column({ name: 'period_start', type: 'date', nullable: true })
  periodStart?: Date | null;

  @Column({ name: 'period_end', type: 'date', nullable: true })
  periodEnd?: Date | null;

  @Column({ name: 'instant_date', type: 'date', nullable: true })
  instantDate?: Date | null;

  @Column({ name: 'priority_rank', type: 'int', default: 0 })
  priorityRank!: number;

  @Column({ name: 'mapping_rule', type: 'varchar', length: 256, nullable: true })
  mappingRule?: string | null;

  @Column({ name: 'mapping_confidence', type: 'decimal', precision: 5, scale: 4, nullable: true })
  mappingConfidence?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
