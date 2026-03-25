import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'company_cases' })
@Index(['tenantId', 'organisationNumber'])
export class CompanyCaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 32, name: 'organisation_number' })
  organisationNumber!: string;

  @Column({ type: 'uuid', name: 'company_id', nullable: true })
  companyId!: string | null;

  @Column({ type: 'varchar', length: 128, name: 'case_number', nullable: true })
  caseNumber!: string | null;

  @Column({ type: 'varchar', length: 64, name: 'case_type', nullable: true })
  caseType!: string | null;

  @Column({ type: 'text', name: 'case_type_description', nullable: true })
  caseTypeDescription!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  status!: string | null;

  @Column({ type: 'varchar', length: 128, name: 'source_authority', nullable: true })
  sourceAuthority!: string | null;

  @Column({ type: 'date', name: 'effective_date', nullable: true })
  effectiveDate!: string | null;

  @Column({ type: 'date', name: 'closed_date', nullable: true })
  closedDate!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  payload!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
