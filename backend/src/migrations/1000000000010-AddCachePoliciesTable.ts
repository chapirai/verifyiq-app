import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * P02-T04: Cache Policy Engine — creates the cache_policies table and seeds
 * the system-wide default policy.
 */
export class AddCachePoliciesTable1000000000010 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      -- =============================================================================
      -- Migration 010: Cache Policy Engine  (P02-T04)
      --
      -- Creates:
      --   • cache_policies – Configurable freshness-window rules evaluated on
      --                      every data-access request.
      --
      -- Design notes:
      --   • tenant_id NULL → system-wide default policy (is_system_default = true).
      --   • tenant_id set  → tenant-level override (takes precedence over default).
      --   • entity_type + entity_id set → entity-level override (highest priority).
      --   • Only one row should have is_system_default = true at any time.
      -- =============================================================================

      CREATE TABLE IF NOT EXISTS cache_policies (
        id                        UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id                 UUID          REFERENCES tenants(id) ON DELETE CASCADE,
        entity_type               VARCHAR(64),
        entity_id                 VARCHAR(128),
        policy_name               VARCHAR(255)  NOT NULL DEFAULT 'Default Policy',
        freshness_window_hours    INTEGER       NOT NULL DEFAULT 720,
        max_age_hours             INTEGER       NOT NULL DEFAULT 2160,
        refresh_trigger_hours     INTEGER       NOT NULL DEFAULT 1440,
        stale_fallback_allowed    BOOLEAN       NOT NULL DEFAULT TRUE,
        force_refresh_cost_flags  JSONB         NOT NULL DEFAULT '{}'::jsonb,
        is_system_default         BOOLEAN       NOT NULL DEFAULT FALSE,
        is_active                 BOOLEAN       NOT NULL DEFAULT TRUE,
        created_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      );

      -- Tenant-level policy lookup
      CREATE INDEX IF NOT EXISTS idx_cache_policies_tenant_active
        ON cache_policies (tenant_id, is_active)
        WHERE tenant_id IS NOT NULL;

      -- System default lookup
      CREATE INDEX IF NOT EXISTS idx_cache_policies_system_default
        ON cache_policies (is_system_default, is_active)
        WHERE is_system_default = TRUE;

      -- Entity-level scoped lookup
      CREATE INDEX IF NOT EXISTS idx_cache_policies_entity_scope
        ON cache_policies (tenant_id, entity_type, entity_id)
        WHERE entity_type IS NOT NULL AND entity_id IS NOT NULL;

      -- =============================================================================
      -- Seed: system-wide default policy
      -- =============================================================================
      INSERT INTO cache_policies (
        id,
        tenant_id,
        policy_name,
        freshness_window_hours,
        max_age_hours,
        refresh_trigger_hours,
        stale_fallback_allowed,
        force_refresh_cost_flags,
        is_system_default,
        is_active
      ) VALUES (
        gen_random_uuid(),
        NULL,
        'System Default — 30-day freshness, 90-day max age',
        720,
        2160,
        1440,
        TRUE,
        '{}',
        TRUE,
        TRUE
      ) ON CONFLICT DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS cache_policies;
    `);
  }
}
