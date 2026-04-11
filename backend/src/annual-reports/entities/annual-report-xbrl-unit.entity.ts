import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AnnualReportParseRunEntity } from './annual-report-parse-run.entity';

@Entity({ name: 'annual_report_xbrl_units' })
@Index(['parseRunId'])
export class AnnualReportXbrlUnitEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'parse_run_id', type: 'bigint' })
  parseRunId!: string;

  @ManyToOne(() => AnnualReportParseRunEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parse_run_id' })
  parseRun!: AnnualReportParseRunEntity;

  @Column({ name: 'xbrl_unit_id', type: 'varchar', length: 512 })
  xbrlUnitId!: string;

  @Column({ name: 'measures', type: 'jsonb', default: () => "'[]'::jsonb" })
  measures!: string[];

  @Column({ name: 'raw_json', type: 'jsonb', default: () => "'{}'::jsonb" })
  rawJson!: Record<string, unknown>;
}
