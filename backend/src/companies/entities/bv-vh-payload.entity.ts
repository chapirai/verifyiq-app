import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Full JSON response from Bolagsverket Verkliga huvudmän API (separate from FI v4 / HVD).
 */
@Entity({ name: 'bv_vh_payloads' })
@Index(['tenantId', 'snapshotId'])
@Index(['tenantId', 'organisationsnummer', 'fetchedAt'])
export class BvVhPayloadEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'snapshot_id', type: 'uuid', nullable: true })
  snapshotId?: string | null;

  @Column({ name: 'organisationsnummer', type: 'varchar', length: 20 })
  organisationsnummer!: string;

  @Column({ name: 'fetched_at', type: 'timestamptz' })
  fetchedAt!: Date;

  @Column({ name: 'request_id', type: 'varchar', length: 128, nullable: true })
  requestId?: string | null;

  @Column({ name: 'payload', type: 'jsonb' })
  payload!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
