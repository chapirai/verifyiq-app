BEGIN;

CREATE SCHEMA IF NOT EXISTS bv_pipeline;
CREATE SCHEMA IF NOT EXISTS bv_parsed;
CREATE SCHEMA IF NOT EXISTS bv_read;

CREATE TABLE IF NOT EXISTS bv_pipeline.lookup_requests (
  lookup_request_id        BIGSERIAL PRIMARY KEY,
  tenant_id                UUID NOT NULL,
  organisationsnummer      VARCHAR(64) NOT NULL,
  requested_by_user_id     UUID,
  requested_source         VARCHAR(64),
  request_status           VARCHAR(32) NOT NULL DEFAULT 'queued',
  request_error            TEXT,
  latest_raw_payload_id    UUID,
  parse_status             VARCHAR(32),
  refresh_status           VARCHAR(32),
  started_at               TIMESTAMPTZ,
  completed_at             TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bv_pipeline_lookup_requests_tenant_org_created
  ON bv_pipeline.lookup_requests (tenant_id, organisationsnummer, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bv_pipeline_lookup_requests_status
  ON bv_pipeline.lookup_requests (request_status, created_at);

CREATE TABLE IF NOT EXISTS bv_parsed.parse_runs (
  parse_run_id             BIGSERIAL PRIMARY KEY,
  raw_payload_id           UUID NOT NULL UNIQUE
                             REFERENCES public.bv_raw_payloads(id) ON DELETE CASCADE,
  tenant_id                UUID,
  organisationsnummer      VARCHAR(64),
  provider_source          VARCHAR(64),
  parsed_ok                BOOLEAN NOT NULL DEFAULT FALSE,
  parse_error              TEXT,
  parsed_at                TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bv_parsed_parse_runs_tenant_org
  ON bv_parsed.parse_runs (tenant_id, organisationsnummer, parsed_at DESC);

CREATE TABLE IF NOT EXISTS bv_pipeline.parse_queue (
  parse_queue_id           BIGSERIAL PRIMARY KEY,
  raw_payload_id           UUID NOT NULL UNIQUE
                             REFERENCES public.bv_raw_payloads(id) ON DELETE CASCADE,
  lookup_request_id        BIGINT
                             REFERENCES bv_pipeline.lookup_requests(lookup_request_id) ON DELETE SET NULL,
  tenant_id                UUID NOT NULL,
  organisationsnummer      VARCHAR(64) NOT NULL,
  provider_source          VARCHAR(64) NOT NULL,
  status                   VARCHAR(32) NOT NULL DEFAULT 'pending',
  priority                 INTEGER NOT NULL DEFAULT 100,
  attempt_count            INTEGER NOT NULL DEFAULT 0,
  max_attempts             INTEGER NOT NULL DEFAULT 5,
  available_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at                TIMESTAMPTZ,
  locked_by                VARCHAR(128),
  last_error               TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bv_pipeline_parse_queue_pick
  ON bv_pipeline.parse_queue (status, available_at, priority, created_at);

CREATE INDEX IF NOT EXISTS idx_bv_pipeline_parse_queue_tenant_org
  ON bv_pipeline.parse_queue (tenant_id, organisationsnummer, created_at DESC);

CREATE TABLE IF NOT EXISTS bv_pipeline.refresh_queue (
  refresh_queue_id         BIGSERIAL PRIMARY KEY,
  lookup_request_id        BIGINT
                             REFERENCES bv_pipeline.lookup_requests(lookup_request_id) ON DELETE SET NULL,
  tenant_id                UUID NOT NULL,
  organisationsnummer      VARCHAR(64) NOT NULL,
  status                   VARCHAR(32) NOT NULL DEFAULT 'pending',
  priority                 INTEGER NOT NULL DEFAULT 100,
  attempt_count            INTEGER NOT NULL DEFAULT 0,
  max_attempts             INTEGER NOT NULL DEFAULT 5,
  available_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at                TIMESTAMPTZ,
  locked_by                VARCHAR(128),
  last_error               TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bv_pipeline_refresh_queue_pick
  ON bv_pipeline.refresh_queue (status, available_at, priority, created_at);

CREATE INDEX IF NOT EXISTS idx_bv_pipeline_refresh_queue_tenant_org
  ON bv_pipeline.refresh_queue (tenant_id, organisationsnummer, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bv_pipeline_refresh_queue_open
  ON bv_pipeline.refresh_queue (tenant_id, organisationsnummer)
  WHERE status IN ('pending', 'processing', 'retry');

COMMIT;
