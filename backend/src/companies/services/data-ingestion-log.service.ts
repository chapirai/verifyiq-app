import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DataIngestionLogEntity } from '../entities/data-ingestion-log.entity';

export interface DataIngestionLogInput {
  provider: string;
  endpoint: string;
  organisationId?: string | null;
  dataset?: string | null;
  field?: string | null;
  errorType: string;
  metadata?: Record<string, unknown> | null;
  tenantId?: string | null;
}

/**
 * Insert-only service for recording data ingestion failures and partial
 * data events.  Failures here must never propagate to the caller.
 *
 * Spec refs:
 *   - foretagsinformation/v4 §8.3 Logging
 *   - Värdefulla datamängder §14 Error Logging
 */
@Injectable()
export class DataIngestionLogService {
  private readonly logger = new Logger(DataIngestionLogService.name);

  constructor(
    @InjectRepository(DataIngestionLogEntity)
    private readonly repo: Repository<DataIngestionLogEntity>,
  ) {}

  /**
   * Asynchronously persist one ingestion log entry.
   * Errors are swallowed so that logging never blocks the primary request.
   */
  async log(input: DataIngestionLogInput): Promise<void> {
    try {
      const entry = this.repo.create({
        provider: input.provider,
        endpoint: input.endpoint,
        organisationId: input.organisationId ?? null,
        dataset: input.dataset ?? null,
        field: input.field ?? null,
        errorType: input.errorType,
        metadata: input.metadata ?? null,
        tenantId: input.tenantId ?? null,
      });
      await this.repo.save(entry);
    } catch (err) {
      this.logger.error(
        `[DataIngestionLogService] Failed to persist ingestion log: ${String(err)}`,
      );
    }
  }

  /**
   * Retrieve recent ingestion logs for a tenant (for admin/audit purposes).
   */
  async findByTenant(
    tenantId: string,
    limit = 100,
  ): Promise<DataIngestionLogEntity[]> {
    return this.repo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Retrieve ingestion logs for a specific organisation.
   */
  async findByOrganisation(
    organisationId: string,
    limit = 50,
  ): Promise<DataIngestionLogEntity[]> {
    return this.repo.find({
      where: { organisationId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
