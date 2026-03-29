import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditEventEntity, AuditEventType } from './audit-event.entity';
import { AuditLog } from './audit-log.entity';
import { UsageEventEntity } from './usage-event.entity';

// Define the CreateAuditLogInput interface
export interface CreateAuditLogInput {
  tenantId: string;
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, any> | null;
}

export interface CreateAuditEventInput {
  tenantId: string;
  userId: string | null;
  eventType: AuditEventType;
  action: string;
  status: string;
  resourceId?: string | null;
  correlationId?: string | null;
  costImpact?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  retentionExpiresAt?: Date | null;
}

export interface CreateUsageEventInput {
  tenantId: string;
  userId: string | null;
  eventType: AuditEventType;
  action: string;
  status: string;
  resourceId?: string | null;
  correlationId?: string | null;
  costImpact?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  retentionExpiresAt?: Date | null;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    @InjectRepository(AuditEventEntity)
    private readonly auditEventRepo: Repository<AuditEventEntity>,
    @InjectRepository(UsageEventEntity)
    private readonly usageEventRepo: Repository<UsageEventEntity>,
  ) {}

  async log(input: CreateAuditLogInput): Promise<void> {
    try {
      const category = input.action.includes('.') ? input.action.split('.')[0] : input.resourceType;
      const entityId = UUID_REGEX.test(input.resourceId) ? input.resourceId : null;
      const metadata = {
        ...(input.metadata ?? {}),
        ...(entityId ? {} : { resourceId: input.resourceId }),
      };

      const entity = this.auditLogRepo.create({
        tenantId: input.tenantId,
        actorUserId: input.actorId ?? null,
        category,
        action: input.action,
        entityType: input.resourceType,
        entityId,
        metadata,
      });

      await this.auditLogRepo.save(entity);
    } catch (err) {
      this.logger.warn(`[AuditLog] Failed to persist audit log entry: ${err}`);
    }
  }

  async emitAuditEvent(input: CreateAuditEventInput): Promise<AuditEventEntity | null> {
    try {
      const event = this.auditEventRepo.create({
        tenantId: input.tenantId,
        userId: input.userId ?? null,
        eventType: input.eventType,
        action: input.action,
        status: input.status,
        resourceId: input.resourceId ?? null,
        correlationId: input.correlationId ?? null,
        costImpact: input.costImpact ?? {},
        metadata: input.metadata ?? {},
        retentionExpiresAt: input.retentionExpiresAt ?? null,
      });
      return await this.auditEventRepo.save(event);
    } catch (err) {
      this.logger.warn(`[P02-T09] Failed to emit audit event ${input.eventType}: ${err}`);
      return null;
    }
  }

  async emitUsageEvent(input: CreateUsageEventInput): Promise<UsageEventEntity | null> {
    try {
      const event = this.usageEventRepo.create({
        tenantId: input.tenantId,
        userId: input.userId ?? null,
        eventType: input.eventType,
        action: input.action,
        status: input.status,
        resourceId: input.resourceId ?? null,
        correlationId: input.correlationId ?? null,
        costImpact: input.costImpact ?? {},
        metadata: input.metadata ?? {},
        retentionExpiresAt: input.retentionExpiresAt ?? null,
      });
      return await this.usageEventRepo.save(event);
    } catch (err) {
      this.logger.warn(`[P02-T09] Failed to emit usage event ${input.eventType}: ${err}`);
      return null;
    }
  }

  async listForTenant(tenantId: string, limit = 50): Promise<AuditLog[]> {
    const safeLimit = Number.isFinite(limit) ? Math.min(limit, 200) : 50;
    return this.auditLogRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      take: safeLimit,
    });
  }
}
