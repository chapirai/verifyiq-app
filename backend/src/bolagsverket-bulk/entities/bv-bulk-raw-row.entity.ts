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

  @Column({ name: 'source_file_name', type: 'text', nullable: true })
  sourceFileName!: string | null;

  @Column({ name: 'source_file_size_bytes', type: 'bigint', nullable: true })
  sourceFileSizeBytes!: string | null;

  @Column({ name: 'source_file_date', type: 'date', nullable: true })
  sourceFileDate!: string | null;

  @Column({ name: 'organisationsidentitet', type: 'text', nullable: true })
  organisationsidentitet!: string | null;

  @Column({ name: 'namnskyddslopnummer', type: 'text', nullable: true })
  namnskyddslopnummer!: string | null;

  @Column({ name: 'registreringsland', type: 'text', nullable: true })
  registreringsland!: string | null;

  @Column({ name: 'organisationsnamn', type: 'text', nullable: true })
  organisationsnamn!: string | null;

  @Column({ name: 'organisationsform', type: 'text', nullable: true })
  organisationsform!: string | null;

  @Column({ name: 'avregistreringsdatum', type: 'text', nullable: true })
  avregistreringsdatum!: string | null;

  @Column({ name: 'avregistreringsorsak', type: 'text', nullable: true })
  avregistreringsorsak!: string | null;

  @Column({ name: 'pagande_avvecklings_eller_omstruktureringsforfarande', type: 'text', nullable: true })
  pagandeAvvecklingsEllerOmstruktureringsforfarande!: string | null;

  @Column({ name: 'registreringsdatum', type: 'text', nullable: true })
  registreringsdatum!: string | null;

  @Column({ name: 'verksamhetsbeskrivning', type: 'text', nullable: true })
  verksamhetsbeskrivning!: string | null;

  @Column({ name: 'postadress', type: 'text', nullable: true })
  postadress!: string | null;

  @Column({ name: 'parse_status', type: 'varchar', length: 32, nullable: true })
  parseStatus!: string | null;

  @Column({ name: 'parsed_ok', type: 'boolean', default: true })
  parsedOk!: boolean;

  @Column({ name: 'parse_error', type: 'text', nullable: true })
  parseError!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

