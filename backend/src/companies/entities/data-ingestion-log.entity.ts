import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Audit trail for every failed or partial data ingestion event.
 *
 * Spec ref: §8.3 Logging (foretagsinformation/v4) and §14 Error Logging (HVD).
 */
@Entity({ name: 'data_ingestion_logs' })
@Index(['tenantId', 'createdAt'])
@Index(['provider', 'endpoint'])
@Index(['organisationId'])
export class DataIngestionLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Provider name, e.g. "bolagsverket" or "vardefulla_datamangder". */
  @Column({ name: 'provider', type: 'varchar', length: 80 })
  provider!: string;

  /** Endpoint path, e.g. "/foretagsinformation/v4/finansiellarapporter". */
  @Column({ name: 'endpoint', type: 'varchar', length: 200 })
  endpoint!: string;

  /** Organisation / person identity number the request was made for. */
  @Column({ name: 'organisation_id', type: 'varchar', length: 20, nullable: true })
  organisationId!: string | null;

  /** HVD dataset discriminator when applicable, e.g. "organisationer". */
  @Column({ name: 'dataset', type: 'varchar', length: 80, nullable: true })
  dataset!: string | null;

  /**
   * JSON-path of the specific field that failed (HVD field-level errors).
   * Null for full-request failures.
   */
  @Column({ name: 'field', type: 'varchar', length: 200, nullable: true })
  field!: string | null;

  /** Error type code, e.g. "OTILLGANGLIG_UPPGIFTSKALLA", "HTTP_401", "HTTP_500". */
  @Column({ name: 'error_type', type: 'varchar', length: 120 })
  errorType!: string;

  /** Additional context: HTTP status, message, correlation ID, etc. */
  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  /** Tenant that triggered the ingestion. */
  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
