import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { CompanySignalEntity } from '../entities/company-signal.entity';
import { CompanyEntity } from '../entities/company.entity';
import {
  COMPANY_SIGNALS_QUEUE,
  CompanySignalsJobName,
} from '../queues/company-signals.queue';
import type { CompanySignalsJobData } from '../queues/company-signals.queue';
import { SIGNAL_CATALOG, SIGNAL_ENGINE_VERSION } from '../signals/signals-catalog';

@Injectable()
export class CompanySignalsService {
  constructor(
    @InjectRepository(CompanySignalEntity)
    private readonly signalRepo: Repository<CompanySignalEntity>,
    @InjectRepository(CompanyEntity)
    private readonly companyRepo: Repository<CompanyEntity>,
    @InjectQueue(COMPANY_SIGNALS_QUEUE)
    private readonly signalsQueue: Queue,
  ) {}

  async listLatest(tenantId: string, organisationNumberRaw: string) {
    const organisationNumber = organisationNumberRaw.replace(/\D/g, '');
    if (organisationNumber.length !== 10 && organisationNumber.length !== 12) {
      throw new NotFoundException('Invalid organisation number');
    }
    const exists = await this.companyRepo.exist({
      where: { tenantId, organisationNumber },
    });
    if (!exists) throw new NotFoundException('Company not found in tenant index');

    const rows = await this.signalRepo
      .createQueryBuilder('s')
      .distinctOn(['s.signalType'])
      .where('s.tenantId = :tenantId', { tenantId })
      .andWhere('s.organisationNumber = :organisationNumber', { organisationNumber })
      .orderBy('s.signalType', 'ASC')
      .addOrderBy('s.computedAt', 'DESC')
      .getMany();

    const byType = new Map(rows.map((r) => [r.signalType, r]));
    const data = SIGNAL_CATALOG.map((c) => {
      const row = byType.get(c.type);
      return {
        signal_type: c.type,
        definition: c.definition,
        engine_version: row?.engineVersion ?? null,
        score: row?.score != null ? Number(row.score) : null,
        explanation: row?.explanation ?? null,
        computed_at: row?.computedAt?.toISOString() ?? null,
      };
    });

    return {
      organisation_number: organisationNumber,
      engine_catalog_version: SIGNAL_ENGINE_VERSION,
      data,
    };
  }

  async enqueueRecompute(payload: {
    tenantId: string;
    actorId: string | null;
    organisationNumber: string;
  }) {
    const organisationNumber = payload.organisationNumber.replace(/\D/g, '');
    if (organisationNumber.length !== 10 && organisationNumber.length !== 12) {
      throw new NotFoundException('Invalid organisation number');
    }
    const exists = await this.companyRepo.exist({
      where: { tenantId: payload.tenantId, organisationNumber },
    });
    if (!exists) throw new NotFoundException('Company not found in tenant index');

    const jobData: CompanySignalsJobData = {
      tenantId: payload.tenantId,
      organisationNumber,
      actorId: payload.actorId,
      engineVersion: SIGNAL_ENGINE_VERSION,
    };
    const job = await this.signalsQueue.add(CompanySignalsJobName.RECOMPUTE_ORG, jobData, {
      removeOnComplete: true,
      attempts: 2,
    });
    return {
      queued: true,
      job_id: String(job.id),
      organisation_number: organisationNumber,
      engine_version: SIGNAL_ENGINE_VERSION,
    };
  }

  async getJobStatus(tenantId: string, jobId: string) {
    const job = await this.signalsQueue.getJob(jobId);
    if (!job) throw new NotFoundException('Signal job not found');
    const data = (job.data ?? {}) as Partial<CompanySignalsJobData>;
    if (!data.tenantId || data.tenantId !== tenantId) {
      throw new NotFoundException('Signal job not found');
    }
    const state = await job.getState();
    return {
      id: String(job.id),
      name: job.name,
      state,
      attempts_made: job.attemptsMade,
      processed_on: job.processedOn ?? null,
      finished_on: job.finishedOn ?? null,
      failed_reason: job.failedReason ?? null,
    };
  }
}
