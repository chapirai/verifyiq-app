import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { CompaniesService } from '../companies/companies.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { BulkJobEntity } from './entities/bulk-job.entity';
import { BulkJobItemEntity } from './entities/bulk-job-item.entity';
import { CreateBulkJobDto } from './dto/create-bulk-job.dto';
import { ProviderRateLimitService } from './provider-rate-limit.service';

@Injectable()
export class BulkService {
  private readonly maxAttempts = Math.max(1, Number(process.env.BULK_RETRY_MAX_ATTEMPTS ?? 3));
  private readonly tenantConcurrencyLimit = Math.max(1, Number(process.env.BULK_TENANT_CONCURRENCY ?? 2));
  private readonly tenantInFlight = new Map<string, number>();

  constructor(
    @InjectRepository(BulkJobEntity)
    private readonly bulkJobRepository: Repository<BulkJobEntity>,
    @InjectRepository(BulkJobItemEntity)
    private readonly bulkJobItemRepository: Repository<BulkJobItemEntity>,
    @InjectQueue('bulk-jobs')
    private readonly bulkQueue: Queue,
    private readonly companiesService: CompaniesService,
    private readonly providerRateLimitService: ProviderRateLimitService,
  ) {}

  async createJob(tenantId: string, dto: CreateBulkJobDto): Promise<BulkJobEntity> {
    const identifiers = Array.from(new Set((dto.identifiers ?? []).map((x) => x.trim()).filter(Boolean)));
    const rowsTotal = dto.rowsTotal ?? identifiers.length;
    const job = this.bulkJobRepository.create({
      tenantId,
      fileName: dto.fileName,
      rowsTotal,
      rowsProcessed: 0,
      successCount: 0,
      failedCount: 0,
      remainingCount: rowsTotal,
      status: 'queued',
      errorMessage: null,
      completedAt: null,
    });
    const savedJob = await this.bulkJobRepository.save(job);

    if (identifiers.length > 0) {
      const items = identifiers.map((identifier) =>
        this.bulkJobItemRepository.create({
          tenantId,
          jobId: savedJob.id,
          identifier,
          status: 'queued',
          attemptCount: 0,
          errorReason: null,
          snapshotId: null,
          resultMetadata: {},
        }),
      );
      const savedItems = await this.bulkJobItemRepository.save(items);
      for (const item of savedItems) {
        await this.bulkQueue.add(
          'bulk-item',
          { jobId: savedJob.id, itemId: item.id },
          {
            attempts: this.maxAttempts,
            removeOnComplete: 1000,
            removeOnFail: 1000,
          },
        );
      }
      savedJob.status = 'processing';
      await this.bulkJobRepository.save(savedJob);
    }

    return savedJob;
  }

