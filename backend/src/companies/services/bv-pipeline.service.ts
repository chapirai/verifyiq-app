import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Queue-driven Bolagsverket parse + serving refresh (bv_pipeline.*, CALL …process_*_queue).
 */
@Injectable()
export class BvPipelineService {
  private readonly logger = new Logger(BvPipelineService.name);

  constructor(private readonly dataSource: DataSource) {}

  async createLookupRequest(
    tenantId: string,
    organisationsnummer: string,
    correlationId?: string | null,
  ): Promise<string> {
    const rows = await this.dataSource.query(
      `INSERT INTO bv_pipeline.lookup_requests (tenant_id, organisationsnummer, status, correlation_id)
       VALUES ($1::uuid, $2, 'queued', $3::uuid)
       RETURNING id::text AS id`,
      [tenantId, organisationsnummer, correlationId ?? null],
    );
    return rows[0]?.id as string;
  }

  async getLookupRequest(id: string, tenantId: string): Promise<Record<string, unknown> | null> {
    const rows = await this.dataSource.query(
      `SELECT id::text, tenant_id::text, organisationsnummer, status, correlation_id::text,
              error_message, created_at, updated_at
       FROM bv_pipeline.lookup_requests
       WHERE id = $1::uuid AND tenant_id = $2::uuid`,
      [id, tenantId],
    );
    return (rows[0] as Record<string, unknown>) ?? null;
  }

  async enqueueRawPayloadForParse(
    rawPayloadId: string,
    lookupRequestId: string | null,
    priority = 0,
  ): Promise<string> {
    const rows = await this.dataSource.query(
      `SELECT bv_pipeline.enqueue_raw_payload_for_parse($1::uuid, $2::uuid, $3::int)::text AS id`,
      [rawPayloadId, lookupRequestId, priority],
    );
    return String(rows[0]?.id ?? '');
  }

  async processParseQueue(batchSize: number, workerName: string): Promise<void> {
    await this.dataSource.query(`CALL bv_pipeline.process_parse_queue($1, $2)`, [batchSize, workerName]);
  }

  async processRefreshQueue(batchSize: number, workerName: string): Promise<void> {
    await this.dataSource.query(`CALL bv_pipeline.process_refresh_queue($1, $2)`, [batchSize, workerName]);
  }

  /**
   * Process pending parse + refresh jobs until queues are empty or maxRounds is reached.
   */
  async drainQueues(maxRounds = 40): Promise<void> {
    for (let i = 0; i < maxRounds; i++) {
      try {
        await this.processParseQueue(25, 'nest-drain');
        await this.processRefreshQueue(25, 'nest-drain');
      } catch (e) {
        this.logger.warn(`drainQueues round failed: ${e instanceof Error ? e.message : String(e)}`);
        break;
      }
      const c = await this.dataSource.query(
        `SELECT
           (SELECT COUNT(*)::int FROM bv_pipeline.parse_queue WHERE status IN ('pending','retry')) AS p,
           (SELECT COUNT(*)::int FROM bv_pipeline.refresh_queue WHERE status IN ('pending','retry')) AS r`,
      );
      if ((c[0]?.p ?? 0) === 0 && (c[0]?.r ?? 0) === 0) break;
    }
  }

  async latestRawPayloadIdForOrg(tenantId: string, organisationsnummer: string): Promise<string | null> {
    const rows = await this.dataSource.query(
      `SELECT id::text AS id FROM public.bv_raw_payloads
       WHERE tenant_id = $1::uuid AND organisationsnummer = $2
       ORDER BY created_at DESC NULLS LAST, id DESC
       LIMIT 1`,
      [tenantId, organisationsnummer],
    );
    return (rows[0]?.id as string) ?? null;
  }

  async markLookupFailed(lookupRequestId: string, message: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE bv_pipeline.lookup_requests
       SET status = 'failed', error_message = $2, updated_at = NOW()
       WHERE id = $1::uuid`,
      [lookupRequestId, message],
    );
  }
}
