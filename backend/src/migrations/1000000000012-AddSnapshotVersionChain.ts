import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * P02-T07: Snapshot Version Chain — extends bolagsverket_fetch_snapshots with
 * version-chain linkage fields and replay-safe identifier storage.
 *
 * Adds:
 *   • previous_snapshot_id  – backwards pointer to the preceding snapshot
 *   • version_number        – per-entity monotonic version counter (starts at 1)
 *   • sequence_number       – chain position (equals version_number for per-entity chains)
 *   • replay_id             – immutable, deterministic replay-safe identifier
 *   • chain_broken          – flag indicating a detected broken chain link
 *
 * Indexes:
 *   • idx_bv_snapshot_previous_id        – fast chain traversal by predecessor
 *   • idx_bv_snapshot_tenant_sequence    – efficient ordered scans per entity
 *   • idx_bv_snapshot_replay_id          – lookup by replay-safe identifier
 */
export class AddSnapshotVersionChain1000000000012 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      -- =============================================================================
      -- Migration 012: Snapshot Version Chain  (P02-T07)
      --
      -- Extends bolagsverket_fetch_snapshots with fields that enable:
      --   • Linked-list version chain (previous_snapshot_id).
      --   • Chain integrity tracking (version_number, sequence_number, chain_broken).
      --   • Replay-safe references (replay_id) for content-addressable storage.
      -- =============================================================================

      ALTER TABLE bolagsverket_fetch_snapshots
        ADD COLUMN IF NOT EXISTS previous_snapshot_id UUID
          REFERENCES bolagsverket_fetch_snapshots(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS version_number   INTEGER NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS sequence_number  INTEGER NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS replay_id        VARCHAR(64) UNIQUE,
        ADD COLUMN IF NOT EXISTS chain_broken     BOOLEAN NOT NULL DEFAULT FALSE;

      -- ── Indexes ──────────────────────────────────────────────────────────────

      -- Walk chain backwards: given a snapshot, find its predecessor quickly.
      CREATE INDEX IF NOT EXISTS idx_bv_snapshot_previous_id
        ON bolagsverket_fetch_snapshots (previous_snapshot_id)
        WHERE previous_snapshot_id IS NOT NULL;

      -- Ordered chain traversal per entity (tenant + org + sequence).
      CREATE INDEX IF NOT EXISTS idx_bv_snapshot_tenant_sequence
        ON bolagsverket_fetch_snapshots (tenant_id, organisationsnummer, sequence_number);

      -- Lookup snapshot by replay-safe identifier (content-addressable access).
      CREATE INDEX IF NOT EXISTS idx_bv_snapshot_replay_id
        ON bolagsverket_fetch_snapshots (replay_id)
        WHERE replay_id IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_bv_snapshot_replay_id;
      DROP INDEX IF EXISTS idx_bv_snapshot_tenant_sequence;
      DROP INDEX IF EXISTS idx_bv_snapshot_previous_id;

      ALTER TABLE bolagsverket_fetch_snapshots
        DROP COLUMN IF EXISTS chain_broken,
        DROP COLUMN IF EXISTS replay_id,
        DROP COLUMN IF EXISTS sequence_number,
        DROP COLUMN IF EXISTS version_number,
        DROP COLUMN IF EXISTS previous_snapshot_id;
    `);
  }
}
