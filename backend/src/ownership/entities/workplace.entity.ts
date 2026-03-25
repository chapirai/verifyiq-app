import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'workplaces' })
@Index(['tenantId', 'organisationNumber'])
export class WorkplaceEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'organisation_number', type: 'varchar', length: 32 })
  organisationNumber!: string;

  @Column({ name: 'company_id', type: 'uuid', nullable: true })
  companyId!: string | null;

  @Column({ name: 'cfar_number', type: 'varchar', length: 32, nullable: true })
  cfarNumber!: string | null;

  @Column({ name: 'workplace_name', type: 'varchar', length: 255, nullable: true })
  workplaceName!: string | null;

  @Column({ name: 'phone', type: 'varchar', length: 64, nullable: true })
  phone!: string | null;

  @Column({ name: 'email', type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({ name: 'postal_address', type: 'jsonb', default: () => "'{}'::jsonb" })
  postalAddress!: Record<string, unknown>;

  @Column({ name: 'delivery_address', type: 'jsonb', nullable: true })
  deliveryAddress!: Record<string, unknown> | null;

  @Column({ name: 'coordinates', type: 'jsonb', nullable: true })
  coordinates!: Record<string, unknown> | null;

  @Column({ name: 'municipality_code', type: 'varchar', length: 16, nullable: true })
  municipalityCode!: string | null;

  @Column({ name: 'municipality_name', type: 'varchar', length: 128, nullable: true })
  municipalityName!: string | null;

  @Column({ name: 'county_code', type: 'varchar', length: 8, nullable: true })
  countyCode!: string | null;

  @Column({ name: 'county_name', type: 'varchar', length: 128, nullable: true })
  countyName!: string | null;

  @Column({ name: 'industry_code', type: 'varchar', length: 32, nullable: true })
  industryCode!: string | null;

  @Column({ name: 'industry_description', type: 'text', nullable: true })
  industryDescription!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'source_data', type: 'jsonb', default: () => "'{}'::jsonb" })
  sourceData!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
