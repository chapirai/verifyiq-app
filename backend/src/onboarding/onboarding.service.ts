import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class OnboardingService {
  private readonly cases = new Map<string, any>();

  constructor(private readonly auditService: AuditService) {}

  async create(tenantId: string, actorId: string, dto: any): Promise<any> {
    const caseId = `case_${Date.now()}`;
    const onboardingCase = { id: caseId, tenantId, ...dto, createdAt: new Date() };
    this.cases.set(caseId, onboardingCase);
    await this.recordEvent(tenantId, actorId, caseId);
    return onboardingCase;
  }

  async findAll(tenantId: string, query: any): Promise<any[]> {
    return Array.from(this.cases.values()).filter(c => c.tenantId === tenantId);
  }

  async transition(tenantId: string, actorId: string, id: string, dto: any): Promise<any> {
    const onboardingCase = this.cases.get(id);
    if (!onboardingCase) throw new Error('Case not found');
    Object.assign(onboardingCase, dto);
    await this.recordEvent(tenantId, actorId, id);
    return onboardingCase;
  }

  async decide(tenantId: string, actorId: string, id: string, dto: any): Promise<any> {
    const onboardingCase = this.cases.get(id);
    if (!onboardingCase) throw new Error('Case not found');
    Object.assign(onboardingCase, dto);
    await this.recordEvent(tenantId, actorId, id);
    return onboardingCase;
  }

  async getTimeline(tenantId: string, id: string): Promise<any> {
    const onboardingCase = this.cases.get(id);
    if (!onboardingCase) throw new Error('Case not found');
    return { caseId: id, events: [] };
  }

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
