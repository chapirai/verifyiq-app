import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'raw_record_lineage' })
@Index(['runId', 'rowNumber'])
@Index(['rawRecordHash'])
export class RawRecordLineageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'run_id', type: 'uuid' })
  runId!: string;

  @Column({ name: 'provider', type: 'varchar', length: 64 })
  provider!: string;

  @Column({ name: 'company_orgnr', type: 'varchar', length: 32, nullable: true })
  companyOrgnr!: string | null;

  @Column({ name: 'row_number', type: 'integer' })
  rowNumber!: number;

  @Column({ name: 'raw_record_hash', type: 'varchar', length: 64 })
  rawRecordHash!: string;

  @Column({ name: 'source_file_key', type: 'text' })
  sourceFileKey!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

