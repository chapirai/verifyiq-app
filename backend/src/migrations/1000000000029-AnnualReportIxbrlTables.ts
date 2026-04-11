import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Annual report ZIP → iXBRL extraction pipeline storage (raw XBRL + normalized serving).
 * Idempotency: files deduped by (tenant_id, content_sha256); facts keyed per parse_run.
 */
export class AnnualReportIxbrlTables1000000000029 implements MigrationInterface {
  name = 'AnnualReportIxbrlTables1000000000029';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
BEGIN;

-- ── Ingestion / lifecycle ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS annual_report_files (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL,
  company_id            UUID REFERENCES companies(id) ON DELETE SET NULL,
  organisationsnummer   VARCHAR(64),
  bv_stored_document_id UUID REFERENCES bolagsverket_stored_documents(id) ON DELETE SET NULL,
  original_filename     VARCHAR(512) NOT NULL,
  content_type          VARCHAR(128),
  content_sha256        VARCHAR(64) NOT NULL,
  size_bytes            BIGINT NOT NULL,
  storage_bucket        VARCHAR(128),
  storage_key           VARCHAR(512),
  status                VARCHAR(32) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'extracting', 'extracted', 'normalized', 'failed')),
  ixbrl_entry_path      TEXT,
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_annual_report_files_tenant_sha UNIQUE (tenant_id, content_sha256)
);

CREATE INDEX IF NOT EXISTS idx_annual_report_files_tenant_org
  ON annual_report_files (tenant_id, organisationsnummer);
