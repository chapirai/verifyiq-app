import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { AuditEventType } from './audit-event.entity';

/**
 * P02-T09: Usage event entity for cost and billing analysis.
 */
@Entity({ name: 'usage_events' })
@Index(['tenantId', 'createdAt'])
@Index(['userId'])
@Index(['eventType'])
@Index(['createdAt'])
@Index(['correlationId'])
export class UsageEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ name: 'event_type', type: 'varchar', length: 64 })
  eventType!: AuditEventType;

  @Column({ name: 'resource_id', type: 'varchar', length: 256, nullable: true })
  resourceId!: string | null;

  @Column({ name: 'action', type: 'varchar', length: 128 })
  action!: string;

  @Column({ name: 'status', type: 'varchar', length: 64 })
  status!: string;

  @Column({ name: 'correlation_id', type: 'varchar', length: 128, nullable: true })
  correlationId!: string | null;

  @Column({ name: 'cost_impact', type: 'jsonb', default: () => "'{}'::jsonb" })
  costImpact!: Record<string, unknown>;

  @Column({ name: 'metadata', type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @Column({ name: 'retention_expires_at', type: 'timestamptz', nullable: true })
  retentionExpiresAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
