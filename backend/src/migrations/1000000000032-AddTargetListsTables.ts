import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTargetListsTables1000000000032 implements MigrationInterface {
  name = 'AddTargetListsTables1000000000032';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
BEGIN;

CREATE TABLE IF NOT EXISTS target_lists (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL,
  name                VARCHAR(160) NOT NULL,
  created_by_user_id  UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS target_list_items (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL,
  target_list_id       UUID NOT NULL REFERENCES target_lists(id) ON DELETE CASCADE,
  organisation_number  VARCHAR(32) NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, target_list_id, organisation_number)
);

CREATE INDEX IF NOT EXISTS idx_target_lists_tenant_name
  ON target_lists (tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_target_list_items_tenant_list
  ON target_list_items (tenant_id, target_list_id);
CREATE INDEX IF NOT EXISTS idx_target_list_items_tenant_org
  ON target_list_items (tenant_id, organisation_number);

COMMIT;
`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
BEGIN;

DROP INDEX IF EXISTS idx_target_list_items_tenant_org;
DROP INDEX IF EXISTS idx_target_list_items_tenant_list;
DROP INDEX IF EXISTS idx_target_lists_tenant_name;
DROP TABLE IF EXISTS target_list_items;
DROP TABLE IF EXISTS target_lists;

COMMIT;
`);
  }
}
