import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ScreeningService {
  constructor(private readonly auditService: AuditService) {}

  async recordScreening(tenantId: string, actorId: string | null, screeningId: string, metadata?: Record<string, unknown>) {
    return this.auditService.log({
      tenantId,
      actorId,
      action: 'screening.run',
      resourceType: 'screening',
      resourceId: screeningId,
      metadata: metadata ?? null,
    });
  }
}
