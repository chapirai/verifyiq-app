import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompaniesModule } from '../companies/companies.module';
import { BulkController } from './bulk.controller';
import { BulkProcessor } from './bulk.processor';
import { BulkService } from './bulk.service';
import { BulkJobEntity } from './entities/bulk-job.entity';
import { BulkJobItemEntity } from './entities/bulk-job-item.entity';
import { ProviderRateLimitService } from './provider-rate-limit.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([BulkJobEntity, BulkJobItemEntity]),
    BullModule.registerQueue({ name: 'bulk-jobs' }),
    CompaniesModule,
  ],
  controllers: [BulkController],
  providers: [BulkService, BulkProcessor, ProviderRateLimitService],
  exports: [BulkService],
})
export class BulkModule {}
