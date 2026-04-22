import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  DECISION_REFRESH_QUEUE,
  DecisionRefreshJobData,
  DecisionRefreshJobName,
} from '../queues/decision-refresh.queue';

@Injectable()
export class DecisionRefreshTriggerService {
  constructor(@InjectQueue(DECISION_REFRESH_QUEUE) private readonly queue: Queue<DecisionRefreshJobData>) {}

  async enqueue(payload: DecisionRefreshJobData) {
    const org = payload.organisationNumber.replace(/\D/g, '');
    if (org.length !== 10 && org.length !== 12) return null;
    // BullMQ rejects custom jobId values containing ":" (see bullmq Job.validateOptions).
    const jobId = `dr-${payload.tenantId}-${org}-${payload.reason}-${payload.triggerId}`.replace(
      /:/g,
      '-',
    );
    return this.queue.add(
      DecisionRefreshJobName.REFRESH_ORG,
      { ...payload, organisationNumber: org },
      {
        jobId,
        removeOnComplete: true,
        removeOnFail: 1000,
        attempts: 2,
      },
    );
  }

  async getQueueStatus(tenantId: string, limit = 25) {
    const [waiting, active, delayed, failed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getDelayedCount(),
      this.queue.getFailedCount(),
    ]);
    const completedJobs = await this.queue.getJobs(['completed'], 0, Math.min(Math.max(limit, 1), 200), false);
    const latestByOrg = new Map<string, string>();
    for (const job of completedJobs) {
      const data = job.data;
      if (!data || data.tenantId !== tenantId) continue;
      if (!latestByOrg.has(data.organisationNumber)) {
        latestByOrg.set(data.organisationNumber, new Date(job.finishedOn ?? Date.now()).toISOString());
      }
    }
    return {
      queue: DECISION_REFRESH_QUEUE,
      counts: { waiting, active, delayed, failed },
      latest_processed_per_org: Object.fromEntries(latestByOrg),
      sampled_completed_jobs: completedJobs
        .filter((j) => j.data?.tenantId === tenantId)
        .slice(0, limit)
        .map((j) => ({
          id: String(j.id),
          tenant_id: j.data.tenantId,
          organisation_number: j.data.organisationNumber,
          reason: j.data.reason,
          trigger_id: j.data.triggerId,
          finished_at: j.finishedOn ? new Date(j.finishedOn).toISOString() : null,
        })),
    };
  }
}

