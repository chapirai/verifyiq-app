import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'monitoring_subscriptions' })
export class MonitoringSubscriptionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'uuid', name: 'party_id', nullable: true })
  partyId!: string | null;

  @Column({ type: 'uuid', name: 'company_id', nullable: true })
  companyId!: string | null;

  @Column({ type: 'varchar', length: 32, default: 'active' })
  status!: string;

  @Column({ type: 'jsonb', name: 'event_types', default: () => "'[]'::jsonb" })
  eventTypes!: string[];

  @Column({ type: 'varchar', length: 64, name: 'subject_type', default: 'company' })
  subjectType!: string; // 'company' | 'person' | 'ownership' | 'beneficial_owner'

  @Column({ type: 'varchar', length: 64, name: 'organisation_number', nullable: true })
  organisationNumber!: string | null;

  @Column({ type: 'varchar', length: 32, name: 'personnummer', nullable: true })
  personnummer!: string | null;

  @Column({ type: 'jsonb', name: 'dataset_families', default: () => "'[]'::jsonb" })
  datasetFamilies!: string[]; // which dataset families to monitor

  @Column({ type: 'jsonb', name: 'alert_config', default: () => "'{}'::jsonb" })
  alertConfig!: Record<string, unknown>; // thresholds, cooldown, channels

  @Column({ type: 'uuid', name: 'created_by_user_id', nullable: true })
  createdByUserId!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
