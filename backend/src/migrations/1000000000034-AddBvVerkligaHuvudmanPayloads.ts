import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBvVerkligaHuvudmanPayloads1000000000034 implements MigrationInterface {
  name = 'AddBvVerkligaHuvudmanPayloads1000000000034';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
CREATE TABLE IF NOT EXISTS bv_vh_payloads (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL,
  snapshot_id           UUID REFERENCES bolagsverket_fetch_snapshots(id) ON DELETE SET NULL,
  organisationsnummer   VARCHAR(20) NOT NULL,
  fetched_at            TIMESTAMPTZ NOT NULL,
  request_id            VARCHAR(128),
  payload               JSONB NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bv_vh_payloads_tenant_snapshot
  ON bv_vh_payloads (tenant_id, snapshot_id);

CREATE INDEX IF NOT EXISTS idx_bv_vh_payloads_tenant_org_fetched
  ON bv_vh_payloads (tenant_id, organisationsnummer, fetched_at DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
DROP INDEX IF EXISTS idx_bv_vh_payloads_tenant_org_fetched;
DROP INDEX IF EXISTS idx_bv_vh_payloads_tenant_snapshot;
DROP TABLE IF EXISTS bv_vh_payloads;
    `);
  }
}
