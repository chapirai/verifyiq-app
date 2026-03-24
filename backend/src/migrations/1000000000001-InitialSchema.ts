import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1000000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- Schema version guard
--
-- The old schema (migration 001 pre-2026) had incompatible column names:
--   • companies.party_id          (FK that no longer exists in the entity)
--   • parties.party_type          (renamed to "type" in the entity)
--   • company_raw_payloads.correlation_id  (renamed to "request_id")
--
-- This block runs once on a database that carries the old schema.  It drops
-- every table (application + Bolagsverket) with CASCADE so the clean CREATE
-- statements below can rebuild the schema correctly.
--
-- Once the correct schema is in place none of these columns exist, so the
-- condition is false and the block becomes a complete no-op on every
-- subsequent run.
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'companies'
      AND column_name  = 'party_id'
  ) OR EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'parties'
      AND column_name  = 'party_type'
  ) OR EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'company_raw_payloads'
      AND column_name  = 'correlation_id'
  ) THEN
    -- Bolagsverket tables (leaf → root order; CASCADE handles any remaining deps)
    DROP TABLE IF EXISTS
      bolagsverket_bitradesforbud,
      bolagsverket_naringsforbud,
      bolagsverket_personlig_konkurs,
      bolagsverket_personer,
      bolagsverket_dokumentlista,
      bolagsverket_organisationsengagemang,
      bolagsverket_ovrig_information,
      bolagsverket_vakanser_upplysningar,
      bolagsverket_ekonomisk_plan,
      bolagsverket_utlandsk_filial,
      bolagsverket_bestammelser,
      bolagsverket_bemyndiganden,
      bolagsverket_skuldebrev,
      bolagsverket_arenden,
      bolagsverket_organisationsmarkeringar,
      bolagsverket_tillstand,
      bolagsverket_rakenskapsperioder,
      bolagsverket_finansiella_rapporter,
      bolagsverket_aktiekapital_forandringar,
      bolagsverket_aktiegranser,
      bolagsverket_aktieslag,
      bolagsverket_aktieinformation,
      bolagsverket_styrelsegranser,
      bolagsverket_firmateckning_kombinationer,
      bolagsverket_firmateckning,
      bolagsverket_funktionarroller,
      bolagsverket_funktionarer,
      bolagsverket_naringsbeskrivning,
      bolagsverket_verksamhetsbeskrivning,
      bolagsverket_hemvist,
      bolagsverket_organisationsadresser,
      bolagsverket_organisationsstatusar,
      bolagsverket_organisationsnamn,
      bolagsverket_organisationer,
      bolagsverket_api_calls
    CASCADE;

    -- Core application tables (leaf → root order)
    DROP TABLE IF EXISTS
      documents,
      reports,
      webhook_deliveries,
      webhook_endpoints,
      monitoring_alerts,
      monitoring_subscriptions,
      risk_assessments,
      screening_matches,
      screening_jobs,
      onboarding_case_events,
      onboarding_cases,
      company_raw_payloads,
      companies,
      parties,
      audit_logs,
      refresh_tokens,
      users,
      tenants
    CASCADE;

    RAISE NOTICE 'Old schema detected – all tables dropped. Recreating from scratch.';
  END IF;
END $$;

-- =============================================================================
-- Core application tables
-- Column names and types match the TypeORM entities exactly.
-- All statements are idempotent (CREATE TABLE IF NOT EXISTS).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- tenants
-- Entity: Tenant  (tenants/tenant.entity.ts)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       VARCHAR(120) NOT NULL UNIQUE,
  name       VARCHAR(255) NOT NULL,
  status     VARCHAR(32)  NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- users
-- Entity: User  (users/user.entity.ts)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(255) NOT NULL,
  role          VARCHAR(64)  NOT NULL,
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, email)
);
CREATE INDEX IF NOT EXISTS idx_users_tenant_email ON users (tenant_id, email);

-- ---------------------------------------------------------------------------
-- refresh_tokens
-- Entity: RefreshToken  (auth/entities/refresh-token.entity.ts)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID         NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  token_hash  VARCHAR(255) NOT NULL,
  expires_at  TIMESTAMPTZ  NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens (user_id);

