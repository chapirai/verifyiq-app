import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { AnnualReportsModule } from './annual-reports/annual-reports.module';
import { AuditModule } from './audit/audit.module';
import { BillingModule } from './billing/billing.module';
import { BulkModule } from './bulk/bulk.module';
import { AuthModule } from './auth/auth.module';
import envConfig from './config/env';
import { validateEnv } from './config/validate-env';
import { CompaniesModule } from './companies/companies.module';
import { CompanyCasesModule } from './company-cases/company-cases.module';
import { DocumentsModule } from './documents/documents.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { OauthModule } from './oauth/oauth.module';
import { PartiesModule } from './parties/parties.module';
import { PersonEnrichmentModule } from './person-enrichment/person-enrichment.module';
import { PropertyModule } from './property/property.module';
import { CreditDecisioningModule } from './credit-decisioning/credit-decisioning.module';
import { EntitlementsModule } from './entitlements/entitlements.module';
import { FinancialModule } from './financial/financial.module';
import { OwnershipModule } from './ownership/ownership.module';
import { ReportsModule } from './reports/reports.module';
import { RiskIndicatorsModule } from './risk-indicators/risk-indicators.module';
import { RiskModule } from './risk/risk.module';
import { ScreeningModule } from './screening/screening.module';
import { TenantsModule } from './tenants/tenants.module';
import { UsersModule } from './users/users.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [envConfig],
      validate: validateEnv,
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.getOrThrow<string>('PG_HOST'),
        port: config.getOrThrow<number>('PG_PORT'),
        username: config.getOrThrow<string>('PG_USER'),
        password: config.getOrThrow<string>('PG_PASSWORD'),
        database: config.getOrThrow<string>('PG_DBNAME'),
        autoLoadEntities: true,
        synchronize: false,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      }),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        skipVersionCheck: config.get<string>('BULLMQ_SKIP_REDIS_VERSION_CHECK') === 'true',
        connection: {
          host: config.getOrThrow<string>('REDIS_HOST'),
          port: config.getOrThrow<number>('REDIS_PORT'),
          password: config.get<string>('REDIS_PASSWORD') || undefined,
        },
      }),
    }),
    AuthModule,
    ApiKeysModule,
    AuditModule,
    BillingModule,
    BulkModule,
    TenantsModule,
    UsersModule,
    PartiesModule,
    CompaniesModule,
    OnboardingModule,
    ScreeningModule,
    RiskModule,
    MonitoringModule,
    OauthModule,
    WebhooksModule,
    DocumentsModule,
    ReportsModule,
    OwnershipModule,
    EntitlementsModule,
    FinancialModule,
    CreditDecisioningModule,
    CompanyCasesModule,
    PersonEnrichmentModule,
    PropertyModule,
    RiskIndicatorsModule,
    AnnualReportsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
