import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AnnualReportImportEntity } from './annual-report-import.entity';

@Entity({ name: 'annual_report_summary' })
export class AnnualReportSummaryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'annual_report_import_id', type: 'uuid', unique: true })
  annualReportImportId!: string;

  @OneToOne(() => AnnualReportImportEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'annual_report_import_id' })
  annualReportImport!: AnnualReportImportEntity;

  @Column({ name: 'org_number', type: 'varchar', length: 64, nullable: true })
  orgNumber?: string | null;

  @Column({ name: 'fiscal_year', type: 'int', nullable: true })
  fiscalYear?: number | null;

  @Column({ name: 'period_start', type: 'date', nullable: true })
  periodStart?: Date | null;

  @Column({ name: 'period_end', type: 'date', nullable: true })
  periodEnd?: Date | null;

  @Column({ name: 'currency', type: 'varchar', length: 16, nullable: true })
  currency?: string | null;

  @Column({ name: 'revenue', type: 'decimal', precision: 30, scale: 10, nullable: true })
  revenue?: string | null;

  @Column({ name: 'gross_profit', type: 'decimal', precision: 30, scale: 10, nullable: true })
  grossProfit?: string | null;

  @Column({ name: 'operating_profit', type: 'decimal', precision: 30, scale: 10, nullable: true })
  operatingProfit?: string | null;

  @Column({ name: 'profit_before_tax', type: 'decimal', precision: 30, scale: 10, nullable: true })
  profitBeforeTax?: string | null;

  @Column({ name: 'net_profit', type: 'decimal', precision: 30, scale: 10, nullable: true })
  netProfit?: string | null;

  @Column({ name: 'total_assets', type: 'decimal', precision: 30, scale: 10, nullable: true })
  totalAssets?: string | null;

  @Column({ name: 'fixed_assets', type: 'decimal', precision: 30, scale: 10, nullable: true })
  fixedAssets?: string | null;

  @Column({ name: 'current_assets', type: 'decimal', precision: 30, scale: 10, nullable: true })
  currentAssets?: string | null;

  @Column({ name: 'equity', type: 'decimal', precision: 30, scale: 10, nullable: true })
  equity?: string | null;

  @Column({ name: 'untaxed_reserves', type: 'decimal', precision: 30, scale: 10, nullable: true })
  untaxedReserves?: string | null;

  @Column({ name: 'provisions', type: 'decimal', precision: 30, scale: 10, nullable: true })
  provisions?: string | null;

  @Column({ name: 'long_term_liabilities', type: 'decimal', precision: 30, scale: 10, nullable: true })
  longTermLiabilities?: string | null;

  @Column({ name: 'short_term_liabilities', type: 'decimal', precision: 30, scale: 10, nullable: true })
  shortTermLiabilities?: string | null;

  @Column({ name: 'cash_and_bank', type: 'decimal', precision: 30, scale: 10, nullable: true })
  cashAndBank?: string | null;

  @Column({ name: 'net_sales', type: 'decimal', precision: 30, scale: 10, nullable: true })
  netSales?: string | null;

  @Column({ name: 'employee_count', type: 'decimal', precision: 20, scale: 4, nullable: true })
  employeeCount?: string | null;

  @Column({ name: 'auditor_name', type: 'text', nullable: true })
  auditorName?: string | null;

  @Column({ name: 'audit_opinion', type: 'text', nullable: true })
  auditOpinion?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
