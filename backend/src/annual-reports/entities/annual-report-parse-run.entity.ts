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

export type AnnualReportParseRunStatus = 'running' | 'completed' | 'failed';

@Entity({ name: 'annual_report_parse_runs' })
@Index(['fileId', 'startedAt'])
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
}
