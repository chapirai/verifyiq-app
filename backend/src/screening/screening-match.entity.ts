import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'screening_matches' })
export class ScreeningMatchEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'screening_job_id', type: 'uuid' })
  screeningJobId!: string;

  @Column({ name: 'match_status', type: 'varchar', length: 32 })
  matchStatus!: string;

  @Column({ type: 'varchar', length: 64 })
  source!: string;

  @Column({ type: 'varchar', length: 64 })
  category!: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  score?: number | null;

  @Column({ name: 'subject_name', type: 'varchar', length: 255 })
  subjectName!: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  payload!: Record<string, unknown>;

  @Column({ name: 'reviewed_by_user_id', type: 'uuid', nullable: true })
  reviewedByUserId?: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt?: Date | null;

  @Column({ name: 'review_notes', type: 'text', nullable: true })
  reviewNotes?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
