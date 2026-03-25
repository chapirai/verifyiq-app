import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'risk_indicator_results' })
@Index(['tenantId', 'organisationNumber', 'evaluatedAt'])
export class RiskIndicatorResultEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'uuid', name: 'config_id', nullable: true })
  configId!: string | null;

  @Column({ type: 'varchar', length: 255, name: 'indicator_name' })
  indicatorName!: string;

  @Column({ type: 'varchar', length: 64, name: 'indicator_category' })
  indicatorCategory!: string;

  @Column({ type: 'varchar', length: 32, name: 'organisation_number', nullable: true })
  organisationNumber!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  personnummer!: string | null;

  @Column({ type: 'varchar', length: 32, name: 'entity_type', default: 'company' })
  entityType!: string;

  @Column({ type: 'boolean', name: 'is_triggered', default: false })
  isTriggered!: boolean;

  @Column({ type: 'varchar', length: 32, nullable: true })
  severity!: string | null;

  @Column({ type: 'text', name: 'trigger_reason', nullable: true })
  triggerReason!: string | null;

  @Column({ type: 'jsonb', name: 'trigger_details', default: () => "'{}'::jsonb" })
  triggerDetails!: Record<string, unknown>;

  @Column({ type: 'timestamptz', name: 'evaluated_at', default: () => 'NOW()' })
  evaluatedAt!: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
