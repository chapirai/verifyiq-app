import { MigrationInterface, QueryRunner } from 'typeorm';

export class MonitoringPerformanceIndexes1000000000036 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_monitoring_subscriptions_tenant_status_org
        ON monitoring_subscriptions (tenant_id, status, organisation_number);

      CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_tenant_sub_type_org_created
        ON monitoring_alerts (tenant_id, subscription_id, alert_type, organisation_number, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_tenant_created_ack
        ON monitoring_alerts (tenant_id, created_at DESC, is_acknowledged);

      CREATE INDEX IF NOT EXISTS idx_company_signals_tenant_org_type_computed_desc
        ON company_signals (tenant_id, organisation_number, signal_type, computed_at DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_company_signals_tenant_org_type_computed_desc;
      DROP INDEX IF EXISTS idx_monitoring_alerts_tenant_created_ack;
      DROP INDEX IF EXISTS idx_monitoring_alerts_tenant_sub_type_org_created;
      DROP INDEX IF EXISTS idx_monitoring_subscriptions_tenant_status_org;
    `);
  }
}

