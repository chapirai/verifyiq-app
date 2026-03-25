import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'bolagsverket_organisationer' })
@Index(['tenantId', 'organisationsnummer'], { unique: true })
export class BvOrganisationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'company_id', type: 'uuid', nullable: true })
  companyId?: string | null;

  @Column({ name: 'organisationsnummer', type: 'varchar', length: 20 })
  organisationsnummer!: string;

  @Column({ name: 'namn', type: 'varchar', length: 255 })
  namn!: string;

  @Column({ name: 'organisationsform_klartext', type: 'varchar', length: 128, nullable: true })
  organisationsformKlartext?: string | null;

  @Column({ name: 'aktuell_status_klartext', type: 'varchar', length: 128, nullable: true })
  aktuellStatusKlartext?: string | null;

  @Column({ name: 'senast_uppdaterad', type: 'timestamptz', nullable: true })
  senastUppdaterad?: Date | null;

  @Column({ name: 'raw_payload', type: 'jsonb', default: () => "'{}'::jsonb" })
  rawPayload!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
