import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AnnualReportParseRunEntity } from './annual-report-parse-run.entity';

@Entity({ name: 'annual_report_xbrl_facts' })
@Index(['parseRunId'])
@Index(['parseRunId', 'conceptQname'])
export class AnnualReportXbrlFactEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'parse_run_id', type: 'bigint' })
  parseRunId!: string;

  @ManyToOne(() => AnnualReportParseRunEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parse_run_id' })
  parseRun!: AnnualReportParseRunEntity;

  @Column({ name: 'sequence_index', type: 'int' })
  sequenceIndex!: number;

  @Column({ name: 'context_ref', type: 'varchar', length: 512, nullable: true })
  contextRef?: string | null;

  @Column({ name: 'unit_ref', type: 'varchar', length: 512, nullable: true })
  unitRef?: string | null;

  @Column({ name: 'concept_qname', type: 'varchar', length: 1024 })
  conceptQname!: string;

  @Column({ name: 'value_text', type: 'text', nullable: true })
  valueText?: string | null;

  @Column({ name: 'value_numeric', type: 'decimal', precision: 30, scale: 10, nullable: true })
  valueNumeric?: string | null;

  @Column({ name: 'decimals', type: 'int', nullable: true })
  decimals?: number | null;

  @Column({ name: 'precision_value', type: 'int', nullable: true })
  precisionValue?: number | null;

  @Column({ name: 'is_nil', type: 'boolean', default: false })
  isNil!: boolean;

  @Column({ name: 'footnotes', type: 'jsonb', default: () => "'[]'::jsonb" })
  footnotes!: unknown[];

  @Column({ name: 'raw_json', type: 'jsonb', default: () => "'{}'::jsonb" })
  rawJson!: Record<string, unknown>;
}
