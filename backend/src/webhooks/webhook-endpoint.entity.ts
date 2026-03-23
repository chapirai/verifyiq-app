import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'webhook_endpoints' })
export class WebhookEndpointEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', name: 'target_url' })
  targetUrl!: string;

  @Column({ type: 'varchar', length: 255, name: 'secret_hash' })
  secretHash!: string;

  @Column({ type: 'jsonb', name: 'subscribed_events', default: () => "'[]'::jsonb" })
  subscribedEvents!: string[];

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
