import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { CreditDecisioningController } from './credit-decisioning.controller';
import { CreditDecisioningService } from './credit-decisioning.service';
import { CreditDecisionResultEntity } from './entities/credit-decision-result.entity';
import { CreditDecisionTemplateEntity } from './entities/credit-decision-template.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CreditDecisionTemplateEntity, CreditDecisionResultEntity]), AuditModule],
  controllers: [CreditDecisioningController],
  providers: [CreditDecisioningService],
  exports: [CreditDecisioningService],
})
export class CreditDecisioningModule {}
