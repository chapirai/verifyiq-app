import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration 019: Add bv_hvd_payloads and bv_foretagsinfo_payloads tables.
 *
 * Each table stores the full provider response payload per fetch snapshot,
 * linked to `bolagsverket_fetch_snapshots` via snapshot_id (nullable FK so
 * the row can be inserted before the snapshot record and backfilled afterward).
 */
export class AddBvSourcePayloadTables1000000000019 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS bv_hvd_payloads (
        id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id           UUID          NOT NULL,
        snapshot_id         UUID,
        organisationsnummer VARCHAR(20)   NOT NULL,
        fetched_at          TIMESTAMPTZ   NOT NULL,
        request_id          VARCHAR(128),
        payload             JSONB         NOT NULL DEFAULT '{}'::jsonb,
        created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_bv_hvd_payloads_snapshot
          FOREIGN KEY (snapshot_id)
          REFERENCES bolagsverket_fetch_snapshots(id)
          ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_bv_hvd_payloads_tenant_snapshot
        ON bv_hvd_payloads (tenant_id, snapshot_id);

      CREATE INDEX IF NOT EXISTS idx_bv_hvd_payloads_tenant_org_fetched
        ON bv_hvd_payloads (tenant_id, organisationsnummer, fetched_at);

      CREATE TABLE IF NOT EXISTS bv_foretagsinfo_payloads (
        id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id           UUID          NOT NULL,
        snapshot_id         UUID,
        organisationsnummer VARCHAR(20)   NOT NULL,
        fetched_at          TIMESTAMPTZ   NOT NULL,
        request_id          VARCHAR(128),
        payload             JSONB         NOT NULL DEFAULT '{}'::jsonb,
        created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_bv_foretagsinfo_payloads_snapshot
          FOREIGN KEY (snapshot_id)
          REFERENCES bolagsverket_fetch_snapshots(id)
          ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_bv_foretagsinfo_payloads_tenant_snapshot
        ON bv_foretagsinfo_payloads (tenant_id, snapshot_id);

      CREATE INDEX IF NOT EXISTS idx_bv_foretagsinfo_payloads_tenant_org_fetched
        ON bv_foretagsinfo_payloads (tenant_id, organisationsnummer, fetched_at);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_bv_foretagsinfo_payloads_tenant_org_fetched;
      DROP INDEX IF EXISTS idx_bv_foretagsinfo_payloads_tenant_snapshot;
      DROP TABLE IF EXISTS bv_foretagsinfo_payloads;

      DROP INDEX IF EXISTS idx_bv_hvd_payloads_tenant_org_fetched;
      DROP INDEX IF EXISTS idx_bv_hvd_payloads_tenant_snapshot;
      DROP TABLE IF EXISTS bv_hvd_payloads;
    `);
  }
}
