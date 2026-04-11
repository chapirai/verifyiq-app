import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CompanyAnnualReportHeaderEntity } from './company-annual-report-header.entity';

@Entity({ name: 'company_annual_report_auditor' })
export class CompanyAnnualReportAuditorEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'header_id', type: 'uuid' })
  headerId!: string;

  @ManyToOne(() => CompanyAnnualReportHeaderEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'header_id' })
  header!: CompanyAnnualReportHeaderEntity;

  @Column({ name: 'auditor_name', type: 'text', nullable: true })
  auditorName?: string | null;

  @Column({ name: 'auditor_firm', type: 'text', nullable: true })
  auditorFirm?: string | null;

  @Column({ name: 'audit_opinion_hint', type: 'text', nullable: true })
  auditOpinionHint?: string | null;

  @Column({ name: 'source_fact_ids', type: 'bigint', array: true, default: '{}' })
  sourceFactIds!: string[];
}
