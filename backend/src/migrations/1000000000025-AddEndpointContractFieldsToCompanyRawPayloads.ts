import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEndpointContractFieldsToCompanyRawPayloads1000000000025 implements MigrationInterface {
  name = 'AddEndpointContractFieldsToCompanyRawPayloads1000000000025';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE company_raw_payloads
      ADD COLUMN IF NOT EXISTS source_system VARCHAR(32) NULL,
      ADD COLUMN IF NOT EXISTS endpoint_name VARCHAR(80) NULL,
      ADD COLUMN IF NOT EXISTS identitetsbeteckning VARCHAR(64) NULL,
      ADD COLUMN IF NOT EXISTS dokument_id VARCHAR(128) NULL,
      ADD COLUMN IF NOT EXISTS correlation_id UUID NULL,
      ADD COLUMN IF NOT EXISTS snapshot_id UUID NULL,
      ADD COLUMN IF NOT EXISTS fetched_at TIMESTAMPTZ NULL,
      ADD COLUMN IF NOT EXISTS request_context JSONB NOT NULL DEFAULT '{}'::jsonb
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_company_raw_payloads_source_endpoint
      ON company_raw_payloads (tenant_id, source_system, endpoint_name, created_at DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_company_raw_payloads_identitet
      ON company_raw_payloads (tenant_id, identitetsbeteckning, created_at DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_company_raw_payloads_identitet`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_company_raw_payloads_source_endpoint`);
    await queryRunner.query(`
      ALTER TABLE company_raw_payloads
      DROP COLUMN IF EXISTS request_context,
      DROP COLUMN IF EXISTS fetched_at,
      DROP COLUMN IF EXISTS snapshot_id,
      DROP COLUMN IF EXISTS correlation_id,
      DROP COLUMN IF EXISTS dokument_id,
      DROP COLUMN IF EXISTS identitetsbeteckning,
      DROP COLUMN IF EXISTS endpoint_name,
      DROP COLUMN IF EXISTS source_system
    `);
  }
}
