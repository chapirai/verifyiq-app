import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CompanyAnnualReportHeaderEntity } from './company-annual-report-header.entity';

export type AnnualReportPeriodKind = 'current' | 'prior' | 'instant' | 'unknown';

@Entity({ name: 'company_annual_report_financials' })
@Index(['headerId'])
export class CompanyAnnualReportFinancialEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'header_id', type: 'uuid' })
  headerId!: string;

  @ManyToOne(() => CompanyAnnualReportHeaderEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'header_id' })
  header!: CompanyAnnualReportHeaderEntity;

  @Column({ name: 'canonical_field', type: 'varchar', length: 128 })
  canonicalField!: string;

  @Column({ name: 'period_kind', type: 'varchar', length: 32 })
  periodKind!: AnnualReportPeriodKind;

  @Column({ name: 'value_numeric', type: 'decimal', precision: 30, scale: 10, nullable: true })
  valueNumeric?: string | null;

  @Column({ name: 'value_text', type: 'text', nullable: true })
  valueText?: string | null;

  @Column({ name: 'unit_ref', type: 'varchar', length: 512, nullable: true })
  unitRef?: string | null;

  @Column({ name: 'currency_code', type: 'varchar', length: 16, nullable: true })
  currencyCode?: string | null;

  @Column({ name: 'source_fact_ids', type: 'bigint', array: true, default: '{}' })
  sourceFactIds!: string[];

  @Column({ name: 'ranking_score', type: 'int', default: 0 })
  rankingScore!: number;
}
