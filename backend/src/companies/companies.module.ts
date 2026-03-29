import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { CompanyEntity } from './entities/company.entity';
import { CompanyRawPayloadEntity } from './entities/company-raw-payload.entity';
import { BvOrganisationEntity } from './entities/bv-organisation.entity';
import { BvApiCallEntity } from './entities/bv-api-call.entity';
import { BvFetchSnapshotEntity } from './entities/bv-fetch-snapshot.entity';
import { BvStoredDocumentEntity } from './entities/bv-stored-document.entity';
import { BolagsverketClient } from './integrations/bolagsverket.client';
import { BolagsverketMapper } from './integrations/bolagsverket.mapper';
import { CompanyNormalizer } from './mappers/company-normalizer';
import { BolagsverketService } from './services/bolagsverket.service';
import { BvCacheService } from './services/bv-cache.service';
import { BvPersistenceService } from './services/bv-persistence.service';
import { BvDocumentStorageService } from './services/bv-document-storage.service';
import { SnapshotQueryService } from './services/snapshot-query.service';
import { RawPayloadStorageService } from './services/raw-payload-storage.service';
import { RawPayloadQueryService } from './services/raw-payload-query.service';
import { BvRawPayloadEntity } from './entities/bv-raw-payload.entity';
import { BolagsverketController } from './controllers/bolagsverket.controller';
import { NormalizedCompanyEntity } from './entities/normalized-company.entity';
import { CompanyVersionEntity } from './entities/company-version.entity';
import { NormalizationService } from './services/normalization.service';
import { NormalizedCompanyQueryService } from './services/normalized-company-query.service';
import { CachePolicyEntity } from './entities/cache-policy.entity';
import { CachePolicyEvaluationService } from './services/cache-policy-evaluation.service';
import { CachePolicyController } from './controllers/cache-policy.controller';
import { RefreshDecisionService } from './services/refresh-decision.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CompanyEntity,
      CompanyRawPayloadEntity,
      BvOrganisationEntity,
      BvApiCallEntity,
      BvFetchSnapshotEntity,
      BvStoredDocumentEntity,
      BvRawPayloadEntity,
      NormalizedCompanyEntity,
      CompanyVersionEntity,
      CachePolicyEntity,
    ]),
    HttpModule,
    AuditModule,
  ],
  controllers: [CompaniesController, BolagsverketController, CachePolicyController],
  providers: [
    CompaniesService,
    BolagsverketClient,
    BolagsverketMapper,
    BolagsverketService,
    CompanyNormalizer,
    BvCacheService,
    BvPersistenceService,
    BvDocumentStorageService,
    SnapshotQueryService,
    RawPayloadStorageService,
    RawPayloadQueryService,
    NormalizationService,
    NormalizedCompanyQueryService,
    CachePolicyEvaluationService,
    RefreshDecisionService,
  ],
  exports: [
    CompaniesService,
    BolagsverketService,
    BvCacheService,
    BvPersistenceService,
    BvDocumentStorageService,
    SnapshotQueryService,
    RawPayloadStorageService,
    RawPayloadQueryService,
    NormalizationService,
    NormalizedCompanyQueryService,
    CachePolicyEvaluationService,
    RefreshDecisionService,
  ],
})
export class CompaniesModule {}
