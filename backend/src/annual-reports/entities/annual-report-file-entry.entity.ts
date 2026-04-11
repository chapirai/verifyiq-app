import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AnnualReportFileEntity } from './annual-report-file.entity';

@Entity({ name: 'annual_report_file_entries' })
@Index(['fileId'])
export class AnnualReportFileEntryEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'file_id', type: 'uuid' })
  fileId!: string;

  @ManyToOne(() => AnnualReportFileEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'file_id' })
  file!: AnnualReportFileEntity;

  @Column({ name: 'path_in_archive', type: 'text' })
  pathInArchive!: string;

  @Column({ name: 'uncompressed_size', type: 'bigint', default: '0' })
  uncompressedSize!: string;

  @Column({ name: 'is_directory', type: 'boolean', default: false })
  isDirectory!: boolean;

  @Column({ name: 'content_sha256', type: 'varchar', length: 64, nullable: true })
  contentSha256?: string | null;

  @Column({ name: 'is_candidate_ixbrl', type: 'boolean', default: false })
  isCandidateIxbrl!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
