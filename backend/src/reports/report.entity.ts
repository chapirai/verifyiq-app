import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'reports' })
export class ReportEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 64, name: 'report_type' })
  reportType!: string;

  @Column({ type: 'varchar', length: 32 })
  status!: string;

  @Column({ type: 'uuid', name: 'requested_by_user_id', nullable: true })
  requestedByUserId!: string | null;

  @Column({ type: 'varchar', length: 255, name: 'storage_bucket', nullable: true })
  storageBucket!: string | null;

  @Column({ type: 'varchar', length: 512, name: 'storage_key', nullable: true })
  storageKey!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  filters!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', name: 'completed_at', nullable: true })
  completedAt!: Date | null;
}
