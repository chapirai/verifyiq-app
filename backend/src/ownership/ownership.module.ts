import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { ApiQuotaModule } from '../common/api-quota.module';
import { BeneficialOwnerEntity } from './entities/beneficial-owner.entity';
import { OwnershipLinkEntity } from './entities/ownership-link.entity';
import { WorkplaceEntity } from './entities/workplace.entity';
import { OwnershipController } from './ownership.controller';
import { OwnershipBvIngestionService } from './ownership-bv-ingestion.service';
import { OwnershipService } from './ownership.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([OwnershipLinkEntity, BeneficialOwnerEntity, WorkplaceEntity]),
    AuditModule,
    ApiQuotaModule,
  ],
  controllers: [OwnershipController],
  providers: [OwnershipService, OwnershipBvIngestionService],
  exports: [OwnershipService, OwnershipBvIngestionService],
})
export class OwnershipModule {}
