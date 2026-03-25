import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'risk_indicator_configs' })
@Index(['tenantId', 'category', 'isEnabled'])
export class RiskIndicatorConfigEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 64 })
  category!: string;

  @Column({ type: 'varchar', length: 64, name: 'dataset_family', nullable: true })
  datasetFamily!: string | null;

  @Column({ type: 'boolean', name: 'is_enabled', default: true })
  isEnabled!: boolean;

  @Column({ type: 'varchar', length: 32, default: 'medium' })
  severity!: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  threshold!: Record<string, unknown>;

  @Column({ type: 'jsonb', name: 'condition_logic', default: () => "'{}'::jsonb" })
  conditionLogic!: Record<string, unknown>;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @Column({ type: 'uuid', name: 'created_by_user_id', nullable: true })
  createdByUserId!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
