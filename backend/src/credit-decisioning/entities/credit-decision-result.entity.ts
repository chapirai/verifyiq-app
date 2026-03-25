import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'credit_decision_results' })
@Index(['tenantId', 'organisationNumber', 'decidedAt'])
export class CreditDecisionResultEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'template_id', type: 'uuid', nullable: true })
  templateId!: string | null;

  @Column({ name: 'template_name', type: 'varchar', length: 255, nullable: true })
  templateName!: string | null;

  @Column({ name: 'organisation_number', type: 'varchar', length: 32, nullable: true })
  organisationNumber!: string | null;

  @Column({ name: 'personnummer', type: 'varchar', length: 32, nullable: true })
  personnummer!: string | null;

  @Column({ name: 'entity_type', type: 'varchar', length: 32, default: 'company' })
  entityType!: string;

  @Column({ name: 'decision', type: 'varchar', length: 32 })
  decision!: string;

  @Column({ name: 'score', type: 'integer', nullable: true })
  score!: number | null;

  @Column({ name: 'reasons', type: 'jsonb', default: () => "'[]'::jsonb" })
  reasons!: Array<Record<string, unknown>>;

  @Column({ name: 'rule_results', type: 'jsonb', default: () => "'[]'::jsonb" })
  ruleResults!: Array<Record<string, unknown>>;

  @Column({ name: 'input_data', type: 'jsonb', default: () => "'{}'::jsonb" })
  inputData!: Record<string, unknown>;

  @Column({ name: 'requested_by_user_id', type: 'uuid', nullable: true })
  requestedByUserId!: string | null;

  @Column({ name: 'decided_at', type: 'timestamptz', default: () => 'NOW()' })
  decidedAt!: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
