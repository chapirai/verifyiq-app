import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { BeneficialOwnerEntity } from './entities/beneficial-owner.entity';
import { OwnershipLinkEntity } from './entities/ownership-link.entity';
import { WorkplaceEntity } from './entities/workplace.entity';
import { OwnershipController } from './ownership.controller';
import { OwnershipService } from './ownership.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([OwnershipLinkEntity, BeneficialOwnerEntity, WorkplaceEntity]),
    AuditModule,
  ],
  controllers: [OwnershipController],
  providers: [OwnershipService],
  exports: [OwnershipService],
})
export class OwnershipModule {}
