import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'ingestion_source_statuses' })
@Index(['companyOrgnr', 'sourceName'], { unique: true })
export class IngestionSourceStatusEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'company_orgnr', type: 'varchar', length: 32 })
  companyOrgnr!: string;

  @Column({ name: 'source_name', type: 'varchar', length: 64 })
  sourceName!: string;

  @Column({ name: 'status', type: 'varchar', length: 32, default: 'unknown' })
  status!: string;

  @Column({ name: 'last_success_at', type: 'timestamptz', nullable: true })
  lastSuccessAt!: Date | null;

  @Column({ name: 'last_attempt_at', type: 'timestamptz', nullable: true })
  lastAttemptAt!: Date | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ name: 'data_fresh_until', type: 'timestamptz', nullable: true })
  dataFreshUntil!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

