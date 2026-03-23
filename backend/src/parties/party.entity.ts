import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type PartyType = 'individual' | 'legal_entity';

@Entity({ name: 'parties' })
@Index(['tenantId', 'externalRef'], { unique: true, where: 'external_ref IS NOT NULL' })
export class PartyEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 32 })
  type!: PartyType;

  @Column({ name: 'display_name', type: 'varchar', length: 255 })
  displayName!: string;

  @Column({ name: 'first_name', type: 'varchar', length: 120, nullable: true })
  firstName?: string | null;

  @Column({ name: 'last_name', type: 'varchar', length: 120, nullable: true })
  lastName?: string | null;

  @Column({ name: 'legal_name', type: 'varchar', length: 255, nullable: true })
  legalName?: string | null;

  @Column({ name: 'personal_number', type: 'varchar', length: 64, nullable: true })
  personalNumber?: string | null;

  @Column({ name: 'organisation_number', type: 'varchar', length: 64, nullable: true })
  organisationNumber?: string | null;

  @Column({ name: 'country_code', type: 'varchar', length: 2, default: 'SE' })
  countryCode!: string;

  @Column({ name: 'status', type: 'varchar', length: 40, default: 'active' })
  status!: string;

  @Column({ name: 'email', type: 'varchar', length: 255, nullable: true })
  email?: string | null;

  @Column({ name: 'phone', type: 'varchar', length: 64, nullable: true })
  phone?: string | null;

  @Column({ name: 'external_ref', type: 'varchar', length: 128, nullable: true })
  externalRef?: string | null;

  @Column({ name: 'metadata', type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
