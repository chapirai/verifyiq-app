import * as fs from 'fs';
import * as path from 'path';
import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1000000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const sqlPath = path.join(__dirname, '../../migrations/001_initial_schema.sql');
    let sql: string;
    try {
      sql = fs.readFileSync(sqlPath, 'utf8');
    } catch (err) {
      throw new Error(`Migration file not found or unreadable: ${sqlPath}\n${(err as Error).message}`);
    }
    await queryRunner.query(sql);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Intentionally left blank – schema rollback is not supported.
  }
}
