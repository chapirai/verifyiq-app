import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDataIngestionLogsTable1000000000017 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS data_ingestion_logs (
        id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        provider        VARCHAR(80)   NOT NULL,
        endpoint        VARCHAR(200)  NOT NULL,
        organisation_id VARCHAR(20),
        dataset         VARCHAR(80),
        field           VARCHAR(200),
        error_type      VARCHAR(120)  NOT NULL,
        metadata        JSONB,
        tenant_id       UUID,
        created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_dil_tenant_created
        ON data_ingestion_logs (tenant_id, created_at);

      CREATE INDEX IF NOT EXISTS idx_dil_provider_endpoint
        ON data_ingestion_logs (provider, endpoint);

      CREATE INDEX IF NOT EXISTS idx_dil_organisation_id
        ON data_ingestion_logs (organisation_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_dil_organisation_id;
      DROP INDEX IF EXISTS idx_dil_provider_endpoint;
      DROP INDEX IF EXISTS idx_dil_tenant_created;
      DROP TABLE IF EXISTS data_ingestion_logs;
    `);
  }
}
