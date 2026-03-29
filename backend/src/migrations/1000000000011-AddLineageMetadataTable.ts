import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * P02-T06: Lineage Metadata — creates the lineage_metadata table with all
 * required fields and database indexes for query performance.
 */
export class AddLineageMetadataTable1000000000011 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      -- =============================================================================
      -- Migration 011: Lineage Metadata Capture  (P02-T06)
      --
      -- Creates:
      --   • lineage_metadata – Full context of every data operation for
      --                        audit, debugging, and cost analysis.
      --
      -- Design notes:
      --   • tenant_id is NOT NULL – all records are tenant-scoped.
      --   • correlation_id links all records produced within one request chain.
      --   • request_parameters stores a sanitised JSON snapshot of inbound params.
      --   • trigger_type classifies the operation source (API / scheduled / etc.).
      --   • Indexes on correlation_id, user_id, created_at, trigger_type support
      --     the primary query patterns (audit traces, user history, cost analysis).
      -- =============================================================================

      CREATE TABLE IF NOT EXISTS lineage_metadata (
        id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id           UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id             UUID,
        correlation_id      VARCHAR(128)  NOT NULL,
        trigger_type        VARCHAR(64)   NOT NULL,
        http_method         VARCHAR(16),
        source_endpoint     VARCHAR(512),
        request_parameters  JSONB         NOT NULL DEFAULT '{}'::jsonb,
        created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      );

      -- ── Indexes ────────────────────────────────────────────────────────────

      -- Correlation ID lookup (cross-service lineage chain)
      CREATE INDEX IF NOT EXISTS idx_lineage_correlation_id
        ON lineage_metadata (correlation_id);

      -- User activity queries
      CREATE INDEX IF NOT EXISTS idx_lineage_user_id
        ON lineage_metadata (user_id)
        WHERE user_id IS NOT NULL;

      -- Time-range queries and retention scans
      CREATE INDEX IF NOT EXISTS idx_lineage_created_at
        ON lineage_metadata (created_at DESC);

      -- Trigger-type cost analysis
      CREATE INDEX IF NOT EXISTS idx_lineage_trigger_type
        ON lineage_metadata (trigger_type);

      -- Tenant-scoped correlation trace
      CREATE INDEX IF NOT EXISTS idx_lineage_tenant_correlation
        ON lineage_metadata (tenant_id, correlation_id);

      -- Tenant-scoped user history
      CREATE INDEX IF NOT EXISTS idx_lineage_tenant_user
        ON lineage_metadata (tenant_id, user_id)
        WHERE user_id IS NOT NULL;

      -- Tenant-scoped time-range queries (most common audit pattern)
      CREATE INDEX IF NOT EXISTS idx_lineage_tenant_created
        ON lineage_metadata (tenant_id, created_at DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS lineage_metadata;
    `);
  }
}
