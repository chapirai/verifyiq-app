import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { OwnershipBvIngestionService } from '../../ownership/ownership-bv-ingestion.service';
import { BvPipelineService } from './bv-pipeline.service';

const DEFAULT_ENABLED =
  (process.env.BV_PIPELINE_WORKER_ENABLED ?? 'true').toLowerCase() === 'true';

/**
 * Background drain of parse/refresh queues (lightweight; same SQL as manual CALL).
 */
@Injectable()
export class BvPipelineWorker {
  private readonly logger = new Logger(BvPipelineWorker.name);

  constructor(
    private readonly pipeline: BvPipelineService,
    private readonly ownershipBvIngestion: OwnershipBvIngestionService,
  ) {}

  @Interval(15_000)
  async tick(): Promise<void> {
    if (!DEFAULT_ENABLED) return;
    try {
      await this.pipeline.processParseQueue(10, 'interval');
      await this.pipeline.processRefreshQueue(10, 'interval');
      await this.ownershipBvIngestion.drainIngestQueue(25);
    } catch (e) {
      this.logger.debug(`Pipeline worker tick skipped: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
