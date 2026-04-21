import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { OwnershipModule } from '../ownership/ownership.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { AuditModule } from '../audit/audit.module';
import { ApiQuotaModule } from '../common/api-quota.module';
import { CompaniesController } from './companies.controller';
import { CompanyLookupsController } from './controllers/company-lookups.controller';
import { CompanyServingController } from './controllers/company-serving.controller';
import { TargetListsController } from './controllers/target-lists.controller';
import { CompaniesService } from './companies.service';
import { CompanyEntity } from './entities/company.entity';
import { CompanyRawPayloadEntity } from './entities/company-raw-payload.entity';
import { BvOrganisationEntity } from './entities/bv-organisation.entity';
import { BvApiCallEntity } from './entities/bv-api-call.entity';
import { BvFetchSnapshotEntity } from './entities/bv-fetch-snapshot.entity';
import { BvStoredDocumentEntity } from './entities/bv-stored-document.entity';
import { BvHvdPayloadEntity } from './entities/bv-hvd-payload.entity';
import { BvForetagsinfoPayloadEntity } from './entities/bv-foretagsinfo-payload.entity';
import { BvVhPayloadEntity } from './entities/bv-vh-payload.entity';
import { BvDocumentListEntity } from './entities/bv-document-list.entity';
import { BolagsverketClient } from './integrations/bolagsverket.client';
import { BolagsverketMapper } from './integrations/bolagsverket.mapper';
import { CompanyNormalizer } from './mappers/company-normalizer';
import { BolagsverketService } from './services/bolagsverket.service';
import { BvCacheService } from './services/bv-cache.service';
import { BvPersistenceService } from './services/bv-persistence.service';
import { BvDocumentStorageService } from './services/bv-document-storage.service';
import { SnapshotQueryService } from './services/snapshot-query.service';
import { SnapshotChainService } from './services/snapshot-chain.service';
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
import { LineageMetadataEntity } from './entities/lineage-metadata.entity';
import { LineageMetadataCaptureService } from './services/lineage-metadata-capture.service';
import { LineageQueryService } from './services/lineage-query.service';
import { LineageController } from './controllers/lineage.controller';
import { CompanyChangeEventEntity } from './entities/company-change-event.entity';
import { SnapshotComparisonService } from './services/snapshot-comparison.service';
import { ChangeEventQueryService } from './services/change-event-query.service';
import { ChangeEventController } from './controllers/change-event.controller';
import { FailureStateEntity } from './entities/failure-state.entity';
import { FailureStateService } from './services/failure-state.service';
import { CompanyMetadataService } from './services/company-metadata.service';
import { IntegrationTokenEntity } from './entities/integration-token.entity';
import { IntegrationTokenService } from './services/integration-token.service';
import { DataIngestionLogEntity } from './entities/data-ingestion-log.entity';
import { TargetListEntity } from './entities/target-list.entity';
import { TargetListItemEntity } from './entities/target-list-item.entity';
import { DataIngestionLogService } from './services/data-ingestion-log.service';
import { HvdAggregatorService } from './services/hvd-aggregator.service';
import { BolagsverketProvider } from './providers/bolagsverket.provider';
import { BvEnrichmentProcessor } from './processors/bv-enrichment.processor';
import { BV_ENRICHMENT_QUEUE } from './queues/bv-enrichment.queue';
import { BvPipelineService } from './services/bv-pipeline.service';
import { BvPipelineWorker } from './services/bv-pipeline.worker';
import { CompanyServingReadService } from './services/company-serving-read.service';
import { TargetListsService } from './services/target-lists.service';
import { ANNUAL_REPORT_PARSE_QUEUE } from '../annual-reports/queues/annual-report-parse.queue';

@Module({
  imports: [
    OwnershipModule,
    ApiQuotaModule,
    TypeOrmModule.forFeature([
      CompanyEntity,
      CompanyRawPayloadEntity,
      BvOrganisationEntity,
      BvApiCallEntity,
      BvFetchSnapshotEntity,
      BvStoredDocumentEntity,
      BvHvdPayloadEntity,
      BvForetagsinfoPayloadEntity,
      BvVhPayloadEntity,
      BvDocumentListEntity,
      BvRawPayloadEntity,
      NormalizedCompanyEntity,
      CompanyVersionEntity,
      CachePolicyEntity,
      LineageMetadataEntity,
      CompanyChangeEventEntity,
      FailureStateEntity,
      IntegrationTokenEntity,
      DataIngestionLogEntity,
      TargetListEntity,
      TargetListItemEntity,
    ]),
    HttpModule,
    AuditModule,
    BullModule.registerQueue({ name: BV_ENRICHMENT_QUEUE }),
    BullModule.registerQueue({ name: ANNUAL_REPORT_PARSE_QUEUE }),
  ],
  controllers: [
    CompaniesController,
    BolagsverketController,
    CachePolicyController,
    LineageController,
    ChangeEventController,
    CompanyLookupsController,
    CompanyServingController,
    TargetListsController,
  ],
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
    SnapshotChainService,
    RawPayloadStorageService,
    RawPayloadQueryService,
    NormalizationService,
    NormalizedCompanyQueryService,
    CachePolicyEvaluationService,
    RefreshDecisionService,
    LineageMetadataCaptureService,
    LineageQueryService,
    SnapshotComparisonService,
    ChangeEventQueryService,
    FailureStateService,
    CompanyMetadataService,
    IntegrationTokenService,
    DataIngestionLogService,
    HvdAggregatorService,
    BolagsverketProvider,
    BvEnrichmentProcessor,
    BvPipelineService,
    BvPipelineWorker,
    CompanyServingReadService,
    TargetListsService,
  ],
  exports: [
    CompaniesService,
    BolagsverketService,
    BvCacheService,
    BvPersistenceService,
    BvDocumentStorageService,
    SnapshotQueryService,
    SnapshotChainService,
    RawPayloadStorageService,
    RawPayloadQueryService,
    NormalizationService,
    NormalizedCompanyQueryService,
    CachePolicyEvaluationService,
    RefreshDecisionService,
    LineageMetadataCaptureService,
    LineageQueryService,
    SnapshotComparisonService,
    ChangeEventQueryService,
    FailureStateService,
    CompanyMetadataService,
    IntegrationTokenService,
    DataIngestionLogService,
    HvdAggregatorService,
    BolagsverketProvider,
    TargetListsService,
  ],
})
export class CompaniesModule {}
