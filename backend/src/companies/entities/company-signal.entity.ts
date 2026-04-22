import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'company_signals' })
@Index(['tenantId', 'organisationNumber', 'signalType', 'computedAt'])
export class CompanySignalEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'organisation_number', type: 'varchar', length: 64 })
  organisationNumber!: string;

  @Column({ name: 'signal_type', type: 'varchar', length: 64 })
  signalType!: string;

  @Column({ name: 'engine_version', type: 'varchar', length: 32 })
  engineVersion!: string;

  @Column({ type: 'numeric', precision: 12, scale: 4, nullable: true })
  score!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  explanation!: Record<string, unknown>;

  @Column({ name: 'job_id', type: 'varchar', length: 128, nullable: true })
  jobId!: string | null;

  @CreateDateColumn({ name: 'computed_at', type: 'timestamptz' })
  computedAt!: Date;
}
