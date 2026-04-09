import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'subscriptions' })
@Index(['tenantId'], { unique: true })
export class SubscriptionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'plan_code', type: 'varchar', length: 64 })
  planCode!: string;

  @Column({ type: 'varchar', length: 32, default: 'trialing' })
  status!: string;

  @Column({ name: 'provider_customer_id', type: 'varchar', length: 128, nullable: true })
  providerCustomerId!: string | null;

  @Column({ name: 'provider_subscription_id', type: 'varchar', length: 128, nullable: true })
  providerSubscriptionId!: string | null;

  @Column({ name: 'current_period_start', type: 'timestamptz', nullable: true })
  currentPeriodStart!: Date | null;

  @Column({ name: 'current_period_end', type: 'timestamptz', nullable: true })
  currentPeriodEnd!: Date | null;

  @Column({ name: 'canceled_at', type: 'timestamptz', nullable: true })
  canceledAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
