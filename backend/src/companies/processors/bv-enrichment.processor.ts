import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { BolagsverketService } from '../services/bolagsverket.service';
import { HvdAggregatorService } from '../services/hvd-aggregator.service';
import { DataIngestionLogService } from '../services/data-ingestion-log.service';
import {
  AggregateHvdJobData,
  BV_ENRICHMENT_QUEUE,
  BvEnrichmentJobName,
  FetchArendenJobData,
  FetchEngagementsJobData,
  FetchFinancialReportsJobData,
} from '../queues/bv-enrichment.queue';

type BvJobData =
  | FetchFinancialReportsJobData
  | FetchArendenJobData
  | FetchEngagementsJobData
  | AggregateHvdJobData;

/**
 * Worker that processes heavy Bolagsverket enrichment jobs asynchronously.
 *
 * Heavy endpoints (finansiella-rapporter, arenden, organisationsengagemang,
 * HVD aggregation) are dispatched here rather than running inline in the
 * HTTP request path.
 *
 * Spec refs:
 *  - foretagsinformation/v4 §11 Background Processing
 *  - Värdefulla datamängder §12 Background Processing
 */
@Processor(BV_ENRICHMENT_QUEUE)
export class BvEnrichmentProcessor extends WorkerHost {
  private readonly logger = new Logger(BvEnrichmentProcessor.name);

  constructor(
    private readonly bvService: BolagsverketService,
    private readonly hvdAggregator: HvdAggregatorService,
    private readonly ingestionLog: DataIngestionLogService,
  ) {
    super();
  }

  async process(job: Job<BvJobData>): Promise<void> {
    this.logger.debug(`[BvEnrichmentProcessor] Processing job ${job.name} (id=${job.id})`);

    switch (job.name as BvEnrichmentJobName) {
      case BvEnrichmentJobName.FETCH_FINANCIAL_REPORTS:
        await this.handleFinancialReports(job as Job<FetchFinancialReportsJobData>);
        break;
      case BvEnrichmentJobName.FETCH_ARENDEN:
        await this.handleArenden(job as Job<FetchArendenJobData>);
        break;
      case BvEnrichmentJobName.FETCH_ENGAGEMENTS:
        await this.handleEngagements(job as Job<FetchEngagementsJobData>);
        break;
      case BvEnrichmentJobName.AGGREGATE_HVD:
        await this.handleHvdAggregation(job as Job<AggregateHvdJobData>);
        break;
      default:
        this.logger.warn(`[BvEnrichmentProcessor] Unknown job name: ${job.name}`);
    }
  }

  private async handleFinancialReports(
    job: Job<FetchFinancialReportsJobData>,
  ): Promise<void> {
    const { identitetsbeteckning, fromdatum, tomdatum, tenantId, correlationId, actorId } = job.data;
    const context = { tenantId, correlationId: correlationId ?? null, actorId: actorId ?? null };
    try {
      await this.bvService.getFinancialReports(identitetsbeteckning, fromdatum, tomdatum, context);
      this.logger.log(
        `[BvEnrichmentProcessor] Financial reports fetched for ${identitetsbeteckning}`,
      );
    } catch (err) {
      await this.ingestionLog.log({
        provider: 'bolagsverket',
        endpoint: '/foretagsinformation/v4/finansiellarapporter',
        organisationId: identitetsbeteckning,
        errorType: this.classifyError(err),
        metadata: { jobId: job.id, message: String(err) },
        tenantId,
      });
      throw err;
    }
  }

  private async handleArenden(job: Job<FetchArendenJobData>): Promise<void> {
    const { organisationIdentitetsbeteckning, fromdatum, tomdatum, tenantId, correlationId, actorId } =
      job.data;
    const context = { tenantId, correlationId: correlationId ?? null, actorId: actorId ?? null };
    try {
      await this.bvService.getCases(
        undefined,
        organisationIdentitetsbeteckning,
        fromdatum,
        tomdatum,
        context,
      );
      this.logger.log(
        `[BvEnrichmentProcessor] Arenden fetched for ${organisationIdentitetsbeteckning}`,
      );
    } catch (err) {
      await this.ingestionLog.log({
        provider: 'bolagsverket',
        endpoint: '/foretagsinformation/v4/arenden',
        organisationId: organisationIdentitetsbeteckning,
        errorType: this.classifyError(err),
        metadata: { jobId: job.id, message: String(err) },
        tenantId,
      });
      throw err;
    }
  }

  private async handleEngagements(job: Job<FetchEngagementsJobData>): Promise<void> {
    const { identitetsbeteckning, pageNumber, pageSize, tenantId, correlationId, actorId } =
      job.data;
    const context = { tenantId, correlationId: correlationId ?? null, actorId: actorId ?? null };
    try {
      await this.bvService.getOrganisationEngagements(
        identitetsbeteckning,
        pageNumber,
        pageSize,
        context,
      );
      this.logger.log(
        `[BvEnrichmentProcessor] Engagements fetched for ${identitetsbeteckning}`,
      );
    } catch (err) {
      await this.ingestionLog.log({
        provider: 'bolagsverket',
        endpoint: '/foretagsinformation/v4/organisationsengagemang',
        organisationId: identitetsbeteckning,
        errorType: this.classifyError(err),
        metadata: { jobId: job.id, message: String(err) },
        tenantId,
      });
      throw err;
    }
  }

  private async handleHvdAggregation(job: Job<AggregateHvdJobData>): Promise<void> {
    const { identitetsbeteckning, tenantId, correlationId, actorId } = job.data;
    const context = { tenantId, correlationId: correlationId ?? null, actorId: actorId ?? null };
    try {
      const hvdResponse = await this.bvService.getHighValueCompanyInformation(
        identitetsbeteckning,
        context,
      );
      await this.hvdAggregator.aggregate(hvdResponse, {
        tenantId,
        organisationId: identitetsbeteckning,
      });
      this.logger.log(
        `[BvEnrichmentProcessor] HVD aggregation completed for ${identitetsbeteckning}`,
      );
    } catch (err) {
      await this.ingestionLog.log({
        provider: 'vardefulla_datamangder',
        endpoint: '/vardefulla-datamangder/v1/organisationer',
        organisationId: identitetsbeteckning,
        errorType: this.classifyError(err),
        metadata: { jobId: job.id, message: String(err) },
        tenantId,
      });
      throw err;
    }
  }

  private classifyError(err: unknown): string {
    if (err instanceof Error) {
      const msg = err.message;
      if (msg.includes('401')) return 'HTTP_401';
      if (msg.includes('403')) return 'HTTP_403';
      if (msg.includes('429')) return 'HTTP_429_RATE_LIMIT';
      if (msg.includes('500')) return 'HTTP_500';
    }
    return 'UNKNOWN';
  }
}
