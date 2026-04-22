import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type BvBulkEnrichmentReason =
  | 'company_opened'
  | 'compare'
  | 'manual'
  | 'api_request'
  | 'ownership'
  | 'officers'
  | 'documents'
  | 'financial';

export type BvBulkEnrichmentStatus = 'queued' | 'started' | 'finished' | 'failed';

@Entity({ name: 'bv_bulk_enrichment_requests' })
@Index(['organisationNumber', 'status'])
@Index(['requestedAt'])
export class BvBulkEnrichmentRequestEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organisation_number', type: 'varchar', length: 32 })
  organisationNumber!: string;

  @Column({ name: 'requested_by_user_id', type: 'uuid', nullable: true })
  requestedByUserId!: string | null;

  @Column({ name: 'requested_by_tenant_id', type: 'uuid' })
  requestedByTenantId!: string;

  @Column({ name: 'reason', type: 'varchar', length: 64 })
  reason!: BvBulkEnrichmentReason;

  @Column({ name: 'status', type: 'varchar', length: 32, default: 'queued' })
  status!: BvBulkEnrichmentStatus;

  @Column({ name: 'priority', type: 'integer', default: 100 })
  priority!: number;

  @Column({ name: 'requested_at', type: 'timestamptz' })
  requestedAt!: Date;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt!: Date | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

