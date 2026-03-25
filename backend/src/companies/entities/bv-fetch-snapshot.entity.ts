import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'bolagsverket_fetch_snapshots' })
@Index(['tenantId', 'organisationsnummer', 'fetchedAt'])
@Index(['tenantId', 'organisationsnummer', 'isFromCache'])
export class BvFetchSnapshotEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'organisation_id', type: 'uuid', nullable: true })
  organisationId?: string | null;

  @Column({ name: 'organisationsnummer', type: 'varchar', length: 20 })
  organisationsnummer!: string;

  @Column({ name: 'source_name', type: 'varchar', length: 64, default: 'bolagsverket' })
  sourceName!: string;

  @Column({ name: 'identifier_used', type: 'varchar', length: 64 })
  identifierUsed!: string;

  @Column({ name: 'identifier_type', type: 'varchar', length: 32 })
  identifierType!: string;

  @Column({ name: 'fetch_status', type: 'varchar', length: 32, default: 'success' })
  fetchStatus!: string;

  @Column({ name: 'is_from_cache', type: 'boolean', default: false })
  isFromCache!: boolean;

  @Column({ name: 'cache_hit_reason', type: 'text', nullable: true })
  cacheHitReason?: string | null;

  @Column({ name: 'payload_hash', type: 'varchar', length: 64, nullable: true })
  payloadHash?: string | null;

  @Column({ name: 'raw_payload_summary', type: 'jsonb', default: () => "'{}'::jsonb" })
  rawPayloadSummary!: Record<string, unknown>;

  @Column({ name: 'normalised_summary', type: 'jsonb', default: () => "'{}'::jsonb" })
  normalisedSummary!: Record<string, unknown>;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string | null;

  @Column({ name: 'fetched_at', type: 'timestamptz', default: () => 'NOW()' })
  fetchedAt!: Date;

  @Column({ name: 'api_call_count', type: 'integer', default: 0 })
  apiCallCount!: number;

  @Column({ name: 'data_freshness_days', type: 'integer', nullable: true })
  dataFreshnessDays?: number | null;
}
