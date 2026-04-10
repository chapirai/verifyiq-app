import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'company_raw_payloads' })
export class CompanyRawPayloadEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'organisation_number', type: 'varchar', length: 64 })
  organisationNumber!: string;

  @Column({ name: 'source', type: 'varchar', length: 80 })
  source!: string;

  @Column({ name: 'source_system', type: 'varchar', length: 32, nullable: true })
  sourceSystem?: string | null;

  @Column({ name: 'endpoint_name', type: 'varchar', length: 80, nullable: true })
  endpointName?: string | null;

  @Column({ name: 'identitetsbeteckning', type: 'varchar', length: 64, nullable: true })
  identitetsbeteckning?: string | null;

  @Column({ name: 'dokument_id', type: 'varchar', length: 128, nullable: true })
  dokumentId?: string | null;

  @Column({ name: 'correlation_id', type: 'uuid', nullable: true })
  correlationId?: string | null;

  @Column({ name: 'snapshot_id', type: 'uuid', nullable: true })
  snapshotId?: string | null;

  @Column({ name: 'fetched_at', type: 'timestamptz', nullable: true })
  fetchedAt?: Date | null;

  @Column({ name: 'request_context', type: 'jsonb', default: () => "'{}'::jsonb" })
  requestContext!: Record<string, unknown>;

  @Column({ name: 'request_payload', type: 'jsonb' })
  requestPayload!: Record<string, unknown>;

  @Column({ name: 'response_payload', type: 'jsonb' })
  responsePayload!: Record<string, unknown>;

  @Column({ name: 'request_id', type: 'varchar', length: 128 })
  requestId!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
