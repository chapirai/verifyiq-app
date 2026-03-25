import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'ownership_links' })
@Index(['tenantId', 'ownedOrganisationNumber'])
@Index(['tenantId', 'ownerOrganisationNumber'])
export class OwnershipLinkEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'owner_type', type: 'varchar', length: 32 })
  ownerType!: 'person' | 'company';

  @Column({ name: 'owner_person_id', type: 'uuid', nullable: true })
  ownerPersonId!: string | null;

  @Column({ name: 'owner_company_id', type: 'uuid', nullable: true })
  ownerCompanyId!: string | null;

  @Column({ name: 'owner_name', type: 'varchar', length: 255 })
  ownerName!: string;

  @Column({ name: 'owner_organisation_number', type: 'varchar', length: 32, nullable: true })
  ownerOrganisationNumber!: string | null;

  @Column({ name: 'owner_personnummer', type: 'varchar', length: 32, nullable: true })
  ownerPersonnummer!: string | null;

  @Column({ name: 'owned_company_id', type: 'uuid', nullable: true })
  ownedCompanyId!: string | null;

  @Column({ name: 'owned_organisation_number', type: 'varchar', length: 32 })
  ownedOrganisationNumber!: string;

  @Column({ name: 'owned_company_name', type: 'varchar', length: 255 })
  ownedCompanyName!: string;

  @Column({ name: 'ownership_percentage', type: 'decimal', precision: 8, scale: 4, nullable: true })
  ownershipPercentage!: number | null;

  @Column({ name: 'ownership_type', type: 'varchar', length: 64, nullable: true })
  ownershipType!: string | null;

  @Column({ name: 'ownership_class', type: 'varchar', length: 64, nullable: true })
  ownershipClass!: string | null;

  @Column({ name: 'control_percentage', type: 'decimal', precision: 8, scale: 4, nullable: true })
  controlPercentage!: number | null;

  @Column({ name: 'valid_from', type: 'date', nullable: true })
  validFrom!: Date | null;

  @Column({ name: 'valid_to', type: 'date', nullable: true })
  validTo!: Date | null;

  @Column({ name: 'is_current', type: 'boolean', default: true })
  isCurrent!: boolean;

  @Column({ name: 'source_data', type: 'jsonb', default: () => "'{}'::jsonb" })
  sourceData!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
