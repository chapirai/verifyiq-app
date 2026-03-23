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

  @Column({ name: 'request_payload', type: 'jsonb' })
  requestPayload!: Record<string, unknown>;

  @Column({ name: 'response_payload', type: 'jsonb' })
  responsePayload!: Record<string, unknown>;

  @Column({ name: 'request_id', type: 'varchar', length: 128 })
  requestId!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