-- ---------------------------------------------------------------------------
-- audit_logs
-- Entity: AuditLog  (audit/audit-log.entity.ts)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID         REFERENCES tenants(id) ON DELETE CASCADE,
  actor_user_id UUID         REFERENCES users(id)   ON DELETE SET NULL,
  category      VARCHAR(64)  NOT NULL,
  action        VARCHAR(128) NOT NULL,
  entity_type   VARCHAR(128) NOT NULL,
  entity_id     UUID,
  metadata      JSONB        NOT NULL DEFAULT '{}'::jsonb,
  ip_address    INET,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created ON audit_logs (tenant_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- parties
-- Entity: PartyEntity  (parties/party.entity.ts)
-- NOTE: column is "type" (not "party_type") and "external_ref" (not
--       "external_reference") to match the entity exactly.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS parties (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- 'individual' | 'legal_entity'
  type                VARCHAR(32)  NOT NULL CHECK (type IN ('individual', 'legal_entity')),
  display_name        VARCHAR(255) NOT NULL,
  first_name          VARCHAR(120),
  last_name           VARCHAR(120),
  legal_name          VARCHAR(255),
  personal_number     VARCHAR(64),
  organisation_number VARCHAR(64),
  country_code        VARCHAR(2)   NOT NULL DEFAULT 'SE',
  status              VARCHAR(40)  NOT NULL DEFAULT 'active',
  email               VARCHAR(255),
  phone               VARCHAR(64),
  external_ref        VARCHAR(128),
  metadata            JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_parties_tenant_type ON parties (tenant_id, type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_parties_tenant_external_ref
  ON parties (tenant_id, external_ref)
  WHERE external_ref IS NOT NULL;

-- ---------------------------------------------------------------------------
-- companies
-- Entity: CompanyEntity  (companies/entities/company.entity.ts)
-- NOTE: no party_id FK; columns match entity exactly.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS companies (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organisation_number   VARCHAR(64)  NOT NULL,
  legal_name            VARCHAR(255) NOT NULL,
  company_form          VARCHAR(100),
  status                VARCHAR(100),
  registered_at         TIMESTAMPTZ,
  country_code          VARCHAR(2)   NOT NULL DEFAULT 'SE',
  business_description  TEXT,
  signatory_text        TEXT,
  officers              JSONB        NOT NULL DEFAULT '[]'::jsonb,
  share_information     JSONB        NOT NULL DEFAULT '{}'::jsonb,
  financial_reports     JSONB        NOT NULL DEFAULT '[]'::jsonb,
  source_payload_summary JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, organisation_number)
);
CREATE INDEX IF NOT EXISTS idx_companies_tenant_orgnr ON companies (tenant_id, organisation_number);

-- ---------------------------------------------------------------------------
-- company_raw_payloads
-- Entity: CompanyRawPayloadEntity  (companies/entities/company-raw-payload.entity.ts)
-- NOTE: request_id (not correlation_id); no company_id or status_code.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS company_raw_payloads (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organisation_number  VARCHAR(64) NOT NULL,
  source               VARCHAR(80) NOT NULL,
  request_payload      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  response_payload     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  request_id           VARCHAR(128) NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_company_raw_payloads_tenant_org
  ON company_raw_payloads (tenant_id, organisation_number, created_at DESC);

-- ---------------------------------------------------------------------------
-- onboarding_cases
-- Entity: OnboardingCaseEntity  (onboarding/onboarding-case.entity.ts)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS onboarding_cases (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  party_id         UUID        NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  company_id       UUID        REFERENCES companies(id) ON DELETE SET NULL,
  status           VARCHAR(64) NOT NULL,
  risk_level       VARCHAR(32),
  assigned_user_id UUID        REFERENCES users(id) ON DELETE SET NULL,
  submitted_at     TIMESTAMPTZ,
  decided_at       TIMESTAMPTZ,
  decision         VARCHAR(32),
  decision_reason  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_onboarding_cases_tenant_status ON onboarding_cases (tenant_id, status);

-- ---------------------------------------------------------------------------
-- onboarding_case_events
-- Entity: OnboardingCaseEventEntity  (onboarding/onboarding-case-event.entity.ts)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS onboarding_case_events (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  onboarding_case_id UUID        NOT NULL REFERENCES onboarding_cases(id) ON DELETE CASCADE,
  actor_user_id      UUID        REFERENCES users(id) ON DELETE SET NULL,
  event_type         VARCHAR(64) NOT NULL,
  from_state         VARCHAR(64),
  to_state           VARCHAR(64),
  notes              TEXT,
  metadata           JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_onboarding_case_events_case
  ON onboarding_case_events (onboarding_case_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- screening_jobs
-- Entity: ScreeningJobEntity  (screening/screening-job.entity.ts)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS screening_jobs (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  party_id              UUID        NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  status                VARCHAR(32) NOT NULL,
  provider              VARCHAR(64) NOT NULL,
  submitted_by_user_id  UUID        REFERENCES users(id) ON DELETE SET NULL,
  submitted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at          TIMESTAMPTZ,
  request_payload       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  response_payload      JSONB       NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_screening_jobs_tenant_status ON screening_jobs (tenant_id, status);

-- ---------------------------------------------------------------------------
-- screening_matches
-- Entity: ScreeningMatchEntity  (screening/screening-match.entity.ts)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS screening_matches (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  screening_job_id     UUID          NOT NULL REFERENCES screening_jobs(id) ON DELETE CASCADE,
  match_status         VARCHAR(32)   NOT NULL,
  source               VARCHAR(64)   NOT NULL,
  category             VARCHAR(64)   NOT NULL,
  score                NUMERIC(5, 2),
  subject_name         VARCHAR(255)  NOT NULL,
  payload              JSONB         NOT NULL DEFAULT '{}'::jsonb,
  reviewed_by_user_id  UUID          REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at          TIMESTAMPTZ,
  review_notes         TEXT,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_screening_matches_job
  ON screening_matches (screening_job_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- risk_assessments
-- Entity: RiskAssessmentEntity  (risk/risk-assessment.entity.ts)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS risk_assessments (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  party_id           UUID        NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  onboarding_case_id UUID        REFERENCES onboarding_cases(id) ON DELETE SET NULL,
  score              INTEGER     NOT NULL,
  risk_level         VARCHAR(32) NOT NULL,
  factors            JSONB       NOT NULL DEFAULT '[]'::jsonb,
  assessed_by        VARCHAR(64) NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_party ON risk_assessments (party_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- monitoring_subscriptions
-- Entity: MonitoringSubscriptionEntity  (monitoring/monitoring-subscription.entity.ts)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS monitoring_subscriptions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  party_id            UUID        REFERENCES parties(id)   ON DELETE CASCADE,
  company_id          UUID        REFERENCES companies(id) ON DELETE CASCADE,
  status              VARCHAR(32) NOT NULL DEFAULT 'active',
  event_types         JSONB       NOT NULL DEFAULT '[]'::jsonb,
  created_by_user_id  UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- monitoring_alerts
-- Entity: MonitoringAlertEntity  (monitoring/monitoring-alert.entity.ts)
-- NOTE: has updated_at (unlike the old 001 migration which omitted it).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS monitoring_alerts (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subscription_id UUID         NOT NULL REFERENCES monitoring_subscriptions(id) ON DELETE CASCADE,
  alert_type      VARCHAR(64)  NOT NULL,
  severity        VARCHAR(32)  NOT NULL,
  status          VARCHAR(32)  NOT NULL DEFAULT 'open',
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  payload         JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_sub
  ON monitoring_alerts (subscription_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- webhook_endpoints
-- Entity: WebhookEndpointEntity  (webhooks/webhook-endpoint.entity.ts)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name              VARCHAR(255) NOT NULL,
  target_url        TEXT         NOT NULL,
  secret_hash       VARCHAR(255) NOT NULL,
  subscribed_events JSONB        NOT NULL DEFAULT '[]'::jsonb,
  is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- webhook_deliveries
-- Entity: WebhookDeliveryEntity  (webhooks/webhook-delivery.entity.ts)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID         NOT NULL REFERENCES tenants(id)           ON DELETE CASCADE,
  webhook_endpoint_id UUID         NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  event_name          VARCHAR(128) NOT NULL,
  attempt_number      INTEGER      NOT NULL DEFAULT 1,
  status              VARCHAR(32)  NOT NULL,
  response_status     INTEGER,
  request_body        JSONB        NOT NULL DEFAULT '{}'::jsonb,
  response_body       TEXT,
  next_retry_at       TIMESTAMPTZ,
  delivered_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint
  ON webhook_deliveries (webhook_endpoint_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- documents
-- Entity: DocumentEntity  (documents/document.entity.ts)
-- NOTE: has updated_at (unlike the old 001 migration which omitted it).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documents (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID         NOT NULL REFERENCES tenants(id)   ON DELETE CASCADE,
  party_id             UUID         REFERENCES parties(id)            ON DELETE CASCADE,
  company_id           UUID         REFERENCES companies(id)          ON DELETE CASCADE,
  storage_bucket       VARCHAR(255) NOT NULL,
  storage_key          VARCHAR(512) NOT NULL,
  file_name            VARCHAR(255) NOT NULL,
  content_type         VARCHAR(255),
  size_bytes           BIGINT,
  uploaded_by_user_id  UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_documents_tenant ON documents (tenant_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- reports
-- Entity: ReportEntity  (reports/report.entity.ts)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  report_type           VARCHAR(64)  NOT NULL,
  status                VARCHAR(32)  NOT NULL,
  requested_by_user_id  UUID         REFERENCES users(id) ON DELETE SET NULL,
  storage_bucket        VARCHAR(255),
  storage_key           VARCHAR(512),
  filters               JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  completed_at          TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_reports_tenant_status ON reports (tenant_id, status);
`);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Intentionally left blank – schema rollback is not supported.
  }
}
