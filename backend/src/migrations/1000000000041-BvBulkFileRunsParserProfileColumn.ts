import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Some databases may have `bv_bulk_file_runs` from a partial or older apply
 * without `parser_profile`. Keep schema aligned with BvBulkFileRunEntity.
 */
export class BvBulkFileRunsParserProfileColumn1000000000041 implements MigrationInterface {
  name = 'BvBulkFileRunsParserProfileColumn1000000000041';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE bv_bulk_file_runs
      ADD COLUMN IF NOT EXISTS parser_profile VARCHAR(64) NULL;
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Non-destructive: other code may depend on the column.
  }
}
