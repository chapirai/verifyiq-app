import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LineageMetadataEntity, TriggerType } from '../entities/lineage-metadata.entity';

// ── Query option types ────────────────────────────────────────────────────────

/**
 * P02-T06: Filter options for lineage audit queries.
 */
export interface LineageAuditQuery {
  /** Filter by exact correlation ID. */
  correlationId?: string;
  /** Filter by exact user ID. */
  userId?: string;
  /** Filter by trigger type. */
  triggerType?: TriggerType;
  /** Filter by source endpoint (substring match, case-insensitive). */
  sourceEndpoint?: string;
  /** Only return records created on or after this ISO timestamp. */
  fromDate?: string;
  /** Only return records created on or before this ISO timestamp. */
  toDate?: string;
  /** Maximum number of records to return (default: 50, max: 200). */
  limit?: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * P02-T06: Read-only query service for lineage metadata.
 *
 * All methods are tenant-scoped: the tenantId parameter is always included in
 * the WHERE clause to enforce tenant isolation.
 */
@Injectable()
export class LineageQueryService {
  constructor(
    @InjectRepository(LineageMetadataEntity)
    private readonly lineageRepo: Repository<LineageMetadataEntity>,
  ) {}

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Retrieve a single lineage record by ID, scoped to the tenant.
   * Returns null when not found or when the record belongs to a different tenant.
   */
  async getById(tenantId: string, id: string): Promise<LineageMetadataEntity | null> {
    return this.lineageRepo.findOne({ where: { id, tenantId } });
  }

  /**
   * Find all lineage records for a given correlation ID within a tenant.
   * A single request chain may produce multiple records across services.
   */
  async findByCorrelationId(
    tenantId: string,
    correlationId: string,
  ): Promise<LineageMetadataEntity[]> {
    return this.lineageRepo.find({
      where: { tenantId, correlationId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * List lineage records for a user within a tenant (most-recent first).
   */
  async findByUserId(
    tenantId: string,
    userId: string,
    limit = 50,
  ): Promise<LineageMetadataEntity[]> {
    return this.lineageRepo.find({
      where: { tenantId, userId },
      order: { createdAt: 'DESC' },
      take: Math.min(limit, 200),
    });
  }

  /**
   * Flexible audit/lineage query with optional filters.
   *
   * Results are ordered most-recent first.  Limit is capped at 200 to
   * protect against accidentally large result sets.
   */
  async listForAudit(
    tenantId: string,
    opts: LineageAuditQuery = {},
  ): Promise<LineageMetadataEntity[]> {
    const {
      correlationId,
      userId,
      triggerType,
      sourceEndpoint,
      fromDate,
      toDate,
      limit = 50,
    } = opts;

    const qb = this.lineageRepo
      .createQueryBuilder('l')
      .where('l.tenantId = :tenantId', { tenantId })
      .orderBy('l.createdAt', 'DESC')
      .take(Math.min(limit, 200));

    if (correlationId) {
      qb.andWhere('l.correlationId = :correlationId', { correlationId });
    }
    if (userId) {
      qb.andWhere('l.userId = :userId', { userId });
    }
    if (triggerType) {
      qb.andWhere('l.triggerType = :triggerType', { triggerType });
    }
    if (sourceEndpoint) {
      qb.andWhere('l.sourceEndpoint ILIKE :sourceEndpoint', {
        sourceEndpoint: `%${sourceEndpoint}%`,
      });
    }
    if (fromDate) {
      qb.andWhere('l.createdAt >= :fromDate', { fromDate: new Date(fromDate) });
    }
    if (toDate) {
      qb.andWhere('l.createdAt <= :toDate', { toDate: new Date(toDate) });
    }

    return qb.getMany();
  }

  /**
   * Return per-triggerType counts for a tenant within an optional date range.
   * Useful for cost analysis and operation-volume dashboards.
   */
  async getTriggerTypeStats(
    tenantId: string,
    opts: { fromDate?: string; toDate?: string } = {},
  ): Promise<Array<{ triggerType: string; count: number }>> {
    const qb = this.lineageRepo
      .createQueryBuilder('l')
      .select('l.triggerType', 'triggerType')
      .addSelect('COUNT(l.id)', 'count')
      .where('l.tenantId = :tenantId', { tenantId })
      .groupBy('l.triggerType');

    if (opts.fromDate) {
      qb.andWhere('l.createdAt >= :fromDate', { fromDate: new Date(opts.fromDate) });
    }
    if (opts.toDate) {
      qb.andWhere('l.createdAt <= :toDate', { toDate: new Date(opts.toDate) });
    }

    const rows = await qb.getRawMany<{ triggerType: string; count: string }>();
    return rows.map((r) => ({ triggerType: r.triggerType, count: parseInt(r.count, 10) }));
  }
}
