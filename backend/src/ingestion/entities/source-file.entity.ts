import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'source_files' })
@Index(['provider', 'sha256'], { unique: true })
export class SourceFileEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'provider', type: 'varchar', length: 64 })
  provider!: string;

  @Column({ name: 'sha256', type: 'varchar', length: 64 })
  sha256!: string;

  @Column({ name: 'size_bytes', type: 'bigint' })
  sizeBytes!: string;

  @Column({ name: 'r2_object_key', type: 'text' })
  r2ObjectKey!: string;

  @Column({ name: 'content_type', type: 'varchar', length: 128, nullable: true })
  contentType!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

