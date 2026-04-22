import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompaniesModule } from '../companies/companies.module';
import { CompanyEntity } from '../companies/entities/company.entity';
import { UsageEventEntity } from '../audit/usage-event.entity';
import { SubscriptionEntity } from '../billing/entities/subscription.entity';
import { Tenant } from '../tenants/tenant.entity';
import { User } from '../users/user.entity';
import { BolagsverketBulkController } from './bolagsverket-bulk.controller';
import { BolagsverketBulkParser } from './bolagsverket-bulk.parser';
import { BolagsverketBulkProcessor } from './bolagsverket-bulk.processor';
import { BolagsverketBulkScheduler } from './bolagsverket-bulk.scheduler';
import { BolagsverketBulkService } from './bolagsverket-bulk.service';
import { BolagsverketBulkStorageService } from './bolagsverket-bulk.storage.service';
import { BolagsverketBulkUpsertService } from './bolagsverket-bulk-upsert.service';
import { BvBulkCompanyCurrentEntity } from './entities/bv-bulk-company-current.entity';
import { BvBulkCompanyHistoryEntity } from './entities/bv-bulk-company-history.entity';
import { BvBulkCompanyStagingEntity } from './entities/bv-bulk-company-staging.entity';
import { BvBulkEnrichmentRequestEntity } from './entities/bv-bulk-enrichment-request.entity';
import { BvBulkFileRunEntity } from './entities/bv-bulk-file-run.entity';
import { BvBulkRawRowEntity } from './entities/bv-bulk-raw-row.entity';
import { BvBulkRunCheckpointEntity } from './entities/bv-bulk-run-checkpoint.entity';
import { BOLAGSVERKET_BULK_QUEUE } from './queues/bolagsverket-bulk.queue';

@Module({
  imports: [
    HttpModule,
    CompaniesModule,
    BullModule.registerQueue({ name: BOLAGSVERKET_BULK_QUEUE }),
    TypeOrmModule.forFeature([
      BvBulkFileRunEntity,
      BvBulkRawRowEntity,
      BvBulkCompanyStagingEntity,
      BvBulkCompanyCurrentEntity,
      BvBulkRunCheckpointEntity,
      BvBulkCompanyHistoryEntity,
      BvBulkEnrichmentRequestEntity,
      CompanyEntity,
      UsageEventEntity,
      SubscriptionEntity,
      Tenant,
      User,
    ]),
  ],
  controllers: [BolagsverketBulkController],
  providers: [
    BolagsverketBulkService,
    BolagsverketBulkParser,
    BolagsverketBulkStorageService,
    BolagsverketBulkUpsertService,
    BolagsverketBulkProcessor,
    BolagsverketBulkScheduler,
  ],
  exports: [BolagsverketBulkService],
})
export class BolagsverketBulkModule {}

