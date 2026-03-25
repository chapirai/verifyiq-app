import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'dataset_entitlements' })
@Index(['tenantId', 'datasetFamily'], { unique: true })
export class DatasetEntitlementEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'dataset_family', type: 'varchar', length: 64 })
  datasetFamily!: string;

  @Column({ name: 'is_enabled', type: 'boolean', default: true })
  isEnabled!: boolean;

  @Column({ name: 'monthly_quota', type: 'integer', nullable: true })
  monthlyQuota?: number | null;

  @Column({ name: 'current_month_usage', type: 'integer', default: 0 })
  currentMonthUsage!: number;

  @Column({ name: 'quota_reset_at', type: 'timestamptz', nullable: true })
  quotaResetAt?: Date | null;

  @Column({ name: 'plan_tier', type: 'varchar', length: 64, nullable: true })
  planTier?: string | null;

  @Column({ name: 'metadata', type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
