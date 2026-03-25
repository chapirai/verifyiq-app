import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'beneficial_owners' })
@Index(['tenantId', 'organisationNumber'])
export class BeneficialOwnerEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'organisation_number', type: 'varchar', length: 32 })
  organisationNumber!: string;

  @Column({ name: 'company_id', type: 'uuid', nullable: true })
  companyId!: string | null;

  @Column({ name: 'person_name', type: 'varchar', length: 255 })
  personName!: string;

  @Column({ name: 'personnummer', type: 'varchar', length: 32, nullable: true })
  personnummer!: string | null;

  @Column({ name: 'ownership_percentage', type: 'decimal', precision: 8, scale: 4, nullable: true })
  ownershipPercentage!: number | null;

  @Column({ name: 'control_percentage', type: 'decimal', precision: 8, scale: 4, nullable: true })
  controlPercentage!: number | null;

  @Column({ name: 'ownership_type', type: 'varchar', length: 64, nullable: true })
  ownershipType!: string | null;

  @Column({ name: 'is_alternative_beneficial_owner', type: 'boolean', default: false })
  isAlternativeBeneficialOwner!: boolean;

  @Column({ name: 'alternative_reason', type: 'text', nullable: true })
  alternativeReason!: string | null;

  @Column({ name: 'is_current', type: 'boolean', default: true })
  isCurrent!: boolean;

  @Column({ name: 'valid_from', type: 'date', nullable: true })
  validFrom!: Date | null;

  @Column({ name: 'valid_to', type: 'date', nullable: true })
  validTo!: Date | null;

  @Column({ name: 'source_type', type: 'varchar', length: 64, nullable: true })
  sourceType!: string | null;

  @Column({ name: 'source_data', type: 'jsonb', default: () => "'{}'::jsonb" })
  sourceData!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
