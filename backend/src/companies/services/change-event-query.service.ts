import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChangeType, CompanyChangeEventEntity } from '../entities/company-change-event.entity';

// ── Query option types ────────────────────────────────────────────────────────

/**
 * P02-T08: Filter options for change event queries.
 */
export interface ChangeEventQuery {
  /** Filter by exact attribute name. */
  attributeName?: string;
  /** Filter by change type. */
  changeType?: ChangeType;
  /** Only return events created on or after this ISO 8601 timestamp. */
  fromDate?: string;
  /** Only return events created on or before this ISO 8601 timestamp. */
  toDate?: string;
  /** Maximum number of records to return (default: 50, max: 200). */
  limit?: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * P02-T08: Read-only query service for company change events.
 *
 * All methods are tenant-scoped: `tenantId` is always included in the WHERE
 * clause to enforce tenant isolation.
 */
@Injectable()
export class ChangeEventQueryService {
  constructor(
    @InjectRepository(CompanyChangeEventEntity)
    private readonly changeEventRepo: Repository<CompanyChangeEventEntity>,
  ) {}

  // ── Public API ───────────────────────────────────────────────────────────────

  /**
   * Retrieve a single change event by ID, scoped to the tenant.
   * Returns null when not found or when the record belongs to a different tenant.
   */
  async getById(tenantId: string, id: string): Promise<CompanyChangeEventEntity | null> {
    return this.changeEventRepo.findOne({ where: { id, tenantId } });
  }

  /**
   * List all change events for a given company (orgNumber) within a tenant,
   * most-recent first.  Optional filters for attribute name, change type, and
   * date range narrow the result set.
   */
  async findByOrgNumber(
    tenantId: string,
    orgNumber: string,
    query: ChangeEventQuery = {},
  ): Promise<CompanyChangeEventEntity[]> {
    const limit = Math.min(query.limit ?? 50, 200);

    const qb = this.changeEventRepo
      .createQueryBuilder('ce')
      .where('ce.tenantId = :tenantId', { tenantId })
      .andWhere('ce.orgNumber = :orgNumber', { orgNumber })
      .orderBy('ce.createdAt', 'DESC')
      .take(limit);

    if (query.attributeName) {
      qb.andWhere('ce.attributeName = :attributeName', { attributeName: query.attributeName });
    }
    if (query.changeType) {
      qb.andWhere('ce.changeType = :changeType', { changeType: query.changeType });
    }
    if (query.fromDate) {
      qb.andWhere('ce.createdAt >= :fromDate', { fromDate: new Date(query.fromDate) });
    }
    if (query.toDate) {
      qb.andWhere('ce.createdAt <= :toDate', { toDate: new Date(query.toDate) });
    }

    return qb.getMany();
  }

  /**
   * List all change events produced for a specific snapshot comparison
   * (identified by the after-snapshot ID), scoped to the tenant.
   */
  async findBySnapshotAfter(
    tenantId: string,
    snapshotIdAfter: string,
    limit = 200,
  ): Promise<CompanyChangeEventEntity[]> {
    return this.changeEventRepo.find({
      where: { tenantId, snapshotIdAfter },
      order: { attributeName: 'ASC' },
      take: Math.min(limit, 200),
    });
  }

  /**
   * List all change events for a specific attribute across all companies in
   * the tenant, most-recent first.
   */
  async findByAttribute(
    tenantId: string,
    attributeName: string,
    query: Pick<ChangeEventQuery, 'fromDate' | 'toDate' | 'limit'> = {},
  ): Promise<CompanyChangeEventEntity[]> {
    const limit = Math.min(query.limit ?? 50, 200);

    const qb = this.changeEventRepo
      .createQueryBuilder('ce')
      .where('ce.tenantId = :tenantId', { tenantId })
      .andWhere('ce.attributeName = :attributeName', { attributeName })
      .orderBy('ce.createdAt', 'DESC')
      .take(limit);

    if (query.fromDate) {
      qb.andWhere('ce.createdAt >= :fromDate', { fromDate: new Date(query.fromDate) });
    }
    if (query.toDate) {
      qb.andWhere('ce.createdAt <= :toDate', { toDate: new Date(query.toDate) });
    }

    return qb.getMany();
  }

  /**
   * List all change events of a specific change type within a tenant,
   * optionally filtered by date range.
   */
  async findByChangeType(
    tenantId: string,
    changeType: ChangeType,
    query: Pick<ChangeEventQuery, 'fromDate' | 'toDate' | 'limit'> = {},
  ): Promise<CompanyChangeEventEntity[]> {
    const limit = Math.min(query.limit ?? 50, 200);

    const qb = this.changeEventRepo
      .createQueryBuilder('ce')
      .where('ce.tenantId = :tenantId', { tenantId })
      .andWhere('ce.changeType = :changeType', { changeType })
      .orderBy('ce.createdAt', 'DESC')
      .take(limit);

    if (query.fromDate) {
      qb.andWhere('ce.createdAt >= :fromDate', { fromDate: new Date(query.fromDate) });
    }
    if (query.toDate) {
      qb.andWhere('ce.createdAt <= :toDate', { toDate: new Date(query.toDate) });
    }

    return qb.getMany();
  }

  /**
   * Return a per-change-type count summary for a company within an optional
   * time range.  Useful for quick audit dashboards.
   */
  async getChangeTypeSummary(
    tenantId: string,
    orgNumber: string,
    query: Pick<ChangeEventQuery, 'fromDate' | 'toDate'> = {},
  ): Promise<Record<string, number>> {
    const qb = this.changeEventRepo
      .createQueryBuilder('ce')
      .select('ce.changeType', 'changeType')
      .addSelect('COUNT(*)', 'count')
      .where('ce.tenantId = :tenantId', { tenantId })
      .andWhere('ce.orgNumber = :orgNumber', { orgNumber })
      .groupBy('ce.changeType');

    if (query.fromDate) {
      qb.andWhere('ce.createdAt >= :fromDate', { fromDate: new Date(query.fromDate) });
    }
    if (query.toDate) {
      qb.andWhere('ce.createdAt <= :toDate', { toDate: new Date(query.toDate) });
    }

    const rows = await qb.getRawMany<{ changeType: string; count: string }>();
    return Object.fromEntries(rows.map((r) => [r.changeType, parseInt(r.count, 10)]));
  }
}
