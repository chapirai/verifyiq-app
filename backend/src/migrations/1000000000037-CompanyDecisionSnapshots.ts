import { MigrationInterface, QueryRunner } from 'typeorm';

export class CompanyDecisionSnapshots1000000000037 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS company_decision_snapshots (
        id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id           UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        organisation_number VARCHAR(64)  NOT NULL,
        strategy_mode       VARCHAR(32)  NOT NULL,
        legal_name          VARCHAR(255),
        summary             TEXT         NOT NULL,
        recommended_action  VARCHAR(128) NOT NULL,
        confidence          VARCHAR(16)  NOT NULL,
        drivers             JSONB        NOT NULL DEFAULT '[]'::jsonb,
        scores              JSONB        NOT NULL DEFAULT '{}'::jsonb,
        created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_company_decision_snapshots_tenant_org_mode_created
        ON company_decision_snapshots (tenant_id, organisation_number, strategy_mode, created_at DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_company_decision_snapshots_tenant_org_mode_created;
      DROP TABLE IF EXISTS company_decision_snapshots;
    `);
  }
}

