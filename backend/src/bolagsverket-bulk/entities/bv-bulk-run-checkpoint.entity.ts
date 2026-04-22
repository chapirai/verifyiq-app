import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'bv_bulk_run_checkpoints' })
@Index(['fileRunId', 'checkpointSeq'], { unique: true })
export class BvBulkRunCheckpointEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'file_run_id', type: 'uuid' })
  fileRunId!: string;

  @Column({ name: 'checkpoint_seq', type: 'integer' })
  checkpointSeq!: number;

  @Column({ name: 'last_line_number', type: 'integer' })
  lastLineNumber!: number;

  @Column({ name: 'rows_written', type: 'integer', default: 0 })
  rowsWritten!: number;

  @Column({ name: 'staging_written', type: 'integer', default: 0 })
  stagingWritten!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

