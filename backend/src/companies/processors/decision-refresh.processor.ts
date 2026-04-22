import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { CompanyDecisionService } from '../services/company-decision.service';
import {
  DECISION_REFRESH_QUEUE,
  DecisionRefreshJobData,
  DecisionRefreshJobName,
} from '../queues/decision-refresh.queue';

@Processor(DECISION_REFRESH_QUEUE)
export class DecisionRefreshProcessor extends WorkerHost {
  private readonly logger = new Logger(DecisionRefreshProcessor.name);

  constructor(private readonly decisionService: CompanyDecisionService) {
    super();
  }

  async process(job: Job<DecisionRefreshJobData>): Promise<void> {
    if (job.name !== DecisionRefreshJobName.REFRESH_ORG) return;
    const { tenantId, organisationNumber } = job.data;
    await this.decisionService.generateAndPersistAllModes(tenantId, organisationNumber);
    this.logger.debug(`Decision snapshots refreshed for ${organisationNumber} (${job.data.reason})`);
  }
}

