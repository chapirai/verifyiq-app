import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type BvBulkFileRunStatus = 'downloaded' | 'parsed' | 'applied' | 'failed';

@Entity({ name: 'bv_bulk_file_runs' })
@Index(['downloadedAt'])
@Index(['zipSha256'], { unique: true })
export class BvBulkFileRunEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'source_url', type: 'text' })
  sourceUrl!: string;

  @Column({ name: 'downloaded_at', type: 'timestamptz' })
  downloadedAt!: Date;

  @Column({ name: 'effective_date', type: 'date', nullable: true })
  effectiveDate!: string | null;

  @Column({ name: 'zip_object_key', type: 'text' })
  zipObjectKey!: string;

  @Column({ name: 'txt_object_key', type: 'text' })
  txtObjectKey!: string;

  @Column({ name: 'zip_sha256', type: 'varchar', length: 64 })
  zipSha256!: string;

  @Column({ name: 'txt_sha256', type: 'varchar', length: 64 })
  txtSha256!: string;

  @Column({ name: 'row_count', type: 'integer', default: 0 })
  rowCount!: number;

  @Column({ name: 'parser_profile', type: 'varchar', length: 64, nullable: true })
  parserProfile!: string | null;

  @Column({ name: 'status', type: 'varchar', length: 32, default: 'downloaded' })
  status!: BvBulkFileRunStatus;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

