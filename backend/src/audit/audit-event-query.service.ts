import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditEventEntity, AuditEventType } from './audit-event.entity';

// ── Query option types ────────────────────────────────────────────────────────

/**
 * P02-T09: Filter options for audit event queries.
 */
export interface AuditEventQuery {
  userId?: string;
  eventType?: AuditEventType;
  resourceId?: string;
  correlationId?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * P02-T09: Read-only query service for audit events.
 *
 * All methods are tenant-scoped to preserve isolation.
 */
@Injectable()
export class AuditEventQueryService {
  constructor(
    @InjectRepository(AuditEventEntity)
    private readonly auditEventRepo: Repository<AuditEventEntity>,
  ) {}

  async getById(tenantId: string, id: string): Promise<AuditEventEntity | null> {
    return this.auditEventRepo.findOne({ where: { id, tenantId } });
  }

  async listForAudit(tenantId: string, opts: AuditEventQuery = {}): Promise<AuditEventEntity[]> {
    const {
      userId,
      eventType,
      resourceId,
      correlationId,
      status,
      fromDate,
      toDate,
      limit,
    } = opts;

    const qb = this.auditEventRepo
      .createQueryBuilder('e')
      .where('e.tenantId = :tenantId', { tenantId })
      .orderBy('e.createdAt', 'DESC')
      .take(Math.min(limit ?? 50, 200));

    if (userId) qb.andWhere('e.userId = :userId', { userId });
    if (eventType) qb.andWhere('e.eventType = :eventType', { eventType });
    if (resourceId) qb.andWhere('e.resourceId = :resourceId', { resourceId });
    if (correlationId) qb.andWhere('e.correlationId = :correlationId', { correlationId });
    if (status) qb.andWhere('e.status = :status', { status });
    if (fromDate) qb.andWhere('e.createdAt >= :fromDate', { fromDate: new Date(fromDate) });
    if (toDate) qb.andWhere('e.createdAt <= :toDate', { toDate: new Date(toDate) });

    return qb.getMany();
  }
}
