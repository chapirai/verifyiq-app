import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'monitoring_alerts' })
export class MonitoringAlertEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'uuid', name: 'subscription_id' })
  subscriptionId!: string;

  @Column({ type: 'varchar', length: 64, name: 'alert_type' })
  alertType!: string;

  @Column({ type: 'varchar', length: 32 })
  severity!: string;

  @Column({ type: 'varchar', length: 32, default: 'open' })
  status!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  payload!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 64, name: 'dataset_family', nullable: true })
  datasetFamily!: string | null;

  @Column({ type: 'varchar', length: 32, name: 'organisation_number', nullable: true })
  organisationNumber!: string | null;

  @Column({ type: 'varchar', length: 32, name: 'personnummer', nullable: true })
  personnummer!: string | null;

  @Column({ type: 'boolean', name: 'is_acknowledged', default: false })
  isAcknowledged!: boolean;

  @Column({ type: 'timestamptz', name: 'acknowledged_at', nullable: true })
  acknowledgedAt!: Date | null;

  @Column({ type: 'uuid', name: 'acknowledged_by_user_id', nullable: true })
  acknowledgedByUserId!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
