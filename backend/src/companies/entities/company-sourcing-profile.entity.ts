import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'company_sourcing_profiles' })
@Index(['tenantId', 'organisationNumber'], { unique: true })
@Index(['tenantId', 'updatedAt'])
export class CompanySourcingProfileEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'organisation_number', type: 'varchar', length: 32 })
  organisationNumber!: string;

  @Column({ name: 'ownership_risk_score', type: 'numeric', precision: 6, scale: 2, default: 0 })
  ownershipRiskScore!: string;

  @Column({ name: 'deal_mode_scores', type: 'jsonb', default: () => "'{}'::jsonb" })
  dealModeScores!: Record<string, unknown>;

  @Column({ name: 'deal_mode_rationale', type: 'jsonb', default: () => "'{}'::jsonb" })
  dealModeRationale!: Record<string, unknown>;

  @Column({ name: 'signals_snapshot', type: 'jsonb', default: () => "'{}'::jsonb" })
  signalsSnapshot!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

