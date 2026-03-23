import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { CompanyEntity } from './entities/company.entity';
import { CompanyRawPayloadEntity } from './entities/company-raw-payload.entity';
import { BolagsverketClient } from './integrations/bolagsverket.client';
import { CompanyNormalizer } from './mappers/company-normalizer';

@Module({
  imports: [TypeOrmModule.forFeature([CompanyEntity, CompanyRawPayloadEntity]), HttpModule, AuditModule],
  controllers: [CompaniesController],
  providers: [CompaniesService, BolagsverketClient, CompanyNormalizer],
  exports: [CompaniesService],
})
export class CompaniesModule {}
