import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type AnnualReportFileStatus =
  | 'pending'
  | 'extracting'
  | 'extracted'
  | 'normalized'
  | 'failed';

@Entity({ name: 'annual_report_files' })
@Index(['tenantId', 'organisationsnummer'])
@Index(['tenantId', 'status'])
@Index(['companyId'], { where: 'company_id IS NOT NULL' })
export class AnnualReportFileEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'company_id', type: 'uuid', nullable: true })
  companyId?: string | null;

  @Column({ name: 'organisationsnummer', type: 'varchar', length: 64, nullable: true })
  organisationsnummer?: string | null;

  @Column({ name: 'bv_stored_document_id', type: 'uuid', nullable: true })
  bvStoredDocumentId?: string | null;

  @Column({ name: 'original_filename', type: 'varchar', length: 512 })
  originalFilename!: string;

  @Column({ name: 'content_type', type: 'varchar', length: 128, nullable: true })
  contentType?: string | null;

  @Column({ name: 'content_sha256', type: 'varchar', length: 64 })
  contentSha256!: string;

  @Column({ name: 'size_bytes', type: 'bigint' })
  sizeBytes!: string;

  @Column({ name: 'storage_bucket', type: 'varchar', length: 128, nullable: true })
  storageBucket?: string | null;

  @Column({ name: 'storage_key', type: 'varchar', length: 512, nullable: true })
  storageKey?: string | null;

  @Column({ name: 'status', type: 'varchar', length: 32, default: 'pending' })
  status!: AnnualReportFileStatus;

  @Column({ name: 'ixbrl_entry_path', type: 'text', nullable: true })
  ixbrlEntryPath?: string | null;

  @Column({ name: 'metadata', type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
