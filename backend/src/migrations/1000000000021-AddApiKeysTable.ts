import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddApiKeysTable1000000000021 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        name VARCHAR(120) NOT NULL,
        key_prefix VARCHAR(32) NOT NULL,
        key_hash VARCHAR(255) NOT NULL,
        last_used_at TIMESTAMPTZ,
        revoked_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_api_keys_tenant_revoked_at
        ON api_keys (tenant_id, revoked_at);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_api_keys_tenant_revoked_at;
      DROP TABLE IF EXISTS api_keys;
    `);
  }
}
