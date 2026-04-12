import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BvStoredDocumentEntity } from '../companies/entities/bv-stored-document.entity';
import { CompanyEntity } from '../companies/entities/company.entity';
import { CompaniesModule } from '../companies/companies.module';
import { AnnualReportsController } from './annual-reports.controller';
import { AnnualReportFileEntity } from './entities/annual-report-file.entity';
import { AnnualReportFileEntryEntity } from './entities/annual-report-file-entry.entity';
import { AnnualReportParseErrorEntity } from './entities/annual-report-parse-error.entity';
import { AnnualReportParseRunEntity } from './entities/annual-report-parse-run.entity';
import { AnnualReportXbrlContextEntity } from './entities/annual-report-xbrl-context.entity';
import { AnnualReportXbrlDimensionEntity } from './entities/annual-report-xbrl-dimension.entity';
import { AnnualReportXbrlFactEntity } from './entities/annual-report-xbrl-fact.entity';
import { AnnualReportXbrlLabelEntity } from './entities/annual-report-xbrl-label.entity';
import { AnnualReportXbrlUnitEntity } from './entities/annual-report-xbrl-unit.entity';
import { CompanyAnnualReportAuditorEntity } from './entities/company-annual-report-auditor.entity';
import { CompanyAnnualReportFinancialEntity } from './entities/company-annual-report-financial.entity';
import { CompanyAnnualReportHeaderEntity } from './entities/company-annual-report-header.entity';
import { CompanyAnnualReportNotesIndexEntity } from './entities/company-annual-report-notes-index.entity';
import { CompanyAnnualReportPeriodEntity } from './entities/company-annual-report-period.entity';
import { AnnualReportImportEntity } from './entities/annual-report-import.entity';
import { AnnualReportMappedValueEntity } from './entities/annual-report-mapped-value.entity';
import { AnnualReportSectionEntity } from './entities/annual-report-section.entity';
import { AnnualReportSourceFileEntity } from './entities/annual-report-source-file.entity';
import { AnnualReportSummaryEntity } from './entities/annual-report-summary.entity';
import { AnnualReportParseProcessor } from './processors/annual-report-parse.processor';
import { ANNUAL_REPORT_PARSE_QUEUE } from './queues/annual-report-parse.queue';
import { AnnualReportArelleService } from './services/annual-report-arelle.service';
import { AnnualReportMappedSummaryService } from './services/annual-report-mapped-summary.service';
import { AnnualReportNormalizeService } from './services/annual-report-normalize.service';
import { AnnualReportPipelineService } from './services/annual-report-pipeline.service';
import { AnnualReportPrimaryContextService } from './services/annual-report-primary-context.service';
import { AnnualReportSectionExtractorService } from './services/annual-report-section-extractor.service';
import { AnnualReportsService } from './services/annual-reports.service';
import { AnnualReportXhtmlClassifierService } from './services/annual-report-xhtml-classifier.service';
import { AnnualReportWorkspaceReadModelService } from './services/annual-report-workspace-read-model.service';
import { AnnualReportZipService } from './services/annual-report-zip.service';

const annualReportEntities = [
  AnnualReportFileEntity,
  AnnualReportFileEntryEntity,
  AnnualReportParseRunEntity,
  AnnualReportParseErrorEntity,
  AnnualReportImportEntity,
  AnnualReportSourceFileEntity,
  AnnualReportSectionEntity,
  AnnualReportMappedValueEntity,
  AnnualReportSummaryEntity,
  AnnualReportXbrlContextEntity,
  AnnualReportXbrlUnitEntity,
  AnnualReportXbrlFactEntity,
  AnnualReportXbrlDimensionEntity,
  AnnualReportXbrlLabelEntity,
  CompanyAnnualReportHeaderEntity,
  CompanyAnnualReportFinancialEntity,
  CompanyAnnualReportAuditorEntity,
  CompanyAnnualReportNotesIndexEntity,
  CompanyAnnualReportPeriodEntity,
  CompanyEntity,
  BvStoredDocumentEntity,
];

@Module({
  imports: [
    TypeOrmModule.forFeature(annualReportEntities),
    BullModule.registerQueue({ name: ANNUAL_REPORT_PARSE_QUEUE }),
    CompaniesModule,
  ],
  controllers: [AnnualReportsController],
  providers: [
    AnnualReportZipService,
    AnnualReportArelleService,
    AnnualReportPrimaryContextService,
    AnnualReportXhtmlClassifierService,
    AnnualReportSectionExtractorService,
    AnnualReportNormalizeService,
    AnnualReportMappedSummaryService,
    AnnualReportWorkspaceReadModelService,
    AnnualReportPipelineService,
    AnnualReportsService,
    AnnualReportParseProcessor,
  ],
  exports: [AnnualReportsService, AnnualReportPipelineService],
})
export class AnnualReportsModule {}
