import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * P02-T10: Failure-state model for provider outages and degraded responses.
 *
 * Tracks the most recent provider failure state and fallback usage for a given
 * tenant + entity.  Each record represents a single failure or recovery event.
 */
export type FailureState =
  | 'SUCCESS'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_ERROR'
  | 'PROVIDER_UNAVAILABLE'
  | 'NO_DATA_AVAILABLE'
  | 'DEGRADED';

@Entity({ name: 'failure_states' })
@Index(['entityId'])
@Index(['failureState'])
@Index(['createdAt'])
@Index(['tenantId', 'entityType', 'entityId'])
export class FailureStateEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'entity_type', type: 'varchar', length: 64 })
  entityType!: string;

  @Column({ name: 'entity_id', type: 'varchar', length: 128 })
  entityId!: string;

  @Column({ name: 'failure_state', type: 'varchar', length: 32 })
  failureState!: FailureState;

  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason?: string | null;

  @Column({ name: 'last_attempted', type: 'timestamptz' })
  lastAttempted!: Date;

  @Column({ name: 'fallback_used', type: 'boolean', default: false })
  fallbackUsed!: boolean;

  @Column({ name: 'stale_data_timestamp', type: 'timestamptz', nullable: true })
  staleDataTimestamp?: Date | null;

  @Column({ name: 'retry_count', type: 'integer', default: 0 })
  retryCount!: number;

  @Column({ name: 'is_recoverable', type: 'boolean', default: true })
  isRecoverable!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
