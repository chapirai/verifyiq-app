import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { OwnershipService } from '../ownership.service';
import {
  OWNERSHIP_ADVANCED_INSIGHTS_QUEUE,
  OwnershipAdvancedInsightsJobData,
  OwnershipAdvancedInsightsJobName,
} from '../queues/ownership-advanced-insights.queue';

@Processor(OWNERSHIP_ADVANCED_INSIGHTS_QUEUE)
export class OwnershipAdvancedInsightsProcessor extends WorkerHost {
  constructor(private readonly ownershipService: OwnershipService) {
    super();
  }

  async process(job: Job<OwnershipAdvancedInsightsJobData>) {
    if (job.name !== OwnershipAdvancedInsightsJobName.PRECOMPUTE) return;
    const org = job.data.organisationNumber.replace(/\D/g, '');
    if (org.length !== 10 && org.length !== 12) return;
    await this.ownershipService.precomputeAdvancedOwnershipInsights(job.data.tenantId, org);
  }
}

