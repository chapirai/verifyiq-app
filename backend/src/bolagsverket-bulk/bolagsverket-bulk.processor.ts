import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BolagsverketBulkService } from './bolagsverket-bulk.service';
import {
  BOLAGSVERKET_BULK_QUEUE,
  BolagsverketBulkJobName,
  ProcessEnrichmentRequestJobData,
  RunWeeklyIngestionJobData,
} from './queues/bolagsverket-bulk.queue';

@Processor(BOLAGSVERKET_BULK_QUEUE)
export class BolagsverketBulkProcessor extends WorkerHost {
  constructor(private readonly bulkService: BolagsverketBulkService) {
    super();
  }

  async process(job: Job<RunWeeklyIngestionJobData | ProcessEnrichmentRequestJobData>): Promise<void> {
    if (job.name === BolagsverketBulkJobName.RUN_WEEKLY_INGESTION) {
      const data = job.data as RunWeeklyIngestionJobData;
      await this.bulkService.runWeeklyIngestion(data.sourceUrl);
      return;
    }
    if (job.name === BolagsverketBulkJobName.PROCESS_ENRICHMENT_REQUEST) {
      const data = job.data as ProcessEnrichmentRequestJobData;
      await this.bulkService.processEnrichmentRequest(data.requestId);
    }
  }
}

