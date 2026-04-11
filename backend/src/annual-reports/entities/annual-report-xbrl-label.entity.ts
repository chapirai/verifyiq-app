import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AnnualReportParseRunEntity } from './annual-report-parse-run.entity';

@Entity({ name: 'annual_report_xbrl_labels' })
@Index(['parseRunId'])
export class AnnualReportXbrlLabelEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'parse_run_id', type: 'bigint' })
  parseRunId!: string;

  @ManyToOne(() => AnnualReportParseRunEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parse_run_id' })
  parseRun!: AnnualReportParseRunEntity;

  @Column({ name: 'concept_qname', type: 'varchar', length: 1024 })
  conceptQname!: string;

  @Column({ name: 'lang', type: 'varchar', length: 16, default: 'en' })
  lang!: string;

  @Column({
    name: 'label_role',
    type: 'varchar',
    length: 512,
    default: 'http://www.xbrl.org/2003/role/label',
  })
  labelRole!: string;

  @Column({ name: 'label_text', type: 'text' })
  labelText!: string;
}
