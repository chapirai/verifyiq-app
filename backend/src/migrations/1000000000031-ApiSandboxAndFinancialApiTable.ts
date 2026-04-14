import { MigrationInterface, QueryRunner } from 'typeorm';

export class ApiSandboxAndFinancialApiTable1000000000031 implements MigrationInterface {
  name = 'ApiSandboxAndFinancialApiTable1000000000031';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
BEGIN;

ALTER TABLE api_keys
  ADD COLUMN IF NOT EXISTS environment VARCHAR(16) NOT NULL DEFAULT 'live'
    CHECK (environment IN ('live', 'sandbox'));

CREATE INDEX IF NOT EXISTS idx_api_keys_tenant_env_revoked
  ON api_keys (tenant_id, environment, revoked_at);

CREATE TABLE IF NOT EXISTS annual_report_api_financial_rows (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL,
  organisationsnummer     VARCHAR(64) NOT NULL,
  fiscal_year             INTEGER,
  statement_type          VARCHAR(64) NOT NULL,
  value_code              VARCHAR(128) NOT NULL,
  value_label             TEXT,
  period_kind             VARCHAR(32) NOT NULL,
  value_numeric           DECIMAL(30,10),
  value_text              TEXT,
  currency_code           VARCHAR(16),
  source_header_id        UUID NOT NULL REFERENCES company_annual_report_headers(id) ON DELETE CASCADE,
  source_import_id        UUID REFERENCES annual_report_imports(id) ON DELETE SET NULL,
  source_fact_ids         BIGINT[] NOT NULL DEFAULT '{}',
  ranking_score           INTEGER NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, organisationsnummer, fiscal_year, statement_type, value_code, period_kind, source_header_id)
);

CREATE INDEX IF NOT EXISTS idx_ar_api_fin_rows_tenant_org_year
  ON annual_report_api_financial_rows (tenant_id, organisationsnummer, fiscal_year);
CREATE INDEX IF NOT EXISTS idx_ar_api_fin_rows_stmt
  ON annual_report_api_financial_rows (statement_type, value_code);

CREATE INDEX IF NOT EXISTS idx_usage_events_tenant_action_created
  ON usage_events (tenant_id, action, created_at);

COMMIT;
`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
BEGIN;

DROP INDEX IF EXISTS idx_usage_events_tenant_action_created;
DROP INDEX IF EXISTS idx_ar_api_fin_rows_stmt;
DROP INDEX IF EXISTS idx_ar_api_fin_rows_tenant_org_year;
DROP TABLE IF EXISTS annual_report_api_financial_rows;
DROP INDEX IF EXISTS idx_api_keys_tenant_env_revoked;
ALTER TABLE api_keys DROP COLUMN IF EXISTS environment;

COMMIT;
`);
  }
}
