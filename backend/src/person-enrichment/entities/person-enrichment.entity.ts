import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'person_enrichments' })
@Index(['tenantId', 'personnummer'], { unique: true })
export class PersonEnrichmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 32 })
  personnummer!: string;

  @Column({ type: 'uuid', name: 'party_id', nullable: true })
  partyId!: string | null;

  @Column({ type: 'varchar', length: 255, name: 'full_name', nullable: true })
  fullName!: string | null;

  @Column({ type: 'varchar', length: 128, name: 'first_name', nullable: true })
  firstName!: string | null;

  @Column({ type: 'varchar', length: 128, name: 'last_name', nullable: true })
  lastName!: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  gender!: string | null;

  @Column({ type: 'boolean', name: 'is_deceased', default: false })
  isDeceased!: boolean;

  @Column({ type: 'date', name: 'deceased_date', nullable: true })
  deceasedDate!: string | null;

  @Column({ type: 'jsonb', name: 'official_address', default: () => "'{}'::jsonb" })
  officialAddress!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 16, name: 'municipality_code', nullable: true })
  municipalityCode!: string | null;

  @Column({ type: 'varchar', length: 128, name: 'municipality_name', nullable: true })
  municipalityName!: string | null;

  @Column({ type: 'varchar', length: 8, name: 'county_code', nullable: true })
  countyCode!: string | null;

  @Column({ type: 'jsonb', name: 'board_assignments', default: () => "'[]'::jsonb" })
  boardAssignments!: Array<Record<string, unknown>>;

  @Column({ type: 'jsonb', name: 'beneficial_owner_links', default: () => "'[]'::jsonb" })
  beneficialOwnerLinks!: Array<Record<string, unknown>>;

  @Column({ type: 'jsonb', name: 'business_prohibition', default: () => "'{}'::jsonb" })
  businessProhibition!: Record<string, unknown>;

  @Column({ type: 'jsonb', name: 'sanctions_status', default: () => "'{}'::jsonb" })
  sanctionsStatus!: Record<string, unknown>;

  @Column({ type: 'jsonb', name: 'pep_status', default: () => "'{}'::jsonb" })
  pepStatus!: Record<string, unknown>;

  @Column({ type: 'jsonb', name: 'data_permissions', default: () => "'{}'::jsonb" })
  dataPermissions!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 64, name: 'source_type', nullable: true })
  sourceType!: string | null;

  @Column({ type: 'timestamptz', name: 'enriched_at', nullable: true })
  enrichedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
