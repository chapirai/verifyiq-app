import { MigrationInterface, QueryRunner } from 'typeorm';

export class DataPlatformIngestionTables1000000000042 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ingestion_runs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_provider VARCHAR(64) NOT NULL,
        ingestion_type VARCHAR(64) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'queued',
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        finished_at TIMESTAMPTZ,
        records_seen INTEGER NOT NULL DEFAULT 0,
        records_inserted INTEGER NOT NULL DEFAULT 0,
        records_failed INTEGER NOT NULL DEFAULT 0,
        memory_peak_mb INTEGER NOT NULL DEFAULT 0,
        r2_object_key TEXT,
        error_message TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_ingestion_runs_source_started ON ingestion_runs (source_provider, started_at);

      CREATE TABLE IF NOT EXISTS ingestion_source_statuses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_orgnr VARCHAR(32) NOT NULL,
        source_name VARCHAR(64) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'unknown',
        last_success_at TIMESTAMPTZ,
        last_attempt_at TIMESTAMPTZ,
        error_message TEXT,
        data_fresh_until TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_ingestion_source_statuses_org_source UNIQUE (company_orgnr, source_name)
      );

      CREATE TABLE IF NOT EXISTS source_files (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        provider VARCHAR(64) NOT NULL,
        sha256 VARCHAR(64) NOT NULL,
        size_bytes BIGINT NOT NULL,
        r2_object_key TEXT NOT NULL,
        content_type VARCHAR(128),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_source_files_provider_sha UNIQUE (provider, sha256)
      );

      CREATE TABLE IF NOT EXISTS raw_record_lineage (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        run_id UUID NOT NULL,
        provider VARCHAR(64) NOT NULL,
        company_orgnr VARCHAR(32),
        row_number INTEGER NOT NULL,
        raw_record_hash VARCHAR(64) NOT NULL,
        source_file_key TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_raw_record_lineage_run_row ON raw_record_lineage (run_id, row_number);
      CREATE INDEX IF NOT EXISTS idx_raw_record_lineage_hash ON raw_record_lineage (raw_record_hash);

      CREATE TABLE IF NOT EXISTS latest_company_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organisation_number VARCHAR(32) NOT NULL,
        profile_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        source_lineage JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_latest_company_profiles_org UNIQUE (organisation_number)
      );

      CREATE TABLE IF NOT EXISTS company_financial_summaries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organisation_number VARCHAR(32) NOT NULL,
        summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_company_financial_summaries_org UNIQUE (organisation_number)
      );

      CREATE TABLE IF NOT EXISTS company_ownership_summaries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organisation_number VARCHAR(32) NOT NULL,
        summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_company_ownership_summaries_org UNIQUE (organisation_number)
      );

      CREATE TABLE IF NOT EXISTS company_source_statuses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organisation_number VARCHAR(32) NOT NULL,
        source_name VARCHAR(64) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'unknown',
        last_success_at TIMESTAMPTZ,
        last_attempt_at TIMESTAMPTZ,
        error_message TEXT,
        data_fresh_until TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_company_source_statuses_org_source UNIQUE (organisation_number, source_name)
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS company_source_statuses;
      DROP TABLE IF EXISTS company_ownership_summaries;
      DROP TABLE IF EXISTS company_financial_summaries;
      DROP TABLE IF EXISTS latest_company_profiles;
      DROP INDEX IF EXISTS idx_raw_record_lineage_hash;
      DROP INDEX IF EXISTS idx_raw_record_lineage_run_row;
      DROP TABLE IF EXISTS raw_record_lineage;
      DROP TABLE IF EXISTS source_files;
      DROP TABLE IF EXISTS ingestion_source_statuses;
      DROP INDEX IF EXISTS idx_ingestion_runs_source_started;
      DROP TABLE IF EXISTS ingestion_runs;
    `);
  }
}

