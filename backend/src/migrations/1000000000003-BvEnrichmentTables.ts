import { MigrationInterface, QueryRunner } from 'typeorm';

export class BvEnrichmentTables1000000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      -- =============================================================================
      -- Migration 003: Bolagsverket Enrichment Tables
      --
      -- Creates:
      --   • bolagsverket_fetch_snapshots  – Cache/freshness tracking per org lookup
      --   • bolagsverket_stored_documents – MinIO document storage metadata
      -- =============================================================================

      -- ---------------------------------------------------------------------------
      -- 1. Fetch Snapshots
      --    Records every enrichment attempt (fresh + cached) for audit/cache TTL.
      -- ---------------------------------------------------------------------------
      CREATE TABLE IF NOT EXISTS bolagsverket_fetch_snapshots (
        id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id            UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        organisation_id      UUID         REFERENCES bolagsverket_organisationer(id) ON DELETE SET NULL,
        organisationsnummer  VARCHAR(20)  NOT NULL,
        source_name          VARCHAR(64)  NOT NULL DEFAULT 'bolagsverket',
        identifier_used      VARCHAR(64)  NOT NULL,
        identifier_type      VARCHAR(32)  NOT NULL,
        fetch_status         VARCHAR(32)  NOT NULL DEFAULT 'success',
        is_from_cache        BOOLEAN      NOT NULL DEFAULT FALSE,
        cache_hit_reason     TEXT,
        payload_hash         VARCHAR(64),
        raw_payload_summary  JSONB        NOT NULL DEFAULT '{}'::jsonb,
        normalised_summary   JSONB        NOT NULL DEFAULT '{}'::jsonb,
        error_message        TEXT,
        fetched_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        api_call_count       INTEGER      NOT NULL DEFAULT 0,
        data_freshness_days  INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_bv_fetch_snapshots_tenant_org_fetched
        ON bolagsverket_fetch_snapshots (tenant_id, organisationsnummer, fetched_at DESC);

      CREATE INDEX IF NOT EXISTS idx_bv_fetch_snapshots_tenant_org_cache
        ON bolagsverket_fetch_snapshots (tenant_id, organisationsnummer, is_from_cache);

      -- ---------------------------------------------------------------------------
      -- 2. Stored Documents
      --    Tracks documents downloaded from Bolagsverket and stored in MinIO.
      -- ---------------------------------------------------------------------------
      CREATE TABLE IF NOT EXISTS bolagsverket_stored_documents (
        id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id           UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        organisationsnummer VARCHAR(20)   NOT NULL,
        organisation_id     UUID          REFERENCES bolagsverket_organisationer(id) ON DELETE SET NULL,
        document_id_source  VARCHAR(128),
        document_type       VARCHAR(64),
        document_year       VARCHAR(16),
        file_name           VARCHAR(255)  NOT NULL,
        content_type        VARCHAR(128),
        size_bytes          BIGINT,
        storage_bucket      VARCHAR(128)  NOT NULL DEFAULT 'verifyiq-documents',
        storage_key         VARCHAR(512)  NOT NULL,
        source_url          TEXT,
        checksum_sha256     VARCHAR(64),
        is_duplicate        BOOLEAN       NOT NULL DEFAULT FALSE,
        download_status     VARCHAR(32)   NOT NULL DEFAULT 'pending',
        error_message       TEXT,
        downloaded_at       TIMESTAMPTZ,
        created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_bv_stored_docs_tenant_org
        ON bolagsverket_stored_documents (tenant_id, organisationsnummer);

      CREATE UNIQUE INDEX IF NOT EXISTS idx_bv_stored_docs_dedup
        ON bolagsverket_stored_documents (tenant_id, organisationsnummer, document_id_source, document_year)
        WHERE document_id_source IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS bolagsverket_stored_documents;
      DROP TABLE IF EXISTS bolagsverket_fetch_snapshots;
    `);
  }
}
