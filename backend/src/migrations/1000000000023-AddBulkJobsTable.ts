import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBulkJobsTable1000000000023 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS bulk_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        rows_total INT NOT NULL DEFAULT 0,
        rows_processed INT NOT NULL DEFAULT 0,
        status VARCHAR(32) NOT NULL DEFAULT 'queued',
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_bulk_jobs_tenant_status
        ON bulk_jobs (tenant_id, status);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_bulk_jobs_tenant_status;
      DROP TABLE IF EXISTS bulk_jobs;
    `);
  }
}
