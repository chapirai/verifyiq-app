import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ANNUAL_REPORT_PARSE_QUEUE } from '../queues/annual-report-parse.queue';
import type {
  AnnualReportAutoIngestHvdJobData,
  AnnualReportBackfillJobData,
  AnnualReportParseJobData,
  AnnualReportRebuildServingJobData,
} from '../queues/annual-report-parse.queue';
import { AnnualReportPipelineService } from '../services/annual-report-pipeline.service';
import { AnnualReportsService } from '../services/annual-reports.service';

@Processor(ANNUAL_REPORT_PARSE_QUEUE, {
  concurrency: Math.max(1, Number(process.env.ANNUAL_REPORT_PARSE_CONCURRENCY ?? 2)),
})
export class AnnualReportParseProcessor extends WorkerHost {
  private readonly logger = new Logger(AnnualReportParseProcessor.name);

  constructor(
    private readonly pipeline: AnnualReportPipelineService,
    private readonly annualReports: AnnualReportsService,
  ) {
    super();
  }

  async process(
    job: Job<
      | AnnualReportParseJobData
      | AnnualReportBackfillJobData
      | AnnualReportRebuildServingJobData
      | AnnualReportAutoIngestHvdJobData,
      unknown,
      string
    >,
  ): Promise<unknown> {
    try {
      if (job.name === 'auto-ingest-hvd-documents') {
        const data = job.data as AnnualReportAutoIngestHvdJobData;
        return await this.annualReports.runAutoIngestHvdDocumentsWorker(data);
      }
      if (job.name === 'parse') {
        const data = job.data as AnnualReportParseJobData;
        return await this.pipeline.processFileId(data.tenantId, data.annualReportFileId, {
          force: data.force,
        });
      }
      if (job.name === 'backfill') {
        const data = job.data as AnnualReportBackfillJobData;
        return await this.annualReports.runBackfillWorker(data);
      }
      if (job.name === 'rebuild-serving') {
        const data = job.data as AnnualReportRebuildServingJobData;
        return await this.annualReports.runRebuildServingWorker(data);
      }
      this.logger.warn(`Unknown annual report job name: ${job.name}`);
      return { skipped: true };
    } catch (e) {
      this.logger.error(
        `Annual report job ${job.name} failed: ${e instanceof Error ? e.message : String(e)}`,
      );
      throw e;
    }
  }
}
