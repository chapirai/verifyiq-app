import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration 020: Add bv_document_lists table.
 *
 * Stores the full HVD /dokumentlista response per fetch snapshot, linked to
 * `bolagsverket_fetch_snapshots` via snapshot_id (nullable FK so the row can
 * be inserted before the snapshot and backfilled afterward).
 */
export class AddBvDocumentListTable1000000000020 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS bv_document_lists (
        id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id           UUID          NOT NULL,
        snapshot_id         UUID,
        organisationsnummer VARCHAR(20)   NOT NULL,
        fetched_at          TIMESTAMPTZ   NOT NULL,
        request_id          VARCHAR(128),
        documents           JSONB         NOT NULL DEFAULT '[]'::jsonb,
        document_count      INTEGER       NOT NULL DEFAULT 0,
        created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_bv_document_lists_snapshot
          FOREIGN KEY (snapshot_id)
          REFERENCES bolagsverket_fetch_snapshots(id)
          ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_bv_document_lists_tenant_snapshot
        ON bv_document_lists (tenant_id, snapshot_id);

      CREATE INDEX IF NOT EXISTS idx_bv_document_lists_tenant_org_fetched
        ON bv_document_lists (tenant_id, organisationsnummer, fetched_at);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_bv_document_lists_tenant_org_fetched;
      DROP INDEX IF EXISTS idx_bv_document_lists_tenant_snapshot;
      DROP TABLE IF EXISTS bv_document_lists;
    `);
  }
}
