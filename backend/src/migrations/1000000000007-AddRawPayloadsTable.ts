import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRawPayloadsTable1000000000007 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      -- =============================================================================
      -- Migration 007: Raw Payload Storage  (P02-T02)
      --
      -- Creates:
      --   • bv_raw_payloads  – Immutable provider response storage with checksum
      --                        deduplication, compression-ready shape, and snapshot
      --                        reference.
      --
      -- Design notes:
      --   • UNIQUE (tenant_id, checksum) enforces per-tenant deduplication.
      --   • content (JSONB)  – flat provider response body; compressible.
      --   • metadata (JSONB) – separable provenance; never compressed.
      --   • compression_algorithm / compression_ratio columns are added now
      --     (nullable) so a future compression job can populate them without a
      --     schema migration.
      -- =============================================================================

      CREATE TABLE IF NOT EXISTS bv_raw_payloads (
        id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id             UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        checksum              VARCHAR(64)   NOT NULL,
        provider_source       VARCHAR(64)   NOT NULL,
        organisationsnummer   VARCHAR(64)   NOT NULL,
        content               JSONB         NOT NULL,
        metadata              JSONB         NOT NULL DEFAULT '{}'::jsonb,
        payload_version       VARCHAR(32)   NOT NULL DEFAULT '1',
        payload_size_bytes    INTEGER       NOT NULL DEFAULT 0,
        compression_algorithm VARCHAR(32),
        compression_ratio     NUMERIC(5,4),
        snapshot_id           UUID,
        is_duplicate          BOOLEAN       NOT NULL DEFAULT FALSE,
        created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

        CONSTRAINT uq_bv_raw_payloads_tenant_checksum
          UNIQUE (tenant_id, checksum)
      );

      -- Support deduplication look-ups by checksum within a tenant
      CREATE INDEX IF NOT EXISTS idx_bv_raw_payloads_tenant_checksum
        ON bv_raw_payloads (tenant_id, checksum);

      -- Support lineage queries: "which raw payload does snapshot S reference?"
      CREATE INDEX IF NOT EXISTS idx_bv_raw_payloads_snapshot_id
        ON bv_raw_payloads (snapshot_id)
        WHERE snapshot_id IS NOT NULL;

      -- Support retention / archival queries by age
      CREATE INDEX IF NOT EXISTS idx_bv_raw_payloads_created_at
        ON bv_raw_payloads (tenant_id, created_at DESC);

      -- Support provider-source audits
      CREATE INDEX IF NOT EXISTS idx_bv_raw_payloads_tenant_provider
        ON bv_raw_payloads (tenant_id, provider_source);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS bv_raw_payloads;
    `);
  }
}
