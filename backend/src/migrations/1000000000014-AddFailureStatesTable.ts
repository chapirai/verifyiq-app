import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * P02-T10: Failure-state model for provider outages and stale fallbacks.
 *
 * Creates the failure_states table and required indexes to query by entity,
 * state, and time for recovery monitoring.
 */
export class AddFailureStatesTable1000000000014 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      -- =============================================================================
      -- Migration 014: Failure States (P02-T10)
      --
      -- Stores provider failure states, fallback usage, and retry metadata.
      -- =============================================================================

      CREATE TABLE IF NOT EXISTS failure_states (
        id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id            UUID        NOT NULL,
        entity_type          VARCHAR(64) NOT NULL,
        entity_id            VARCHAR(128) NOT NULL,
        failure_state        VARCHAR(32) NOT NULL,
        failure_reason       TEXT,
        last_attempted       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        fallback_used        BOOLEAN     NOT NULL DEFAULT FALSE,
        stale_data_timestamp TIMESTAMPTZ,
        retry_count          INTEGER     NOT NULL DEFAULT 0,
        is_recoverable       BOOLEAN     NOT NULL DEFAULT TRUE,
        created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- ── Indexes ──────────────────────────────────────────────────────────────
      CREATE INDEX IF NOT EXISTS idx_failure_states_entity_id
        ON failure_states (entity_id);

      CREATE INDEX IF NOT EXISTS idx_failure_states_state
        ON failure_states (failure_state);

      CREATE INDEX IF NOT EXISTS idx_failure_states_created_at
        ON failure_states (created_at);

      CREATE INDEX IF NOT EXISTS idx_failure_states_tenant_entity
        ON failure_states (tenant_id, entity_type, entity_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_failure_states_tenant_entity;
      DROP INDEX IF EXISTS idx_failure_states_created_at;
      DROP INDEX IF EXISTS idx_failure_states_state;
      DROP INDEX IF EXISTS idx_failure_states_entity_id;

      DROP TABLE IF EXISTS failure_states;
    `);
  }
}
