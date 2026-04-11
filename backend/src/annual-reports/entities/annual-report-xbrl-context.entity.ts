import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AnnualReportParseRunEntity } from './annual-report-parse-run.entity';

@Entity({ name: 'annual_report_xbrl_contexts' })
@Index(['parseRunId'])
export class AnnualReportXbrlContextEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'parse_run_id', type: 'bigint' })
  parseRunId!: string;

  @ManyToOne(() => AnnualReportParseRunEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parse_run_id' })
  parseRun!: AnnualReportParseRunEntity;

  @Column({ name: 'xbrl_context_id', type: 'varchar', length: 512 })
  xbrlContextId!: string;

  @Column({ name: 'period_instant', type: 'date', nullable: true })
  periodInstant?: Date | null;

  @Column({ name: 'period_start', type: 'date', nullable: true })
  periodStart?: Date | null;

  @Column({ name: 'period_end', type: 'date', nullable: true })
  periodEnd?: Date | null;

  @Column({ name: 'dimensions', type: 'jsonb', default: () => "'{}'::jsonb" })
  dimensions!: Record<string, string>;

  @Column({ name: 'raw_json', type: 'jsonb', default: () => "'{}'::jsonb" })
  rawJson!: Record<string, unknown>;
}