CREATE INDEX IF NOT EXISTS idx_annual_report_files_tenant_status
  ON annual_report_files (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_annual_report_files_company
  ON annual_report_files (company_id) WHERE company_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS annual_report_file_entries (
  id                BIGSERIAL PRIMARY KEY,
  file_id           UUID NOT NULL REFERENCES annual_report_files(id) ON DELETE CASCADE,
  path_in_archive   TEXT NOT NULL,
  uncompressed_size BIGINT NOT NULL DEFAULT 0,
  is_directory      BOOLEAN NOT NULL DEFAULT FALSE,
  content_sha256    VARCHAR(64),
  is_candidate_ixbrl BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_annual_report_file_entries UNIQUE (file_id, path_in_archive)
);

CREATE INDEX IF NOT EXISTS idx_annual_report_file_entries_file ON annual_report_file_entries (file_id);

CREATE TABLE IF NOT EXISTS annual_report_parse_runs (
  id                BIGSERIAL PRIMARY KEY,
  file_id           UUID NOT NULL REFERENCES annual_report_files(id) ON DELETE CASCADE,
  parser_name       VARCHAR(64) NOT NULL DEFAULT 'arelle',
  parser_version    VARCHAR(32) NOT NULL,
  status            VARCHAR(32) NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed')),
  fact_count        INTEGER NOT NULL DEFAULT 0,
  context_count     INTEGER NOT NULL DEFAULT 0,
  unit_count        INTEGER NOT NULL DEFAULT 0,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ,
  source_ixbrl_path TEXT,
  raw_model_summary JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_annual_report_parse_runs_file ON annual_report_parse_runs (file_id, started_at DESC);

CREATE TABLE IF NOT EXISTS annual_report_parse_errors (
  id            BIGSERIAL PRIMARY KEY,
  parse_run_id  BIGINT REFERENCES annual_report_parse_runs(id) ON DELETE CASCADE,
  file_id       UUID REFERENCES annual_report_files(id) ON DELETE SET NULL,
  phase         VARCHAR(64) NOT NULL,
  code          VARCHAR(64),
  message       TEXT NOT NULL,
  detail        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_annual_report_parse_errors_run ON annual_report_parse_errors (parse_run_id);

-- ── Raw XBRL / iXBRL ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS annual_report_xbrl_contexts (
  id               BIGSERIAL PRIMARY KEY,
  parse_run_id     BIGINT NOT NULL REFERENCES annual_report_parse_runs(id) ON DELETE CASCADE,
  xbrl_context_id  VARCHAR(512) NOT NULL,
  period_instant   DATE,
  period_start     DATE,
  period_end       DATE,
  dimensions       JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_json         JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT uq_ar_xbrl_contexts UNIQUE (parse_run_id, xbrl_context_id)
);

CREATE INDEX IF NOT EXISTS idx_ar_xbrl_contexts_run ON annual_report_xbrl_contexts (parse_run_id);

CREATE TABLE IF NOT EXISTS annual_report_xbrl_units (
  id              BIGSERIAL PRIMARY KEY,
  parse_run_id    BIGINT NOT NULL REFERENCES annual_report_parse_runs(id) ON DELETE CASCADE,
  xbrl_unit_id    VARCHAR(512) NOT NULL,
  measures        JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw_json        JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT uq_ar_xbrl_units UNIQUE (parse_run_id, xbrl_unit_id)
);

CREATE INDEX IF NOT EXISTS idx_ar_xbrl_units_run ON annual_report_xbrl_units (parse_run_id);

CREATE TABLE IF NOT EXISTS annual_report_xbrl_facts (
  id               BIGSERIAL PRIMARY KEY,
  parse_run_id     BIGINT NOT NULL REFERENCES annual_report_parse_runs(id) ON DELETE CASCADE,
  sequence_index   INTEGER NOT NULL,
  context_ref      VARCHAR(512),
  unit_ref         VARCHAR(512),
  concept_qname    VARCHAR(1024) NOT NULL,
  value_text       TEXT,
  value_numeric    NUMERIC(30, 10),
  decimals         INTEGER,
  precision_value  INTEGER,
  is_nil           BOOLEAN NOT NULL DEFAULT FALSE,
  footnotes        JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw_json         JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT uq_ar_xbrl_facts_seq UNIQUE (parse_run_id, sequence_index)
);

CREATE INDEX IF NOT EXISTS idx_ar_xbrl_facts_run ON annual_report_xbrl_facts (parse_run_id);
CREATE INDEX IF NOT EXISTS idx_ar_xbrl_facts_concept ON annual_report_xbrl_facts (parse_run_id, concept_qname);

CREATE TABLE IF NOT EXISTS annual_report_xbrl_dimensions (
  id              BIGSERIAL PRIMARY KEY,
  fact_id         BIGINT NOT NULL REFERENCES annual_report_xbrl_facts(id) ON DELETE CASCADE,
  dimension_qname VARCHAR(1024) NOT NULL,
  member_qname    VARCHAR(1024),
  raw_json        JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT uq_ar_xbrl_dims UNIQUE (fact_id, dimension_qname)
);

CREATE INDEX IF NOT EXISTS idx_ar_xbrl_dims_fact ON annual_report_xbrl_dimensions (fact_id);

CREATE TABLE IF NOT EXISTS annual_report_xbrl_labels (
  id              BIGSERIAL PRIMARY KEY,
  parse_run_id    BIGINT NOT NULL REFERENCES annual_report_parse_runs(id) ON DELETE CASCADE,
  concept_qname   VARCHAR(1024) NOT NULL,
  lang            VARCHAR(16) NOT NULL DEFAULT 'en',
  label_role      VARCHAR(512) NOT NULL DEFAULT 'http://www.xbrl.org/2003/role/label',
  label_text      TEXT NOT NULL,
  CONSTRAINT uq_ar_xbrl_labels UNIQUE (parse_run_id, concept_qname, lang, label_role)
);

CREATE INDEX IF NOT EXISTS idx_ar_xbrl_labels_run ON annual_report_xbrl_labels (parse_run_id);

-- ── Normalized / serving ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS company_annual_report_headers (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID NOT NULL,
  company_id                UUID REFERENCES companies(id) ON DELETE SET NULL,
  organisationsnummer       VARCHAR(64),
  annual_report_file_id     UUID NOT NULL REFERENCES annual_report_files(id) ON DELETE CASCADE,
  parse_run_id              BIGINT NOT NULL REFERENCES annual_report_parse_runs(id) ON DELETE CASCADE,
  company_name_from_filing  TEXT,
  organisation_number_filing VARCHAR(64),
  filing_type_hint          VARCHAR(128),
  report_type_hint          VARCHAR(128),
  filing_period_start       DATE,
  filing_period_end         DATE,
  currency_code             VARCHAR(16),
  source_filename           VARCHAR(512),
  parser_name               VARCHAR(64) NOT NULL,
  parser_version            VARCHAR(32) NOT NULL,
  extracted_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_superseded             BOOLEAN NOT NULL DEFAULT FALSE,
  superseded_by_header_id   UUID REFERENCES company_annual_report_headers(id) ON DELETE SET NULL,
  metadata                  JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT uq_company_ar_header_parse UNIQUE (parse_run_id)
);

CREATE INDEX IF NOT EXISTS idx_company_ar_headers_tenant_org ON company_annual_report_headers (tenant_id, organisationsnummer, extracted_at DESC);
CREATE INDEX IF NOT EXISTS idx_company_ar_headers_company ON company_annual_report_headers (company_id, extracted_at DESC) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_company_ar_headers_latest ON company_annual_report_headers (tenant_id, organisationsnummer) WHERE is_superseded = FALSE;

CREATE TABLE IF NOT EXISTS company_annual_report_financials (
  id               BIGSERIAL PRIMARY KEY,
  header_id        UUID NOT NULL REFERENCES company_annual_report_headers(id) ON DELETE CASCADE,
  canonical_field  VARCHAR(128) NOT NULL,
  period_kind      VARCHAR(32) NOT NULL
    CHECK (period_kind IN ('current', 'prior', 'instant', 'unknown')),
  value_numeric    NUMERIC(30, 10),
  value_text       TEXT,
  unit_ref         VARCHAR(512),
  currency_code    VARCHAR(16),
  source_fact_ids  BIGINT[] NOT NULL DEFAULT '{}',
  ranking_score    INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT uq_company_ar_fin UNIQUE (header_id, canonical_field, period_kind)
);

CREATE INDEX IF NOT EXISTS idx_company_ar_fin_header ON company_annual_report_financials (header_id);

CREATE TABLE IF NOT EXISTS company_annual_report_auditor (
  id               BIGSERIAL PRIMARY KEY,
  header_id        UUID NOT NULL REFERENCES company_annual_report_headers(id) ON DELETE CASCADE,
  auditor_name     TEXT,
  auditor_firm     TEXT,
  audit_opinion_hint TEXT,
  source_fact_ids  BIGINT[] NOT NULL DEFAULT '{}',
  CONSTRAINT uq_company_ar_auditor_header UNIQUE (header_id)
);

CREATE TABLE IF NOT EXISTS company_annual_report_notes_index (
  id              BIGSERIAL PRIMARY KEY,
  header_id       UUID NOT NULL REFERENCES company_annual_report_headers(id) ON DELETE CASCADE,
  note_ref        VARCHAR(256),
  note_label      TEXT,
  concept_qname   VARCHAR(1024),
  source_fact_ids BIGINT[] NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_company_ar_notes_header ON company_annual_report_notes_index (header_id);

CREATE TABLE IF NOT EXISTS company_annual_report_periods (
  id              BIGSERIAL PRIMARY KEY,
  header_id       UUID NOT NULL REFERENCES company_annual_report_headers(id) ON DELETE CASCADE,
  period_label    VARCHAR(128) NOT NULL,
  period_start    DATE,
  period_end      DATE,
  is_instant      BOOLEAN NOT NULL DEFAULT FALSE,
  context_ids     TEXT[] NOT NULL DEFAULT '{}',
  CONSTRAINT uq_company_ar_periods UNIQUE (header_id, period_label)
);

CREATE INDEX IF NOT EXISTS idx_company_ar_periods_header ON company_annual_report_periods (header_id);

COMMIT;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
BEGIN;
DROP TABLE IF EXISTS company_annual_report_periods;
DROP TABLE IF EXISTS company_annual_report_notes_index;
DROP TABLE IF EXISTS company_annual_report_auditor;
DROP TABLE IF EXISTS company_annual_report_financials;
DROP TABLE IF EXISTS company_annual_report_headers;
DROP TABLE IF EXISTS annual_report_xbrl_labels;
DROP TABLE IF EXISTS annual_report_xbrl_dimensions;
DROP TABLE IF EXISTS annual_report_xbrl_facts;
DROP TABLE IF EXISTS annual_report_xbrl_units;
DROP TABLE IF EXISTS annual_report_xbrl_contexts;
DROP TABLE IF EXISTS annual_report_parse_errors;
DROP TABLE IF EXISTS annual_report_parse_runs;
DROP TABLE IF EXISTS annual_report_file_entries;
DROP TABLE IF EXISTS annual_report_files;
COMMIT;
    `);
  }
}
