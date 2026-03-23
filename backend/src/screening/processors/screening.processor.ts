import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ScreeningService } from '../screening.service';

@Processor('screening')
export class ScreeningProcessor extends WorkerHost {
  constructor(private readonly screeningService: ScreeningService) {
    super();
  }

  async process(job: Job<{ jobId: string }>) {
    await this.screeningService.executeJob(job.data.jobId);
  }
}
