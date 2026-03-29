import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSnapshotLineageColumns1000000000006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      -- =============================================================================
      -- Migration 006: Add Snapshot Lineage, Policy, and Cost Columns  (P02-T01)
      --
      -- Extends bolagsverket_fetch_snapshots with:
      --   • correlation_id    – request-scoped lineage token
      --   • actor_id          – user/service that triggered the fetch
      --   • policy_decision   – cache_hit | fresh_fetch | force_refresh | stale_fallback
      --   • cost_impact_flags – provider cost/quota metadata (JSONB)
      --   • is_stale_fallback – flag set when provider was unavailable
      -- =============================================================================

      ALTER TABLE bolagsverket_fetch_snapshots
        ADD COLUMN IF NOT EXISTS correlation_id    VARCHAR(128),
        ADD COLUMN IF NOT EXISTS actor_id          UUID,
        ADD COLUMN IF NOT EXISTS policy_decision   VARCHAR(32) NOT NULL DEFAULT 'fresh_fetch',
        ADD COLUMN IF NOT EXISTS cost_impact_flags JSONB       NOT NULL DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS is_stale_fallback BOOLEAN     NOT NULL DEFAULT FALSE;

      -- Index to support lineage queries by correlation_id (e.g. audit trail look-ups)
      CREATE INDEX IF NOT EXISTS idx_bv_fetch_snapshots_tenant_correlation
        ON bolagsverket_fetch_snapshots (tenant_id, correlation_id)
        WHERE correlation_id IS NOT NULL;

      -- Index to support policy-based reporting (e.g. force_refresh rate analytics)
      CREATE INDEX IF NOT EXISTS idx_bv_fetch_snapshots_policy
        ON bolagsverket_fetch_snapshots (tenant_id, policy_decision, fetched_at DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_bv_fetch_snapshots_policy;
      DROP INDEX IF EXISTS idx_bv_fetch_snapshots_tenant_correlation;

      ALTER TABLE bolagsverket_fetch_snapshots
        DROP COLUMN IF EXISTS is_stale_fallback,
        DROP COLUMN IF EXISTS cost_impact_flags,
        DROP COLUMN IF EXISTS policy_decision,
        DROP COLUMN IF EXISTS actor_id,
        DROP COLUMN IF EXISTS correlation_id;
    `);
  }
}
