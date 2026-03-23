import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class OnboardingService {
  constructor(private readonly auditService: AuditService) {}

  async recordEvent(tenantId: string, actorId: string | null, caseId: string, metadata?: Record<string, unknown>) {
    return this.auditService.log({
      tenantId,
      actorId,
      action: 'onboarding.event',
      resourceType: 'onboarding_case',
      resourceId: caseId,
      metadata: metadata ?? null,
    });
  }
}
