import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type BvBulkChangeType = 'new' | 'updated' | 'unchanged' | 'removed';

@Entity({ name: 'bv_bulk_company_history' })
@Index(['organisationNumber', 'validFrom'])
export class BvBulkCompanyHistoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organisation_number', type: 'varchar', length: 32 })
  organisationNumber!: string;

  @Column({ name: 'file_run_id', type: 'uuid' })
  fileRunId!: string;

  @Column({ name: 'change_type', type: 'varchar', length: 32 })
  changeType!: BvBulkChangeType;

  @Column({ name: 'snapshot_jsonb', type: 'jsonb', default: () => "'{}'::jsonb" })
  snapshotJsonb!: Record<string, unknown>;

  @Column({ name: 'record_hash', type: 'varchar', length: 64, nullable: true })
  recordHash!: string | null;

  @Column({ name: 'valid_from', type: 'timestamptz' })
  validFrom!: Date;

  @Column({ name: 'valid_to', type: 'timestamptz', nullable: true })
  validTo!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

