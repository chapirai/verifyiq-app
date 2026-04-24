import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ObjectStorageModule } from '../object-storage/object-storage.module';
import { CompaniesModule } from '../companies/companies.module';
import { BvBulkCompanyStagingEntity } from '../bolagsverket-bulk/entities/bv-bulk-company-staging.entity';
import { BvBulkRawRowEntity } from '../bolagsverket-bulk/entities/bv-bulk-raw-row.entity';
import { BvBulkRunCheckpointEntity } from '../bolagsverket-bulk/entities/bv-bulk-run-checkpoint.entity';
import { BolagsverketBulkParser } from '../bolagsverket-bulk/bolagsverket-bulk.parser';
import { IngestionController } from './ingestion.controller';
import { BatchWriterService } from './batch-writer.service';
import { BolagsverketLineParserService } from './bolagsverket-line-parser.service';
import { CompanyFinancialSummaryEntity } from './entities/company-financial-summary.entity';
import { CompanyOwnershipSummaryEntity } from './entities/company-ownership-summary.entity';
import { CompanySourceStatusEntity } from './entities/company-source-status.entity';
import { IngestionRunEntity } from './entities/ingestion-run.entity';
import { IngestionSourceStatusEntity } from './entities/ingestion-source-status.entity';
import { LatestCompanyProfileEntity } from './entities/latest-company-profile.entity';
import { RawRecordLineageEntity } from './entities/raw-record-lineage.entity';
import { SourceFileEntity } from './entities/source-file.entity';
import { IngestionLoggerService } from './ingestion-logger.service';
import { IngestionService } from './ingestion.service';
import { MemoryGuardService } from './memory-guard.service';
import { ProviderDownloadService } from './provider-download.service';
import { ZipStreamService } from './zip-stream.service';
import { CopyLoaderService } from './copy-loader.service';
import { StagingRepositoryService } from './staging-repository.service';
import { ReadModelBuilderService } from './read-model-builder.service';
import { CompanyProfileRefreshService } from './company-profile-refresh.service';
import { FinancialSummaryBuilderService } from './financial-summary-builder.service';
import { OwnershipSummaryBuilderService } from './ownership-summary-builder.service';
import { CompanyRefreshOrchestratorService } from './company-refresh-orchestrator.service';

@Module({
  imports: [
    HttpModule,
    CompaniesModule,
    ObjectStorageModule,
    TypeOrmModule.forFeature([
      IngestionRunEntity,
      IngestionSourceStatusEntity,
      SourceFileEntity,
      RawRecordLineageEntity,
      LatestCompanyProfileEntity,
      CompanyFinancialSummaryEntity,
      CompanyOwnershipSummaryEntity,
      CompanySourceStatusEntity,
      BvBulkRawRowEntity,
      BvBulkCompanyStagingEntity,
      BvBulkRunCheckpointEntity,
    ]),
  ],
  controllers: [IngestionController],
  providers: [
    IngestionService,
    ProviderDownloadService,
    ZipStreamService,
    BolagsverketLineParserService,
    BatchWriterService,
    CopyLoaderService,
    StagingRepositoryService,
    ReadModelBuilderService,
    CompanyProfileRefreshService,
    FinancialSummaryBuilderService,
    OwnershipSummaryBuilderService,
    CompanyRefreshOrchestratorService,
    IngestionLoggerService,
    MemoryGuardService,
    BolagsverketBulkParser,
  ],
  exports: [
    ProviderDownloadService,
    ZipStreamService,
    IngestionService,
    BatchWriterService,
    BolagsverketLineParserService,
    MemoryGuardService,
    IngestionLoggerService,
  ],
})
export class IngestionModule {}

