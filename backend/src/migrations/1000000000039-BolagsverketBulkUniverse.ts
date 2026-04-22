import { MigrationInterface, QueryRunner } from 'typeorm';

export class BolagsverketBulkUniverse1000000000039 implements MigrationInterface {
  name = 'BolagsverketBulkUniverse1000000000039';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS bv_bulk_file_runs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_url TEXT NOT NULL,
        downloaded_at TIMESTAMPTZ NOT NULL,
        effective_date DATE NULL,
        zip_object_key TEXT NOT NULL,
        txt_object_key TEXT NOT NULL,
        zip_sha256 VARCHAR(64) NOT NULL UNIQUE,
        txt_sha256 VARCHAR(64) NOT NULL,
        row_count INTEGER NOT NULL DEFAULT 0,
        status VARCHAR(32) NOT NULL DEFAULT 'downloaded',
        error_message TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_bv_bulk_file_runs_downloaded_at ON bv_bulk_file_runs (downloaded_at DESC);`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS bv_bulk_raw_rows (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        file_run_id UUID NOT NULL REFERENCES bv_bulk_file_runs(id) ON DELETE CASCADE,
        line_number INTEGER NOT NULL,
        raw_line TEXT NOT NULL,
        parsed_ok BOOLEAN NOT NULL DEFAULT TRUE,
        parse_error TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_bv_bulk_raw_rows_file_line UNIQUE (file_run_id, line_number)
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS bv_bulk_companies_staging (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        file_run_id UUID NOT NULL REFERENCES bv_bulk_file_runs(id) ON DELETE CASCADE,
        organisation_identity_raw TEXT NULL,
        identity_value VARCHAR(64) NULL,
        identity_type VARCHAR(64) NULL,
        namnskyddslopnummer VARCHAR(64) NULL,
        registration_country_code VARCHAR(16) NULL,
        organisation_names_raw TEXT NULL,
        organisation_form_code VARCHAR(64) NULL,
        deregistration_date DATE NULL,
        deregistration_reason_code VARCHAR(64) NULL,
        deregistration_reason_text TEXT NULL,
        restructuring_raw TEXT NULL,
        registration_date DATE NULL,
        business_description TEXT NULL,
        postal_address_raw TEXT NULL,
        delivery_address TEXT NULL,
        co_address TEXT NULL,
        postal_code VARCHAR(32) NULL,
        city VARCHAR(255) NULL,
        country_code VARCHAR(16) NULL,
        content_hash VARCHAR(64) NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_bv_bulk_companies_staging_file_identity ON bv_bulk_companies_staging (file_run_id, identity_value);`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS bv_bulk_company_current (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organisation_number VARCHAR(32) NOT NULL UNIQUE,
        identity_type VARCHAR(64) NULL,
        name_primary VARCHAR(255) NULL,
        name_all_jsonb JSONB NOT NULL DEFAULT '[]'::jsonb,
        organisation_form_code VARCHAR(64) NULL,
        organisation_form_text VARCHAR(255) NULL,
        registration_date DATE NULL,
        deregistration_date DATE NULL,
        deregistration_reason_code VARCHAR(64) NULL,
        deregistration_reason_text TEXT NULL,
        restructuring_status_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
        business_description TEXT NULL,
        postal_address_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
        registrations_country_code VARCHAR(16) NULL,
        source_file_run_id UUID NULL REFERENCES bv_bulk_file_runs(id) ON DELETE SET NULL,
        source_last_seen_at TIMESTAMPTZ NULL,
        first_seen_at TIMESTAMPTZ NULL,
        last_seen_at TIMESTAMPTZ NULL,
        current_record_hash VARCHAR(64) NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        is_deregistered BOOLEAN NOT NULL DEFAULT FALSE,
        seed_state VARCHAR(32) NOT NULL DEFAULT 'BULK_ONLY',
        deep_data_fresh_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_bv_bulk_company_current_seed_state ON bv_bulk_company_current (seed_state);`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS bv_bulk_company_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organisation_number VARCHAR(32) NOT NULL,
        file_run_id UUID NOT NULL REFERENCES bv_bulk_file_runs(id) ON DELETE CASCADE,
        change_type VARCHAR(32) NOT NULL,
        snapshot_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
        record_hash VARCHAR(64) NULL,
        valid_from TIMESTAMPTZ NOT NULL,
        valid_to TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_bv_bulk_company_history_org_valid_from ON bv_bulk_company_history (organisation_number, valid_from DESC);`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS bv_bulk_enrichment_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organisation_number VARCHAR(32) NOT NULL,
        requested_by_user_id UUID NULL,
        requested_by_tenant_id UUID NOT NULL,
        reason VARCHAR(64) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'queued',
        priority INTEGER NOT NULL DEFAULT 100,
        requested_at TIMESTAMPTZ NOT NULL,
        started_at TIMESTAMPTZ NULL,
        finished_at TIMESTAMPTZ NULL,
        error_message TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_bv_bulk_enrichment_requests_org_status ON bv_bulk_enrichment_requests (organisation_number, status);`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS bv_bulk_run_checkpoints (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        file_run_id UUID NOT NULL REFERENCES bv_bulk_file_runs(id) ON DELETE CASCADE,
        checkpoint_seq INTEGER NOT NULL,
        last_line_number INTEGER NOT NULL,
        rows_written INTEGER NOT NULL DEFAULT 0,
        staging_written INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_bv_bulk_run_checkpoints_file_seq UNIQUE (file_run_id, checkpoint_seq)
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_bv_bulk_enrichment_requests_org_status;`);
    await queryRunner.query(`DROP TABLE IF EXISTS bv_bulk_enrichment_requests;`);
    await queryRunner.query(`DROP TABLE IF EXISTS bv_bulk_run_checkpoints;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_bv_bulk_company_history_org_valid_from;`);
    await queryRunner.query(`DROP TABLE IF EXISTS bv_bulk_company_history;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_bv_bulk_company_current_seed_state;`);
    await queryRunner.query(`DROP TABLE IF EXISTS bv_bulk_company_current;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_bv_bulk_companies_staging_file_identity;`);
    await queryRunner.query(`DROP TABLE IF EXISTS bv_bulk_companies_staging;`);
    await queryRunner.query(`DROP TABLE IF EXISTS bv_bulk_raw_rows;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_bv_bulk_file_runs_downloaded_at;`);
    await queryRunner.query(`DROP TABLE IF EXISTS bv_bulk_file_runs;`);
  }
}

