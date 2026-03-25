import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { DatasetEntitlementEntity } from './entities/dataset-entitlement.entity';
import { DatasetUsageEventEntity } from './entities/dataset-usage-event.entity';
import { EntitlementsController } from './entitlements.controller';
import { EntitlementsService } from './entitlements.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([DatasetEntitlementEntity, DatasetUsageEventEntity]),
    AuditModule,
  ],
  controllers: [EntitlementsController],
  providers: [EntitlementsService],
  exports: [EntitlementsService],
})
export class EntitlementsModule {}
