import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'credit_decision_templates' })
@Index(['tenantId', 'isActive'])
export class CreditDecisionTemplateEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'name', type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'target_entity_type', type: 'varchar', length: 32, default: 'company' })
  targetEntityType!: string;

  @Column({ name: 'rules', type: 'jsonb', default: () => "'[]'::jsonb" })
  rules!: Array<Record<string, unknown>>;

  @Column({ name: 'approve_conditions', type: 'jsonb', default: () => "'{}'::jsonb" })
  approveConditions!: Record<string, unknown>;

  @Column({ name: 'reject_conditions', type: 'jsonb', default: () => "'{}'::jsonb" })
  rejectConditions!: Record<string, unknown>;

  @Column({ name: 'manual_review_conditions', type: 'jsonb', default: () => "'{}'::jsonb" })
  manualReviewConditions!: Record<string, unknown>;

  @Column({ name: 'metadata', type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
