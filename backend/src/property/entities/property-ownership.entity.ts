import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'property_ownerships' })
@Index(['tenantId', 'ownerOrganisationNumber'])
@Index(['tenantId', 'ownerPersonnummer'])
export class PropertyOwnershipEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 32, name: 'owner_type' })
  ownerType!: string;

  @Column({ type: 'varchar', length: 32, name: 'owner_organisation_number', nullable: true })
  ownerOrganisationNumber!: string | null;

  @Column({ type: 'varchar', length: 32, name: 'owner_personnummer', nullable: true })
  ownerPersonnummer!: string | null;

  @Column({ type: 'varchar', length: 255, name: 'owner_name' })
  ownerName!: string;

  @Column({ type: 'varchar', length: 256, name: 'property_designation', nullable: true })
  propertyDesignation!: string | null;

  @Column({ type: 'varchar', length: 64, name: 'property_type', nullable: true })
  propertyType!: string | null;

  @Column({ type: 'varchar', length: 16, name: 'municipality_code', nullable: true })
  municipalityCode!: string | null;

  @Column({ type: 'varchar', length: 128, name: 'municipality_name', nullable: true })
  municipalityName!: string | null;

  @Column({ type: 'varchar', length: 8, name: 'county_code', nullable: true })
  countyCode!: string | null;

  @Column({ type: 'varchar', length: 128, name: 'county_name', nullable: true })
  countyName!: string | null;

  @Column({ type: 'decimal', precision: 20, scale: 2, name: 'tax_value', nullable: true })
  taxValue!: string | null;

  @Column({ type: 'integer', name: 'tax_value_year', nullable: true })
  taxValueYear!: number | null;

  @Column({ type: 'decimal', precision: 8, scale: 4, name: 'ownership_share', nullable: true })
  ownershipShare!: string | null;

  @Column({ type: 'date', name: 'acquisition_date', nullable: true })
  acquisitionDate!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  address!: Record<string, unknown>;

  @Column({ type: 'jsonb', name: 'source_data', default: () => "'{}'::jsonb" })
  sourceData!: Record<string, unknown>;

  @Column({ type: 'boolean', name: 'is_current', default: true })
  isCurrent!: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
