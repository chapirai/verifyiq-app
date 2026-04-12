import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AnnualReportSourceFileEntity } from './annual-report-source-file.entity';

@Entity({ name: 'annual_report_sections' })
@Index(['sourceFileId', 'sectionOrder'])
export class AnnualReportSectionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'source_file_id', type: 'uuid' })
  sourceFileId!: string;

  @ManyToOne(() => AnnualReportSourceFileEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'source_file_id' })
  sourceFile!: AnnualReportSourceFileEntity;

  @Column({ name: 'section_order', type: 'int', default: 0 })
  sectionOrder!: number;

  @Column({ name: 'heading_text', type: 'text', nullable: true })
  headingText?: string | null;

  @Column({ name: 'heading_level', type: 'int', nullable: true })
  headingLevel?: number | null;

  @Column({ name: 'normalized_heading', type: 'text', nullable: true })
  normalizedHeading?: string | null;

  @Column({ name: 'text_content', type: 'text', nullable: true })
  textContent?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
