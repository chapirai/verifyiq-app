import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'bv_bulk_raw_rows' })
@Index(['fileRunId', 'lineNumber'], { unique: true })
export class BvBulkRawRowEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'file_run_id', type: 'uuid' })
  fileRunId!: string;

  @Column({ name: 'line_number', type: 'integer' })
  lineNumber!: number;

  @Column({ name: 'raw_line', type: 'text' })
  rawLine!: string;

  @Column({ name: 'parsed_ok', type: 'boolean', default: true })
  parsedOk!: boolean;

  @Column({ name: 'parse_error', type: 'text', nullable: true })
  parseError!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

