import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { BusinessProhibitionEntity } from './entities/business-prohibition.entity';
import { CompanyCaseEntity } from './entities/company-case.entity';
import { CompanyCasesController } from './company-cases.controller';
import { CompanyCasesService } from './company-cases.service';

@Module({
  imports: [TypeOrmModule.forFeature([CompanyCaseEntity, BusinessProhibitionEntity]), AuditModule],
  controllers: [CompanyCasesController],
  providers: [CompanyCasesService],
  exports: [CompanyCasesService],
})
export class CompanyCasesModule {}
