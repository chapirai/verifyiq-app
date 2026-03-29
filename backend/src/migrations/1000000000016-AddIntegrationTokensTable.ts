import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIntegrationTokensTable1000000000016 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS integration_tokens (
        id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id               UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        provider_key            VARCHAR(160)  NOT NULL,
        encrypted_access_token  TEXT          NOT NULL,
        encrypted_refresh_token TEXT,
        expires_at              TIMESTAMPTZ   NOT NULL,
        token_type              VARCHAR(64),
        scope                   VARCHAR(255),
        last_refreshed_at       TIMESTAMPTZ,
        created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, provider_key)
      );

      CREATE INDEX IF NOT EXISTS idx_integration_tokens_tenant_expires
        ON integration_tokens (tenant_id, expires_at);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_integration_tokens_tenant_expires;
      DROP TABLE IF EXISTS integration_tokens;
    `);
  }
}
