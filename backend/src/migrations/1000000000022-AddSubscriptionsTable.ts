import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubscriptionsTable1000000000022 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL UNIQUE,
        plan_code VARCHAR(64) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'trialing',
        provider_customer_id VARCHAR(128),
        provider_subscription_id VARCHAR(128),
        current_period_start TIMESTAMPTZ,
        current_period_end TIMESTAMPTZ,
        canceled_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS subscriptions;`);
  }
}
