import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { CompanyEntity } from './entities/company.entity';
import { CompanyRawPayloadEntity } from './entities/company-raw-payload.entity';
import { BolagsverketClient } from './integrations/bolagsverket.client';
import { BolagsverketMapper } from './integrations/bolagsverket.mapper';
import { CompanyNormalizer } from './mappers/company-normalizer';
import { BolagsverketService } from './services/bolagsverket.service';
import { BolagsverketController } from './controllers/bolagsverket.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CompanyEntity, CompanyRawPayloadEntity]), HttpModule, AuditModule],
  controllers: [CompaniesController, BolagsverketController],
  providers: [CompaniesService, BolagsverketClient, BolagsverketMapper, BolagsverketService, CompanyNormalizer],
  exports: [CompaniesService, BolagsverketService],
})
export class CompaniesModule {}
