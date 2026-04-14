import { MigrationInterface, QueryRunner } from 'typeorm';

export class BillingStripeAndOauthClients1000000000032 implements MigrationInterface {
  name = 'BillingStripeAndOauthClients1000000000032';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
BEGIN;

CREATE TABLE IF NOT EXISTS billing_webhook_events (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider           VARCHAR(32) NOT NULL DEFAULT 'stripe',
  event_id           VARCHAR(255) NOT NULL,
  event_type         VARCHAR(128) NOT NULL,
  processed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status             VARCHAR(32) NOT NULL DEFAULT 'processed',
  payload            JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message      TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_billing_webhook_events_type
  ON billing_webhook_events (event_type, processed_at DESC);

CREATE TABLE IF NOT EXISTS oauth_clients (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL,
  name                VARCHAR(120) NOT NULL,
  client_id           VARCHAR(80) NOT NULL UNIQUE,
  client_secret_hash  VARCHAR(255) NOT NULL,
  scopes              TEXT[] NOT NULL DEFAULT '{}',
  environment         VARCHAR(16) NOT NULL DEFAULT 'live'
    CHECK (environment IN ('live', 'sandbox')),
  last_used_at        TIMESTAMPTZ,
  revoked_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_clients_tenant_env_revoked
  ON oauth_clients (tenant_id, environment, revoked_at);

COMMIT;
`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
BEGIN;

DROP INDEX IF EXISTS idx_oauth_clients_tenant_env_revoked;
DROP TABLE IF EXISTS oauth_clients;
DROP INDEX IF EXISTS idx_billing_webhook_events_type;
DROP TABLE IF EXISTS billing_webhook_events;

COMMIT;
`);
  }
}
