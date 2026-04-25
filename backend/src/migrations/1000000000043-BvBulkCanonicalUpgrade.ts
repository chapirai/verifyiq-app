import { MigrationInterface, QueryRunner } from 'typeorm';

export class BvBulkCanonicalUpgrade1000000000043 implements MigrationInterface {
  name = 'BvBulkCanonicalUpgrade1000000000043';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE bv_bulk_raw_rows
        ADD COLUMN IF NOT EXISTS source_file_name TEXT NULL,
        ADD COLUMN IF NOT EXISTS source_file_size_bytes BIGINT NULL,
        ADD COLUMN IF NOT EXISTS source_file_date DATE NULL,
        ADD COLUMN IF NOT EXISTS organisationsidentitet TEXT NULL,
        ADD COLUMN IF NOT EXISTS namnskyddslopnummer TEXT NULL,
        ADD COLUMN IF NOT EXISTS registreringsland TEXT NULL,
        ADD COLUMN IF NOT EXISTS organisationsnamn TEXT NULL,
        ADD COLUMN IF NOT EXISTS organisationsform TEXT NULL,
        ADD COLUMN IF NOT EXISTS avregistreringsdatum TEXT NULL,
        ADD COLUMN IF NOT EXISTS avregistreringsorsak TEXT NULL,
        ADD COLUMN IF NOT EXISTS pagande_avvecklings_eller_omstruktureringsforfarande TEXT NULL,
        ADD COLUMN IF NOT EXISTS registreringsdatum TEXT NULL,
        ADD COLUMN IF NOT EXISTS verksamhetsbeskrivning TEXT NULL,
        ADD COLUMN IF NOT EXISTS postadress TEXT NULL,
        ADD COLUMN IF NOT EXISTS parse_status VARCHAR(32) NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE bv_bulk_company_current
        ADD COLUMN IF NOT EXISTS source_identity_key VARCHAR(160) NULL,
        ADD COLUMN IF NOT EXISTS identity_value VARCHAR(64) NULL,
        ADD COLUMN IF NOT EXISTS identity_type_code VARCHAR(64) NULL,
        ADD COLUMN IF NOT EXISTS identity_type_label VARCHAR(255) NULL,
        ADD COLUMN IF NOT EXISTS personal_identity_number VARCHAR(32) NULL,
        ADD COLUMN IF NOT EXISTS name_protection_sequence_number VARCHAR(64) NULL,
        ADD COLUMN IF NOT EXISTS primary_name_type_code VARCHAR(64) NULL,
        ADD COLUMN IF NOT EXISTS primary_name_type_label VARCHAR(255) NULL,
        ADD COLUMN IF NOT EXISTS legal_form_label VARCHAR(255) NULL,
        ADD COLUMN IF NOT EXISTS deregistration_reason_label VARCHAR(255) NULL,
        ADD COLUMN IF NOT EXISTS raw_postadress TEXT NULL,
        ADD COLUMN IF NOT EXISTS postal_parse_warning TEXT NULL,
        ADD COLUMN IF NOT EXISTS postal_address_line TEXT NULL,
        ADD COLUMN IF NOT EXISTS postal_co_address TEXT NULL,
        ADD COLUMN IF NOT EXISTS postal_city VARCHAR(255) NULL,
        ADD COLUMN IF NOT EXISTS postal_code VARCHAR(32) NULL,
        ADD COLUMN IF NOT EXISTS postal_country_code VARCHAR(16) NULL,
        ADD COLUMN IF NOT EXISTS postal_country_label VARCHAR(255) NULL,
        ADD COLUMN IF NOT EXISTS registration_country_label VARCHAR(255) NULL,
        ADD COLUMN IF NOT EXISTS has_active_restructuring_or_windup BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS active_restructuring_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS active_restructuring_labels JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS source_ingestion_run_id UUID NULL,
        ADD COLUMN IF NOT EXISTS source_raw_line_number INTEGER NULL;
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_bv_bulk_company_current_source_identity_key ON bv_bulk_company_current (source_identity_key);`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS bv_bulk_company_names (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_identity_key VARCHAR(160) NOT NULL,
        source_file_run_id UUID NOT NULL REFERENCES bv_bulk_file_runs(id) ON DELETE CASCADE,
        name TEXT NULL,
        name_type_code VARCHAR(64) NULL,
        name_type_label VARCHAR(255) NULL,
        registration_date DATE NULL,
        extra TEXT NULL,
        ordinal INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_bv_bulk_company_names_identity ON bv_bulk_company_names (source_identity_key);`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_bv_bulk_company_names_run ON bv_bulk_company_names (source_file_run_id);`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS bv_bulk_company_restructuring (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_identity_key VARCHAR(160) NOT NULL,
        source_file_run_id UUID NOT NULL REFERENCES bv_bulk_file_runs(id) ON DELETE CASCADE,
        code VARCHAR(64) NULL,
        label VARCHAR(255) NULL,
        text TEXT NULL,
        from_date DATE NULL,
        ordinal INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_bv_bulk_company_restructuring_identity ON bv_bulk_company_restructuring (source_identity_key);`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_bv_bulk_company_restructuring_run ON bv_bulk_company_restructuring (source_file_run_id);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_bv_bulk_company_restructuring_run;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_bv_bulk_company_restructuring_identity;`);
    await queryRunner.query(`DROP TABLE IF EXISTS bv_bulk_company_restructuring;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_bv_bulk_company_names_run;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_bv_bulk_company_names_identity;`);
    await queryRunner.query(`DROP TABLE IF EXISTS bv_bulk_company_names;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_bv_bulk_company_current_source_identity_key;`);
  }
}

