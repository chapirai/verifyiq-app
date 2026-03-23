import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ReportsService } from './reports.service';

@Processor('reports')
export class ReportsProcessor extends WorkerHost {
  constructor(private readonly reportsService: ReportsService) {
    super();
  }

  async process(job: Job<{ reportId: string }>) {
    const csv = `id,status
${job.data.reportId},completed
`;

    const storageKey = `reports/${job.data.reportId}.csv`;

    await this.reportsService.markCompleted(job.data.reportId, storageKey);

    return {
      storageKey,
      bytes: Buffer.byteLength(csv, 'utf8')
    };
  }
}