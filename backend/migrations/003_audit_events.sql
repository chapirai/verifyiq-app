-- =============================================================================
-- Migration 003: P02-T09 Audit + Usage Event Foundations
--
-- Adds audit_events and usage_events for lookup, refresh, and sensitive access.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- audit_events
-- Entity: AuditEventEntity  (audit/audit-event.entity.ts)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_events (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id              UUID,
  event_type           VARCHAR(64)  NOT NULL,
  resource_id          VARCHAR(256),
  action               VARCHAR(128) NOT NULL,
  status               VARCHAR(64)  NOT NULL,
  correlation_id       VARCHAR(128),
  cost_impact          JSONB        NOT NULL DEFAULT '{}'::jsonb,
  metadata             JSONB        NOT NULL DEFAULT '{}'::jsonb,
  retention_expires_at TIMESTAMPTZ,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_events_user_id ON audit_events (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_event_type ON audit_events (event_type);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_correlation_id ON audit_events (correlation_id);

-- ---------------------------------------------------------------------------
-- usage_events
-- Entity: UsageEventEntity  (audit/usage-event.entity.ts)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usage_events (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id              UUID,
  event_type           VARCHAR(64)  NOT NULL,
  resource_id          VARCHAR(256),
  action               VARCHAR(128) NOT NULL,
  status               VARCHAR(64)  NOT NULL,
  correlation_id       VARCHAR(128),
  cost_impact          JSONB        NOT NULL DEFAULT '{}'::jsonb,
  metadata             JSONB        NOT NULL DEFAULT '{}'::jsonb,
  retention_expires_at TIMESTAMPTZ,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_usage_events_user_id ON usage_events (user_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_event_type ON usage_events (event_type);
CREATE INDEX IF NOT EXISTS idx_usage_events_created_at ON usage_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_correlation_id ON usage_events (correlation_id);
