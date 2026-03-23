import { Injectable, Logger } from '@nestjs/common';

export interface CreateAuditLogInput {
  tenantId: string;
  actorId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  async log(input: CreateAuditLogInput): Promise<CreateAuditLogInput & { id: string; createdAt: string }> {
    const record = {
      id: `audit_${Date.now()}`,
      createdAt: new Date().toISOString(),
      ...input,
    };

    this.logger.log(JSON.stringify(record));
    return record;
  }
}
