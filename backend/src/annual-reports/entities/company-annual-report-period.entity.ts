import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CompanyAnnualReportHeaderEntity } from './company-annual-report-header.entity';

@Entity({ name: 'company_annual_report_periods' })
@Index(['headerId'])
export class CompanyAnnualReportPeriodEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'header_id', type: 'uuid' })
  headerId!: string;

  @ManyToOne(() => CompanyAnnualReportHeaderEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'header_id' })
  header!: CompanyAnnualReportHeaderEntity;

  @Column({ name: 'period_label', type: 'varchar', length: 128 })
  periodLabel!: string;

  @Column({ name: 'period_start', type: 'date', nullable: true })
  periodStart?: Date | null;

  @Column({ name: 'period_end', type: 'date', nullable: true })
  periodEnd?: Date | null;

  @Column({ name: 'is_instant', type: 'boolean', default: false })
  isInstant!: boolean;

  @Column({ name: 'context_ids', type: 'text', array: true, default: '{}' })
  contextIds!: string[];
}
