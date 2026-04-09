import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBulkJobItemsAndCounters1000000000024 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE bulk_jobs
        ADD COLUMN IF NOT EXISTS success_count INT NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS failed_count INT NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS remaining_count INT NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

      UPDATE bulk_jobs
      SET remaining_count = GREATEST(rows_total - rows_processed, 0)
      WHERE remaining_count = 0;

      CREATE TABLE IF NOT EXISTS bulk_job_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        job_id UUID NOT NULL,
        identifier VARCHAR(20) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'queued',
        attempt_count INT NOT NULL DEFAULT 0,
        error_reason TEXT,
        snapshot_id UUID,
        result_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_bulk_job_items_job_status
        ON bulk_job_items (job_id, status);

      CREATE INDEX IF NOT EXISTS idx_bulk_job_items_tenant_identifier
        ON bulk_job_items (tenant_id, identifier);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_bulk_job_items_tenant_identifier;
      DROP INDEX IF EXISTS idx_bulk_job_items_job_status;
      DROP TABLE IF EXISTS bulk_job_items;

      ALTER TABLE bulk_jobs
        DROP COLUMN IF EXISTS completed_at,
        DROP COLUMN IF EXISTS remaining_count,
        DROP COLUMN IF EXISTS failed_count,
        DROP COLUMN IF EXISTS success_count;
    `);
  }
}
