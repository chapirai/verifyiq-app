import { MigrationInterface, QueryRunner } from 'typeorm';

export class CompanySignalsTable1000000000035 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS company_signals (
        id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id             UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        organisation_number   VARCHAR(64)  NOT NULL,
        signal_type           VARCHAR(64)  NOT NULL,
        engine_version        VARCHAR(32)  NOT NULL,
        score                 NUMERIC(12,4),
        explanation           JSONB        NOT NULL DEFAULT '{}'::jsonb,
        job_id                VARCHAR(128),
        computed_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_company_signals_tenant_org_type_computed
        ON company_signals (tenant_id, organisation_number, signal_type, computed_at DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS company_signals;`);
  }
}
