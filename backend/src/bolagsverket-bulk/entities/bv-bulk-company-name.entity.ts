import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'bv_bulk_company_names' })
@Index(['sourceIdentityKey'])
@Index(['sourceFileRunId'])
export class BvBulkCompanyNameEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'source_identity_key', type: 'varchar', length: 160 })
  sourceIdentityKey!: string;

  @Column({ name: 'source_file_run_id', type: 'uuid' })
  sourceFileRunId!: string;

  @Column({ name: 'name', type: 'text', nullable: true })
  name!: string | null;

  @Column({ name: 'name_type_code', type: 'varchar', length: 64, nullable: true })
  nameTypeCode!: string | null;

  @Column({ name: 'name_type_label', type: 'varchar', length: 255, nullable: true })
  nameTypeLabel!: string | null;

  @Column({ name: 'registration_date', type: 'date', nullable: true })
  registrationDate!: string | null;

  @Column({ name: 'extra', type: 'text', nullable: true })
  extra!: string | null;

  @Column({ name: 'ordinal', type: 'integer', default: 0 })
  ordinal!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

