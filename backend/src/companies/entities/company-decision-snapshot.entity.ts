import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'company_decision_snapshots' })
@Index(['tenantId', 'organisationNumber', 'strategyMode', 'createdAt'])
export class CompanyDecisionSnapshotEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'organisation_number', type: 'varchar', length: 64 })
  organisationNumber!: string;

  @Column({ name: 'strategy_mode', type: 'varchar', length: 32 })
  strategyMode!: string;

  @Column({ name: 'legal_name', type: 'varchar', length: 255, nullable: true })
  legalName!: string | null;

  @Column({ type: 'text' })
  summary!: string;

  @Column({ name: 'recommended_action', type: 'varchar', length: 128 })
  recommendedAction!: string;

  @Column({ type: 'varchar', length: 16 })
  confidence!: string;

  @Column({ name: 'drivers', type: 'jsonb', default: () => "'[]'::jsonb" })
  drivers!: Array<Record<string, unknown>>;

  @Column({ name: 'scores', type: 'jsonb', default: () => "'{}'::jsonb" })
  scores!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

