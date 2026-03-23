import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'risk_assessments' })
export class RiskAssessmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'party_id', type: 'uuid' })
  partyId!: string;

  @Column({ name: 'onboarding_case_id', type: 'uuid', nullable: true })
  onboardingCaseId?: string | null;

  @Column({ type: 'integer' })
  score!: number;

  @Column({ name: 'risk_level', type: 'varchar', length: 32 })
  riskLevel!: string;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  factors!: Array<Record<string, unknown>>;

  @Column({ name: 'assessed_by', type: 'varchar', length: 64 })
  assessedBy!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
