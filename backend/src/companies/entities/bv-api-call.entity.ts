import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'bolagsverket_api_calls' })
@Index(['tenantId', 'subjectId'])
export class BvApiCallEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'endpoint', type: 'varchar', length: 128 })
  endpoint!: string;

  @Column({ name: 'http_method', type: 'varchar', length: 16, default: 'GET' })
  httpMethod!: string;

  @Column({ name: 'request_url', type: 'text' })
  requestUrl!: string;

  @Column({ name: 'correlation_id', type: 'varchar', length: 128, nullable: true })
  correlationId?: string | null;

  @Column({ name: 'subject_id', type: 'varchar', length: 64, nullable: true })
  subjectId?: string | null;

  @Column({ name: 'request_payload', type: 'jsonb', default: () => "'{}'::jsonb" })
  requestPayload!: Record<string, unknown>;

  @Column({ name: 'response_payload', type: 'jsonb', default: () => "'{}'::jsonb" })
  responsePayload!: Record<string, unknown>;

  @Column({ name: 'http_status_code', type: 'integer', nullable: true })
  httpStatusCode?: number | null;

  @Column({ name: 'duration_ms', type: 'integer', nullable: true })
  durationMs?: number | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string | null;

  @Column({ name: 'called_at', type: 'timestamptz', default: () => 'NOW()' })
  calledAt!: Date;
}
