import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CompanyAnnualReportHeaderEntity } from './company-annual-report-header.entity';

@Entity({ name: 'company_annual_report_notes_index' })
@Index(['headerId'])
export class CompanyAnnualReportNotesIndexEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'header_id', type: 'uuid' })
  headerId!: string;

  @ManyToOne(() => CompanyAnnualReportHeaderEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'header_id' })
  header!: CompanyAnnualReportHeaderEntity;

  @Column({ name: 'note_ref', type: 'varchar', length: 256, nullable: true })
  noteRef?: string | null;

  @Column({ name: 'note_label', type: 'text', nullable: true })
  noteLabel?: string | null;

  @Column({ name: 'concept_qname', type: 'varchar', length: 1024, nullable: true })
  conceptQname?: string | null;

  @Column({ name: 'source_fact_ids', type: 'bigint', array: true, default: '{}' })
  sourceFactIds!: string[];
}
