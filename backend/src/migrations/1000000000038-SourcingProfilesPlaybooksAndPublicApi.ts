import { MigrationInterface, QueryRunner } from 'typeorm';

export class SourcingProfilesPlaybooksAndPublicApi1000000000038 implements MigrationInterface {
  name = 'SourcingProfilesPlaybooksAndPublicApi1000000000038';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS company_sourcing_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        organisation_number VARCHAR(32) NOT NULL,
        ownership_risk_score NUMERIC(6,2) NOT NULL DEFAULT 0,
        deal_mode_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
        deal_mode_rationale JSONB NOT NULL DEFAULT '{}'::jsonb,
        signals_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_company_sourcing_profiles_tenant_org UNIQUE (tenant_id, organisation_number)
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_company_sourcing_profiles_tenant_updated
      ON company_sourcing_profiles (tenant_id, updated_at DESC);
    `);
    await queryRunner.query(`
      ALTER TABLE target_lists
      ADD COLUMN IF NOT EXISTS playbook JSONB NOT NULL DEFAULT '{}'::jsonb;
    `);
    await queryRunner.query(`
      ALTER TABLE target_list_items
      ADD COLUMN IF NOT EXISTS deal_mode VARCHAR(32) NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE target_list_items
      ADD COLUMN IF NOT EXISTS sourcing_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;
    `);
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS mv_company_sourcing_profiles AS
      SELECT tenant_id, organisation_number, ownership_risk_score, deal_mode_scores, updated_at
      FROM company_sourcing_profiles;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_mv_company_sourcing_profiles_tenant_org
      ON mv_company_sourcing_profiles (tenant_id, organisation_number);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_mv_company_sourcing_profiles_tenant_org;`);
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS mv_company_sourcing_profiles;`);
    await queryRunner.query(`ALTER TABLE target_list_items DROP COLUMN IF EXISTS sourcing_snapshot;`);
    await queryRunner.query(`ALTER TABLE target_list_items DROP COLUMN IF EXISTS deal_mode;`);
    await queryRunner.query(`ALTER TABLE target_lists DROP COLUMN IF EXISTS playbook;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_company_sourcing_profiles_tenant_updated;`);
    await queryRunner.query(`DROP TABLE IF EXISTS company_sourcing_profiles;`);
  }
}

