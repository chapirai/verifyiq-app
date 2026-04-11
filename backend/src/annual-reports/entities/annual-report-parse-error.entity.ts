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

@Entity({ name: 'annual_report_parse_errors' })
@Index(['parseRunId'])
export class AnnualReportParseErrorEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'parse_run_id', type: 'bigint', nullable: true })
  parseRunId?: string | null;

  @ManyToOne(() => AnnualReportParseRunEntity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'parse_run_id' })
  parseRun?: AnnualReportParseRunEntity | null;

  @Column({ name: 'file_id', type: 'uuid', nullable: true })
  fileId?: string | null;

  @ManyToOne(() => AnnualReportFileEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'file_id' })
  file?: AnnualReportFileEntity | null;

  @Column({ name: 'phase', type: 'varchar', length: 64 })
  phase!: string;

  @Column({ name: 'code', type: 'varchar', length: 64, nullable: true })
  code?: string | null;

  @Column({ name: 'message', type: 'text' })
  message!: string;

  @Column({ name: 'detail', type: 'jsonb', default: () => "'{}'::jsonb" })
  detail!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
