import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'bolagsverket_stored_documents' })
@Index(['tenantId', 'organisationsnummer'])
export class BvStoredDocumentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'organisationsnummer', type: 'varchar', length: 20 })
  organisationsnummer!: string;

  @Column({ name: 'organisation_id', type: 'uuid', nullable: true })
  organisationId?: string | null;

  @Column({ name: 'document_id_source', type: 'varchar', length: 128, nullable: true })
  documentIdSource?: string | null;

  @Column({ name: 'document_type', type: 'varchar', length: 64, nullable: true })
  documentType?: string | null;

  @Column({ name: 'document_year', type: 'varchar', length: 16, nullable: true })
  documentYear?: string | null;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName!: string;

  @Column({ name: 'content_type', type: 'varchar', length: 128, nullable: true })
  contentType?: string | null;

  @Column({ name: 'size_bytes', type: 'bigint', nullable: true })
  sizeBytes?: number | null;

  @Column({ name: 'storage_bucket', type: 'varchar', length: 128, default: 'verifyiq-documents' })
  storageBucket!: string;

  @Column({ name: 'storage_key', type: 'varchar', length: 512 })
  storageKey!: string;

  @Column({ name: 'source_url', type: 'text', nullable: true })
  sourceUrl?: string | null;

  @Column({ name: 'checksum_sha256', type: 'varchar', length: 64, nullable: true })
  checksumSha256?: string | null;

  @Column({ name: 'is_duplicate', type: 'boolean', default: false })
  isDuplicate!: boolean;

  @Column({ name: 'download_status', type: 'varchar', length: 32, default: 'pending' })
  downloadStatus!: string;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string | null;

  @Column({ name: 'downloaded_at', type: 'timestamptz', nullable: true })
  downloadedAt?: Date | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;
}
