import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * P02-T09: Audit + usage events tables.
 *
 * Adds audit_events and usage_events with indexes aligned to AuditEventEntity
 * and UsageEventEntity for correlation, user, and type queries.
 */
export class AddAuditUsageEvents1000000000015 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      -- =============================================================================
      -- Migration 015: Audit + Usage Events  (P02-T09)
      -- =============================================================================

      CREATE TABLE IF NOT EXISTS audit_events (
        id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id           UUID          NOT NULL,
        user_id             UUID,
        event_type          VARCHAR(64)   NOT NULL,
        resource_id         VARCHAR(256),
        action              VARCHAR(128)  NOT NULL,
        status              VARCHAR(64)   NOT NULL,
        correlation_id      VARCHAR(128),
        cost_impact         JSONB         NOT NULL DEFAULT '{}'::jsonb,
        metadata            JSONB         NOT NULL DEFAULT '{}'::jsonb,
        retention_expires_at TIMESTAMPTZ,
        created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_audit_events_user_id
        ON audit_events (user_id);

      CREATE INDEX IF NOT EXISTS idx_audit_events_event_type
        ON audit_events (event_type);

      CREATE INDEX IF NOT EXISTS idx_audit_events_created_at
        ON audit_events (created_at);

      CREATE INDEX IF NOT EXISTS idx_audit_events_tenant_created
        ON audit_events (tenant_id, created_at);

      CREATE INDEX IF NOT EXISTS idx_audit_events_correlation_id
        ON audit_events (correlation_id)
        WHERE correlation_id IS NOT NULL;

      CREATE TABLE IF NOT EXISTS usage_events (
        id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id           UUID          NOT NULL,
        user_id             UUID,
        event_type          VARCHAR(64)   NOT NULL,
        resource_id         VARCHAR(256),
        action              VARCHAR(128)  NOT NULL,
        status              VARCHAR(64)   NOT NULL,
        correlation_id      VARCHAR(128),
        cost_impact         JSONB         NOT NULL DEFAULT '{}'::jsonb,
        metadata            JSONB         NOT NULL DEFAULT '{}'::jsonb,
        retention_expires_at TIMESTAMPTZ,
        created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_usage_events_user_id
        ON usage_events (user_id);

      CREATE INDEX IF NOT EXISTS idx_usage_events_event_type
        ON usage_events (event_type);

      CREATE INDEX IF NOT EXISTS idx_usage_events_created_at
        ON usage_events (created_at);

      CREATE INDEX IF NOT EXISTS idx_usage_events_tenant_created
        ON usage_events (tenant_id, created_at);

      CREATE INDEX IF NOT EXISTS idx_usage_events_correlation_id
        ON usage_events (correlation_id)
        WHERE correlation_id IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_usage_events_correlation_id;
      DROP INDEX IF EXISTS idx_usage_events_tenant_created;
      DROP INDEX IF EXISTS idx_usage_events_created_at;
      DROP INDEX IF EXISTS idx_usage_events_event_type;
      DROP INDEX IF EXISTS idx_usage_events_user_id;

      DROP TABLE IF EXISTS usage_events;

      DROP INDEX IF EXISTS idx_audit_events_correlation_id;
      DROP INDEX IF EXISTS idx_audit_events_tenant_created;
      DROP INDEX IF EXISTS idx_audit_events_created_at;
      DROP INDEX IF EXISTS idx_audit_events_event_type;
      DROP INDEX IF EXISTS idx_audit_events_user_id;

      DROP TABLE IF EXISTS audit_events;
    `);
  }
}
