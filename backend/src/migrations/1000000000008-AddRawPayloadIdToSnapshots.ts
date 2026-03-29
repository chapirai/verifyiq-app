import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRawPayloadIdToSnapshots1000000000008 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      -- =============================================================================
      -- Migration 008: Link Snapshots to Raw Payloads  (P02-T02)
      --
      -- Adds raw_payload_id FK column to bolagsverket_fetch_snapshots so that
      -- every snapshot can reference the BvRawPayload record produced during its
      -- fetch.  The column is nullable to allow:
      --   • Cache-hit snapshots (no fresh fetch → no new raw payload).
      --   • Graceful degradation (raw-payload storage failure → snapshot proceeds).
      -- =============================================================================

      ALTER TABLE bolagsverket_fetch_snapshots
        ADD COLUMN IF NOT EXISTS raw_payload_id UUID
          REFERENCES bv_raw_payloads(id) ON DELETE SET NULL;

      -- Enable fast look-ups: "which snapshot produced raw payload R?"
      CREATE INDEX IF NOT EXISTS idx_bv_fetch_snapshots_raw_payload_id
        ON bolagsverket_fetch_snapshots (raw_payload_id)
        WHERE raw_payload_id IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_bv_fetch_snapshots_raw_payload_id;

      ALTER TABLE bolagsverket_fetch_snapshots
        DROP COLUMN IF EXISTS raw_payload_id;
    `);
  }
}
