import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * P02-T08: Company Change Events — creates the `company_change_events` table
 * for persisting attribute-level changes detected between consecutive
 * BvFetchSnapshot records.
 *
 * Creates:
 *   • company_change_events table with all required fields
 *   • Indexes for efficient queries by snapshot, attribute, change type, and date
 */
export class AddCompanyChangeEventsTable1000000000013 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      -- =============================================================================
      -- Migration 013: Company Change Events  (P02-T08)
      --
      -- Creates the company_change_events table that stores attribute-level changes
      -- detected by comparing consecutive BvFetchSnapshot records.
      --
      -- One row = one attribute inspected in one comparison run.
      -- change_type ∈ { ADDED, MODIFIED, REMOVED, UNCHANGED, UNKNOWN }
      -- =============================================================================

      CREATE TABLE IF NOT EXISTS company_change_events (
        id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id           UUID          NOT NULL,
        org_number          VARCHAR(64)   NOT NULL,
        snapshot_id_before  UUID,
        snapshot_id_after   UUID          NOT NULL,
        attribute_name      VARCHAR(512)  NOT NULL,
        old_value           TEXT,
        new_value           TEXT,
        change_type         VARCHAR(32)   NOT NULL,
        correlation_id      VARCHAR(128),
        actor_id            UUID,
        created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      );

      -- ── Indexes ──────────────────────────────────────────────────────────────

      -- Walk all changes for a given before-snapshot.
      CREATE INDEX IF NOT EXISTS idx_change_event_snapshot_before
        ON company_change_events (snapshot_id_before)
        WHERE snapshot_id_before IS NOT NULL;

      -- Walk all changes produced by a specific snapshot comparison run.
      CREATE INDEX IF NOT EXISTS idx_change_event_snapshot_after
        ON company_change_events (snapshot_id_after);

      -- Efficient per-company attribute history lookup.
      CREATE INDEX IF NOT EXISTS idx_change_event_tenant_org_attr
        ON company_change_events (tenant_id, org_number, attribute_name);

      -- Time-range scans per tenant (e.g. "what changed this week?").
      CREATE INDEX IF NOT EXISTS idx_change_event_tenant_created
        ON company_change_events (tenant_id, created_at);

      -- Filter by change type per tenant (e.g. "all ADDED events").
      CREATE INDEX IF NOT EXISTS idx_change_event_tenant_change_type
        ON company_change_events (tenant_id, change_type);

      -- Trace change events back to the originating request correlation ID.
      CREATE INDEX IF NOT EXISTS idx_change_event_correlation_id
        ON company_change_events (correlation_id)
        WHERE correlation_id IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_change_event_correlation_id;
      DROP INDEX IF EXISTS idx_change_event_tenant_change_type;
      DROP INDEX IF EXISTS idx_change_event_tenant_created;
      DROP INDEX IF EXISTS idx_change_event_tenant_org_attr;
      DROP INDEX IF EXISTS idx_change_event_snapshot_after;
      DROP INDEX IF EXISTS idx_change_event_snapshot_before;

      DROP TABLE IF EXISTS company_change_events;
    `);
  }
}
