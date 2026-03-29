import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNormalizedCompaniesTable1000000000009 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      -- =============================================================================
      -- Migration 009: Normalized Company Serving Layer  (P02-T03)
      --
      -- Creates:
      --   • normalized_companies  – Canonical, tenant-scoped operational view of a
      --                             company; the single source of truth for UI queries.
      --   • company_versions      – Point-in-time attribute history for audit,
      --                             debugging, and compliance.
      --
      -- Design notes:
      --   • UNIQUE (tenant_id, org_number) on normalized_companies enforces canonical
      --     identity: one record per org per tenant.
      --   • Freshness metadata (freshness_status, last_normalized_at, last_snapshot_id)
      --     allows consumers to surface staleness warnings without querying snapshots.
      --   • Raw payload content is never stored here; lineage is via snapshot FKs.
      --   • company_versions rows are immutable; always INSERT, never UPDATE.
      -- =============================================================================

      CREATE TABLE IF NOT EXISTS normalized_companies (
        id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id           UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        org_number          VARCHAR(64)   NOT NULL,

        -- Normalized business attributes
        legal_name          VARCHAR(255)  NOT NULL,
        company_form        VARCHAR(100),
        status              VARCHAR(100),
        country_code        VARCHAR(2)    NOT NULL DEFAULT 'SE',
        registered_at       TIMESTAMPTZ,
        address             JSONB         NOT NULL DEFAULT '{}'::jsonb,
        business_description TEXT,
        signatory_text      TEXT,
        officers            JSONB         NOT NULL DEFAULT '[]'::jsonb,
        share_information   JSONB         NOT NULL DEFAULT '{}'::jsonb,
        financial_reports   JSONB         NOT NULL DEFAULT '[]'::jsonb,

        -- Versioning and schema
        version             INTEGER       NOT NULL DEFAULT 1,
        schema_version      VARCHAR(16)   NOT NULL DEFAULT '1',

        -- Freshness and lineage metadata
        freshness_status    VARCHAR(16)   NOT NULL DEFAULT 'fresh',
        last_normalized_at  TIMESTAMPTZ,
        last_snapshot_id    UUID          REFERENCES bolagsverket_fetch_snapshots(id) ON DELETE SET NULL,
        last_raw_payload_id UUID          REFERENCES bv_raw_payloads(id) ON DELETE SET NULL,

        created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

        CONSTRAINT uq_normalized_companies_tenant_org
          UNIQUE (tenant_id, org_number)
      );

      -- Fast serving-layer queries: by tenant (most recent first)
      CREATE INDEX IF NOT EXISTS idx_normalized_companies_tenant_updated
        ON normalized_companies (tenant_id, updated_at DESC);

      -- Name search within tenant
      CREATE INDEX IF NOT EXISTS idx_normalized_companies_tenant_name
        ON normalized_companies (tenant_id, legal_name);

      -- Freshness monitoring: "all stale/degraded companies for a tenant"
      CREATE INDEX IF NOT EXISTS idx_normalized_companies_tenant_freshness
        ON normalized_companies (tenant_id, freshness_status);

      -- Lineage look-up: "which normalized company references snapshot S?"
      CREATE INDEX IF NOT EXISTS idx_normalized_companies_last_snapshot
        ON normalized_companies (last_snapshot_id)
        WHERE last_snapshot_id IS NOT NULL;

      -- =============================================================================

      CREATE TABLE IF NOT EXISTS company_versions (
        id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id             UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        org_number            VARCHAR(64)   NOT NULL,
        normalized_company_id UUID          NOT NULL REFERENCES normalized_companies(id) ON DELETE CASCADE,
        version               INTEGER       NOT NULL,
        attributes            JSONB         NOT NULL,
        changed_fields        JSONB         NOT NULL DEFAULT '[]'::jsonb,
        schema_version        VARCHAR(16)   NOT NULL DEFAULT '1',
        snapshot_id           UUID          REFERENCES bolagsverket_fetch_snapshots(id) ON DELETE SET NULL,
        raw_payload_id        UUID          REFERENCES bv_raw_payloads(id) ON DELETE SET NULL,
        created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      );

      -- Retrieve version history for an org in chronological order
      CREATE INDEX IF NOT EXISTS idx_company_versions_tenant_org_version
        ON company_versions (tenant_id, org_number, version DESC);

      -- Retrieve version history by timestamp
      CREATE INDEX IF NOT EXISTS idx_company_versions_tenant_org_created
        ON company_versions (tenant_id, org_number, created_at DESC);

      -- Lineage look-up: "which version was produced by snapshot S?"
      CREATE INDEX IF NOT EXISTS idx_company_versions_snapshot_id
        ON company_versions (snapshot_id)
        WHERE snapshot_id IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS company_versions;
      DROP TABLE IF EXISTS normalized_companies;
    `);
  }
}
