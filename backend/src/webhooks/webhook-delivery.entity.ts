import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'webhook_deliveries' })
export class WebhookDeliveryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'uuid', name: 'webhook_endpoint_id' })
  webhookEndpointId!: string;

  @Column({ type: 'varchar', length: 128, name: 'event_name' })
  eventName!: string;

  @Column({ type: 'integer', name: 'attempt_number', default: 1 })
  attemptNumber!: number;

  @Column({ type: 'varchar', length: 32 })
  status!: string;

  @Column({ type: 'integer', name: 'response_status', nullable: true })
  responseStatus!: number | null;

  @Column({ type: 'jsonb', name: 'request_body', default: () => "'{}'::jsonb" })
  requestBody!: Record<string, unknown>;

  @Column({ type: 'text', name: 'response_body', nullable: true })
  responseBody!: string | null;

  @Column({ type: 'timestamptz', name: 'next_retry_at', nullable: true })
  nextRetryAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'delivered_at', nullable: true })
  deliveredAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
