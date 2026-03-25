import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'business_prohibitions' })
@Index(['tenantId', 'personnummer'])
@Index(['tenantId', 'isActive'])
export class BusinessProhibitionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 32 })
  personnummer!: string;

  @Column({ type: 'varchar', length: 255, name: 'person_name', nullable: true })
  personName!: string | null;

  @Column({ type: 'varchar', length: 64, name: 'prohibition_type', nullable: true })
  prohibitionType!: string | null;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ type: 'date', name: 'from_date', nullable: true })
  fromDate!: string | null;

  @Column({ type: 'date', name: 'to_date', nullable: true })
  toDate!: string | null;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @Column({ type: 'varchar', length: 128, name: 'source_authority', nullable: true })
  sourceAuthority!: string | null;

  @Column({ type: 'jsonb', name: 'linked_companies', default: () => "'[]'::jsonb" })
  linkedCompanies!: Array<Record<string, unknown>>;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  payload!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
