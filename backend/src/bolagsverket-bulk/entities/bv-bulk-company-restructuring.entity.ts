import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'bv_bulk_company_restructuring' })
@Index(['sourceIdentityKey'])
@Index(['sourceFileRunId'])
export class BvBulkCompanyRestructuringEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'source_identity_key', type: 'varchar', length: 160 })
  sourceIdentityKey!: string;

  @Column({ name: 'source_file_run_id', type: 'uuid' })
  sourceFileRunId!: string;

  @Column({ name: 'code', type: 'varchar', length: 64, nullable: true })
  code!: string | null;

  @Column({ name: 'label', type: 'varchar', length: 255, nullable: true })
  label!: string | null;

  @Column({ name: 'text', type: 'text', nullable: true })
  text!: string | null;

  @Column({ name: 'from_date', type: 'date', nullable: true })
  fromDate!: string | null;

  @Column({ name: 'ordinal', type: 'integer', default: 0 })
  ordinal!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