  async listJobs(tenantId: string): Promise<BulkJobEntity[]> {
    return this.bulkJobRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async getJob(tenantId: string, jobId: string): Promise<BulkJobEntity> {
    const job = await this.bulkJobRepository.findOne({ where: { id: jobId, tenantId } });
    if (!job) {
      throw new NotFoundException('Bulk job not found');
    }
    return job;
  }

  async listJobItems(tenantId: string, jobId: string): Promise<BulkJobItemEntity[]> {
    await this.getJob(tenantId, jobId);
    return this.bulkJobItemRepository.find({
      where: { tenantId, jobId },
      order: { createdAt: 'ASC' },
    });
  }

  async retryFailedItems(tenantId: string, jobId: string): Promise<{ queued: number }> {
    const job = await this.getJob(tenantId, jobId);
    const failedItems = await this.bulkJobItemRepository.find({
      where: { tenantId, jobId, status: 'failed' },
      order: { updatedAt: 'ASC' },
    });
    for (const item of failedItems) {
      item.status = 'queued';
      item.errorReason = null;
    }
    await this.bulkJobItemRepository.save(failedItems);
    job.status = 'processing';
    await this.bulkJobRepository.save(job);
    for (const item of failedItems) {
      await this.bulkQueue.add('bulk-item', { jobId, itemId: item.id }, { attempts: this.maxAttempts });
    }
    return { queued: failedItems.length };
  }

  async processItem(jobId: string, itemId: string): Promise<void> {
    const item = await this.bulkJobItemRepository.findOne({ where: { id: itemId, jobId } });
    if (!item) return;

    const job = await this.bulkJobRepository.findOne({ where: { id: jobId, tenantId: item.tenantId } });
    if (!job) return;

    const ctx: TenantContext = { tenantId: item.tenantId, actorId: null };
    await this.waitForTenantSlot(item.tenantId);

    try {
      item.status = 'processing';
      item.attemptCount += 1;
      await this.bulkJobItemRepository.save(item);

      await this.providerRateLimitService.waitTurn();
      const response = await this.companiesService.orchestrateLookup(ctx, {
        identitetsbeteckning: item.identifier,
        force_refresh: false,
      });

      item.status = 'completed';
      item.snapshotId = response.metadata.snapshot_id;
      item.resultMetadata = {
        source: response.metadata.source,
        freshness: response.metadata.freshness,
        fetched_at: response.metadata.fetched_at,
      };
      item.errorReason = null;
      await this.bulkJobItemRepository.save(item);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown processing error';
      item.status = 'failed';
      item.errorReason = message;
      await this.bulkJobItemRepository.save(item);
    }
    finally {
      this.releaseTenantSlot(item.tenantId);
    }

    await this.recomputeJob(job.id);
  }

  async exportCsv(tenantId: string, jobId: string): Promise<string> {
    const items = await this.listJobItems(tenantId, jobId);
    const lines = ['identifier,status,attempt_count,error_reason,snapshot_id,source,freshness,fetched_at'];
    for (const item of items) {
      const source = String(item.resultMetadata?.source ?? '');
      const freshness = String(item.resultMetadata?.freshness ?? '');
      const fetchedAt = String(item.resultMetadata?.fetched_at ?? '');
      const errorReason = (item.errorReason ?? '').replace(/"/g, '""');
      lines.push(
        `${item.identifier},${item.status},${item.attemptCount},"${errorReason}",${item.snapshotId ?? ''},${source},${freshness},${fetchedAt}`,
      );
    }
    return `${lines.join('\n')}\n`;
  }

  private async recomputeJob(jobId: string): Promise<void> {
    const job = await this.bulkJobRepository.findOne({ where: { id: jobId } });
    if (!job) return;
    const [rowsProcessed, successCount, failedCount, remainingCount] = await Promise.all([
      this.bulkJobItemRepository.count({ where: { jobId, status: 'completed' } }),
      this.bulkJobItemRepository.count({ where: { jobId, status: 'completed' } }),
      this.bulkJobItemRepository.count({ where: { jobId, status: 'failed' } }),
      this.bulkJobItemRepository.count({ where: { jobId, status: 'queued' } }),
    ]);
    const processingCount = await this.bulkJobItemRepository.count({ where: { jobId, status: 'processing' } });
    job.rowsProcessed = rowsProcessed + failedCount;
    job.successCount = successCount;
    job.failedCount = failedCount;
    job.remainingCount = remainingCount + processingCount;
    if (job.rowsProcessed >= job.rowsTotal || (remainingCount === 0 && processingCount === 0)) {
      job.status = failedCount > 0 ? 'partial' : 'completed';
      job.completedAt = new Date();
    } else {
      job.status = 'processing';
      job.completedAt = null;
    }
    await this.bulkJobRepository.save(job);
  }

  private async waitForTenantSlot(tenantId: string): Promise<void> {
    while ((this.tenantInFlight.get(tenantId) ?? 0) >= this.tenantConcurrencyLimit) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    this.tenantInFlight.set(tenantId, (this.tenantInFlight.get(tenantId) ?? 0) + 1);
  }

  private releaseTenantSlot(tenantId: string): void {
    const current = this.tenantInFlight.get(tenantId) ?? 0;
    if (current <= 1) {
      this.tenantInFlight.delete(tenantId);
      return;
    }
    this.tenantInFlight.set(tenantId, current - 1);
  }
}
