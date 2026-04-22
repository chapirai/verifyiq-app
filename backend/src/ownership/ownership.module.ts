import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { AuditModule } from '../audit/audit.module';
import { ApiQuotaModule } from '../common/api-quota.module';
import { BeneficialOwnerEntity } from './entities/beneficial-owner.entity';
import { OwnershipLinkEntity } from './entities/ownership-link.entity';
import { WorkplaceEntity } from './entities/workplace.entity';
import { OwnershipController } from './ownership.controller';
import { OwnershipBvIngestionService } from './ownership-bv-ingestion.service';
import { OwnershipService } from './ownership.service';
import { OWNERSHIP_ADVANCED_INSIGHTS_QUEUE } from './queues/ownership-advanced-insights.queue';
import { OwnershipAdvancedInsightsProcessor } from './processors/ownership-advanced-insights.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([OwnershipLinkEntity, BeneficialOwnerEntity, WorkplaceEntity]),
    BullModule.registerQueue({ name: OWNERSHIP_ADVANCED_INSIGHTS_QUEUE }),
    AuditModule,
    ApiQuotaModule,
  ],
  controllers: [OwnershipController],
  providers: [OwnershipService, OwnershipBvIngestionService, OwnershipAdvancedInsightsProcessor],
  exports: [OwnershipService, OwnershipBvIngestionService],
})
export class OwnershipModule {}
