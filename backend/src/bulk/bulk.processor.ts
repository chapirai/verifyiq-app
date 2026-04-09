import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BulkService } from './bulk.service';

@Processor('bulk-jobs', {
  concurrency: Math.max(1, Number(process.env.BULK_GLOBAL_CONCURRENCY ?? 3)),
})
export class BulkProcessor extends WorkerHost {
  constructor(private readonly bulkService: BulkService) {
    super();
  }

  async process(job: Job<{ jobId: string; itemId: string }>) {
    await this.bulkService.processItem(job.data.jobId, job.data.itemId);
  }
}
