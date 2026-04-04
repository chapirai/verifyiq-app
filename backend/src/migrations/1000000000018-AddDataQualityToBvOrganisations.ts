import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDataQualityToBvOrganisations1000000000018 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE bolagsverket_organisationer
        ADD COLUMN IF NOT EXISTS data_quality JSONB;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE bolagsverket_organisationer
        DROP COLUMN IF EXISTS data_quality;
    `);
  }
}
