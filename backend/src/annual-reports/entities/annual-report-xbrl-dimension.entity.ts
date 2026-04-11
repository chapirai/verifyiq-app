import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AnnualReportXbrlFactEntity } from './annual-report-xbrl-fact.entity';

@Entity({ name: 'annual_report_xbrl_dimensions' })
@Index(['factId'])
export class AnnualReportXbrlDimensionEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'fact_id', type: 'bigint' })
  factId!: string;

  @ManyToOne(() => AnnualReportXbrlFactEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fact_id' })
  fact!: AnnualReportXbrlFactEntity;

  @Column({ name: 'dimension_qname', type: 'varchar', length: 1024 })
  dimensionQname!: string;

  @Column({ name: 'member_qname', type: 'varchar', length: 1024, nullable: true })
  memberQname?: string | null;

  @Column({ name: 'raw_json', type: 'jsonb', default: () => "'{}'::jsonb" })
  rawJson!: Record<string, unknown>;
}
