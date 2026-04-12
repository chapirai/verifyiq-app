import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Import orchestration, per-source XHTML classification, mapped values, summary,
 * and traceability columns on parse runs / facts / headers.
 */
export class AnnualReportImportWorkspace1000000000030 implements MigrationInterface {
  name = 'AnnualReportImportWorkspace1000000000030';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
BEGIN;

CREATE TABLE IF NOT EXISTS annual_report_imports (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL,
  company_id              UUID REFERENCES companies(id) ON DELETE SET NULL,
  organisationsnummer     VARCHAR(64),
  annual_report_file_id   UUID NOT NULL REFERENCES annual_report_files(id) ON DELETE CASCADE,
  source_zip_filename     VARCHAR(512) NOT NULL,
  source_zip_storage_key  TEXT,
  import_status           VARCHAR(32) NOT NULL DEFAULT 'pending'
    CHECK (import_status IN ('pending', 'extracting', 'parsing', 'completed', 'partial', 'failed')),
  period_start            DATE,
  period_end              DATE,
  fiscal_year             INTEGER,
  primary_source_file_id  UUID,
  primary_context_id      VARCHAR(512),
  primary_parse_run_id    BIGINT,
  error_message           TEXT,
  validation_flags        JSONB NOT NULL DEFAULT '{}'::jsonb,
  imported_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ar_imports_tenant_file ON annual_report_imports (tenant_id, annual_report_file_id);
CREATE INDEX IF NOT EXISTS idx_ar_imports_tenant_org ON annual_report_imports (tenant_id, organisationsnummer);

CREATE TABLE IF NOT EXISTS annual_report_source_files (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  annual_report_import_id  UUID NOT NULL REFERENCES annual_report_imports(id) ON DELETE CASCADE,
  annual_report_file_id    UUID REFERENCES annual_report_files(id) ON DELETE SET NULL,
  file_entry_id            BIGINT REFERENCES annual_report_file_entries(id) ON DELETE SET NULL,
  document_type            VARCHAR(32) NOT NULL
    CHECK (document_type IN ('annual_report', 'audit_report', 'unknown')),
  original_filename        TEXT,
  path_in_archive          TEXT NOT NULL,
  mime_type                VARCHAR(128),
  title                    TEXT,
  file_hash                VARCHAR(64),
  parse_status             VARCHAR(32) NOT NULL DEFAULT 'pending'
    CHECK (parse_status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
  parse_error              TEXT,
  period_start             DATE,
  period_end               DATE,
  fiscal_year              INTEGER,
  entity_identifier        TEXT,
  is_primary_document      BOOLEAN NOT NULL DEFAULT FALSE,
  classification_score     INTEGER,
  classification_reasons   JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ar_source_files_import ON annual_report_source_files (annual_report_import_id);
CREATE INDEX IF NOT EXISTS idx_ar_source_files_type ON annual_report_source_files (annual_report_import_id, document_type);

CREATE TABLE IF NOT EXISTS annual_report_sections (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_file_id    UUID NOT NULL REFERENCES annual_report_source_files(id) ON DELETE CASCADE,
  section_order     INTEGER NOT NULL DEFAULT 0,
  heading_text      TEXT,
  heading_level     INTEGER,
  normalized_heading TEXT,
  text_content      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ar_sections_source ON annual_report_sections (source_file_id, section_order);

CREATE TABLE IF NOT EXISTS annual_report_mapped_values (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  annual_report_import_id  UUID NOT NULL REFERENCES annual_report_imports(id) ON DELETE CASCADE,
  source_file_id           UUID REFERENCES annual_report_source_files(id) ON DELETE SET NULL,
  parse_run_id             BIGINT REFERENCES annual_report_parse_runs(id) ON DELETE SET NULL,
  fact_id                  BIGINT REFERENCES annual_report_xbrl_facts(id) ON DELETE SET NULL,
  org_number               VARCHAR(64),
  fiscal_year              INTEGER,
  document_type            VARCHAR(32) NOT NULL,
  statement_type           VARCHAR(64),
  value_code               VARCHAR(128) NOT NULL,
  value_label              TEXT,
  value_text               TEXT,
  value_numeric            NUMERIC(30, 10),
  value_date               DATE,
  currency                 VARCHAR(16),
  period_start             DATE,
  period_end               DATE,
  instant_date             DATE,
  priority_rank            INTEGER NOT NULL DEFAULT 0,
  mapping_rule             VARCHAR(256),
  mapping_confidence       NUMERIC(5, 4),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ar_mapped_import ON annual_report_mapped_values (annual_report_import_id);
CREATE INDEX IF NOT EXISTS idx_ar_mapped_stmt ON annual_report_mapped_values (annual_report_import_id, statement_type);

CREATE TABLE IF NOT EXISTS annual_report_summary (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  annual_report_import_id  UUID NOT NULL UNIQUE REFERENCES annual_report_imports(id) ON DELETE CASCADE,
  org_number               VARCHAR(64),
  fiscal_year              INTEGER,
  period_start             DATE,
  period_end               DATE,
  currency                 VARCHAR(16),
  revenue                  NUMERIC(30, 10),
  gross_profit             NUMERIC(30, 10),
  operating_profit         NUMERIC(30, 10),
  profit_before_tax        NUMERIC(30, 10),
  net_profit               NUMERIC(30, 10),
  total_assets             NUMERIC(30, 10),
  fixed_assets             NUMERIC(30, 10),
  current_assets           NUMERIC(30, 10),
  equity                   NUMERIC(30, 10),
  untaxed_reserves         NUMERIC(30, 10),
  provisions               NUMERIC(30, 10),
  long_term_liabilities    NUMERIC(30, 10),
  short_term_liabilities   NUMERIC(30, 10),
  cash_and_bank            NUMERIC(30, 10),
  net_sales                NUMERIC(30, 10),
  employee_count           NUMERIC(20, 4),
  auditor_name             TEXT,
  audit_opinion            TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE annual_report_parse_runs
  ADD COLUMN IF NOT EXISTS annual_report_import_id UUID REFERENCES annual_report_imports(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS source_file_id UUID REFERENCES annual_report_source_files(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS document_type VARCHAR(32);

CREATE INDEX IF NOT EXISTS idx_ar_parse_runs_import ON annual_report_parse_runs (annual_report_import_id);

ALTER TABLE annual_report_xbrl_facts
  ADD COLUMN IF NOT EXISTS source_file_id UUID REFERENCES annual_report_source_files(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS document_type VARCHAR(32),
  ADD COLUMN IF NOT EXISTS section_heading TEXT;

CREATE INDEX IF NOT EXISTS idx_ar_facts_source ON annual_report_xbrl_facts (source_file_id);

ALTER TABLE annual_report_file_entries
  ADD COLUMN IF NOT EXISTS source_file_id UUID REFERENCES annual_report_source_files(id) ON DELETE SET NULL;

ALTER TABLE company_annual_report_headers
  ADD COLUMN IF NOT EXISTS annual_report_import_id UUID REFERENCES annual_report_imports(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS primary_context_id VARCHAR(512),
  ADD COLUMN IF NOT EXISTS primary_source_file_id UUID,
  ADD COLUMN IF NOT EXISTS fiscal_year INTEGER;

CREATE INDEX IF NOT EXISTS idx_company_ar_headers_import ON company_annual_report_headers (annual_report_import_id);

COMMIT;
`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
BEGIN;

ALTER TABLE company_annual_report_headers
  DROP COLUMN IF EXISTS fiscal_year,
  DROP COLUMN IF EXISTS primary_source_file_id,
  DROP COLUMN IF EXISTS primary_context_id,
  DROP COLUMN IF EXISTS annual_report_import_id;

ALTER TABLE annual_report_file_entries
  DROP COLUMN IF EXISTS source_file_id;

ALTER TABLE annual_report_xbrl_facts
  DROP COLUMN IF EXISTS section_heading,
  DROP COLUMN IF EXISTS document_type,
  DROP COLUMN IF EXISTS source_file_id;

DROP INDEX IF EXISTS idx_ar_parse_runs_import;
ALTER TABLE annual_report_parse_runs
  DROP COLUMN IF EXISTS document_type,
  DROP COLUMN IF EXISTS source_file_id,
  DROP COLUMN IF EXISTS annual_report_import_id;

DROP TABLE IF EXISTS annual_report_summary;
DROP TABLE IF EXISTS annual_report_mapped_values;
DROP TABLE IF EXISTS annual_report_sections;
DROP TABLE IF EXISTS annual_report_source_files;
DROP TABLE IF EXISTS annual_report_imports;

COMMIT;
`);
  }
}
