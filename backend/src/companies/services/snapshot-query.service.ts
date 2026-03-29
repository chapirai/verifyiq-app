import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BvFetchSnapshotEntity, SnapshotPolicyDecision } from '../entities/bv-fetch-snapshot.entity';

export interface FetchHistoryStats {
  /** Total number of fetch attempts recorded for the organisation. */
  totalFetches: number;
  /** Number of successful fetches (fetchStatus = 'success'). */
  successCount: number;
  /** Number of failed fetches (fetchStatus = 'error'). */
  errorCount: number;
  /** Success rate as a value between 0 and 1, or null when no fetches exist. */
  successRate: number | null;
  /** ISO timestamp of the most recent fetch, or null when no fetches exist. */
  lastFetchedAt: string | null;
  /** Age in days since the last successful fetch, or null when no successful fetch exists. */
  lastSuccessAgeInDays: number | null;
  /** Number of fetches served from cache (policy = cache_hit). */
  cacheHits: number;
  /** Number of force-refresh fetches. */
  forceRefreshCount: number;
}

export interface SnapshotAuditQuery {
  /** Filter by correlation ID (exact match). */
  correlationId?: string;
  /** Filter by actor ID (exact match). */
  actorId?: string;
  /** Filter by policy decision. */
  policyDecision?: SnapshotPolicyDecision;
  /** Filter by fetch status ('success' | 'error' | 'partial'). */
  fetchStatus?: string;
  /** Return only stale-fallback snapshots. */
  staleFallbackOnly?: boolean;
  /** Maximum number of results to return (default: 50). */
  limit?: number;
}

@Injectable()
export class SnapshotQueryService {
  constructor(
    @InjectRepository(BvFetchSnapshotEntity)
    private readonly snapshotRepo: Repository<BvFetchSnapshotEntity>,
  ) {}

  /**
   * Return paginated fetch history for a specific organisation within a tenant.
   * Results are ordered most-recent first.
   */
  async getSnapshotHistory(
    tenantId: string,
    organisationsnummer: string,
    limit = 20,
  ): Promise<BvFetchSnapshotEntity[]> {
    return this.snapshotRepo.find({
      where: { tenantId, organisationsnummer },
      order: { fetchedAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Retrieve a single snapshot by ID, scoped to the tenant.
   * Returns null when not found or when the snapshot belongs to a different tenant.
   */
  async getSnapshotById(
    tenantId: string,
    snapshotId: string,
  ): Promise<BvFetchSnapshotEntity | null> {
    return this.snapshotRepo.findOne({
      where: { id: snapshotId, tenantId },
    });
  }

  /**
   * Compute aggregate fetch-history statistics for an organisation.
   * Useful for cost analysis, success-rate dashboards, and freshness monitoring.
   */
  async getFetchStats(
    tenantId: string,
    organisationsnummer: string,
  ): Promise<FetchHistoryStats> {
    const snapshots = await this.snapshotRepo.find({
      where: { tenantId, organisationsnummer },
      order: { fetchedAt: 'DESC' },
    });

    const totalFetches = snapshots.length;
    if (totalFetches === 0) {
      return {
        totalFetches: 0,
        successCount: 0,
        errorCount: 0,
        successRate: null,
        lastFetchedAt: null,
        lastSuccessAgeInDays: null,
        cacheHits: 0,
        forceRefreshCount: 0,
      };
    }

    const successCount = snapshots.filter((s) => s.fetchStatus === 'success').length;
    const errorCount = snapshots.filter((s) => s.fetchStatus === 'error').length;
    const successRate = successCount / totalFetches;
    const lastFetchedAt = snapshots[0].fetchedAt.toISOString();

    const lastSuccess = snapshots.find((s) => s.fetchStatus === 'success');
    const lastSuccessAgeInDays = lastSuccess
      ? Math.floor((Date.now() - lastSuccess.fetchedAt.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const cacheHits = snapshots.filter((s) => s.policyDecision === 'cache_hit').length;
    const forceRefreshCount = snapshots.filter((s) => s.policyDecision === 'force_refresh').length;

    return {
      totalFetches,
      successCount,
      errorCount,
      successRate,
      lastFetchedAt,
      lastSuccessAgeInDays,
      cacheHits,
      forceRefreshCount,
    };
  }

  /**
   * Query snapshots for audit and lineage analysis.
   * Supports filtering by correlation ID, actor, policy decision, fetch status,
   * and stale-fallback flag.
   */
  async listForAudit(
    tenantId: string,
    opts: SnapshotAuditQuery = {},
  ): Promise<BvFetchSnapshotEntity[]> {
    const {
      correlationId,
      actorId,
      policyDecision,
      fetchStatus,
      staleFallbackOnly,
      limit = 50,
    } = opts;

    const qb = this.snapshotRepo
      .createQueryBuilder('s')
      .where('s.tenantId = :tenantId', { tenantId })
      .orderBy('s.fetchedAt', 'DESC')
      .take(limit);

    if (correlationId) {
      qb.andWhere('s.correlationId = :correlationId', { correlationId });
    }
    if (actorId) {
      qb.andWhere('s.actorId = :actorId', { actorId });
    }
    if (policyDecision) {
      qb.andWhere('s.policyDecision = :policyDecision', { policyDecision });
    }
    if (fetchStatus) {
      qb.andWhere('s.fetchStatus = :fetchStatus', { fetchStatus });
    }
    if (staleFallbackOnly) {
      qb.andWhere('s.isStaleFallback = TRUE');
    }

    return qb.getMany();
  }

  /**
   * Find the snapshot that corresponds to a given correlation ID.
   * A single request may produce at most one snapshot per organisation,
   * so this typically returns zero or one result.
   */
  async findByCorrelationId(
    tenantId: string,
    correlationId: string,
  ): Promise<BvFetchSnapshotEntity[]> {
    return this.snapshotRepo.find({
      where: { tenantId, correlationId },
      order: { fetchedAt: 'DESC' },
    });
  }
}
