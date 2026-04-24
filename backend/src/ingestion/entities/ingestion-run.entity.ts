import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'ingestion_runs' })
@Index(['sourceProvider', 'startedAt'])
export class IngestionRunEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'source_provider', type: 'varchar', length: 64 })
  sourceProvider!: string;

  @Column({ name: 'ingestion_type', type: 'varchar', length: 64 })
  ingestionType!: string;

  @Column({ name: 'status', type: 'varchar', length: 32, default: 'queued' })
  status!: string;

  @CreateDateColumn({ name: 'started_at', type: 'timestamptz' })
  startedAt!: Date;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt!: Date | null;

  @Column({ name: 'records_seen', type: 'integer', default: 0 })
  recordsSeen!: number;

  @Column({ name: 'records_inserted', type: 'integer', default: 0 })
  recordsInserted!: number;

  @Column({ name: 'records_failed', type: 'integer', default: 0 })
  recordsFailed!: number;

  @Column({ name: 'memory_peak_mb', type: 'integer', default: 0 })
  memoryPeakMb!: number;

  @Column({ name: 'r2_object_key', type: 'text', nullable: true })
  r2ObjectKey!: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

