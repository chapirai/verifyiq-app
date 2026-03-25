import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'dataset_usage_events' })
@Index(['tenantId', 'datasetFamily', 'occurredAt'])
@Index(['tenantId', 'occurredAt'])
export class DatasetUsageEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string | null;

  @Column({ name: 'dataset_family', type: 'varchar', length: 64 })
  datasetFamily!: string;

  @Column({ name: 'action', type: 'varchar', length: 128 })
  action!: string;

  @Column({ name: 'resource_id', type: 'varchar', length: 256, nullable: true })
  resourceId?: string | null;

  @Column({ name: 'resource_type', type: 'varchar', length: 64, nullable: true })
  resourceType?: string | null;

  @Column({ name: 'billing_units', type: 'integer', default: 1 })
  billingUnits!: number;

  @Column({ name: 'metadata', type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @Column({ name: 'occurred_at', type: 'timestamptz', default: () => 'NOW()' })
  occurredAt!: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
