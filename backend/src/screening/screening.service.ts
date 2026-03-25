import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ScreeningService {
  private readonly screenings = new Map<string, any>();
  private readonly queue: any[] = [];

  constructor(private readonly auditService: AuditService) {}

  async executeJob(screeningId: string): Promise<any> {
    const screening = this.screenings.get(screeningId);
    if (!screening) throw new Error('Screening not found');
    screening.status = 'in_progress';
    return screening;
  }

  async run(tenantId: string, actorId: string, dto: any): Promise<any> {
    const screeningId = `screening_${Date.now()}`;
    const screening = { id: screeningId, tenantId, ...dto, status: 'queued', createdAt: new Date() };
    this.screenings.set(screeningId, screening);
    this.queue.push(screening);
    await this.recordScreening(tenantId, actorId, screeningId);
    return screening;
  }

  async listQueue(tenantId: string): Promise<any[]> {
    return this.queue.filter(s => s.tenantId === tenantId);
  }

  async reviewMatch(tenantId: string, actorId: string, matchId: string, dto: any): Promise<any> {
    const screening = Array.from(this.screenings.values()).find(s => s.id === matchId);
    if (!screening) throw new Error('Match not found');
    Object.assign(screening, dto);
    await this.recordScreening(tenantId, actorId, matchId);
    return screening;
  }

  async runLinkedEntityScreening(tenantId: string, actorId: string, dto: {
    organisationNumber: string;
    includeOwners?: boolean;
    includeBoard?: boolean;
    includeSignatories?: boolean;
    screeningSources?: string[]; // ['eu_sanctions', 'un_sanctions', 'ofac', 'uk_sanctions', 'swiss_sanctions', 'pep']
  }): Promise<any> {
    const screeningId = `linked_screening_${Date.now()}`;
    const screening = {
      id: screeningId,
      tenantId,
      type: 'linked_entity',
      organisationNumber: dto.organisationNumber,
      includeOwners: dto.includeOwners ?? true,
      includeBoard: dto.includeBoard ?? true,
      includeSignatories: dto.includeSignatories ?? true,
      screeningSources: dto.screeningSources ?? ['eu_sanctions', 'un_sanctions', 'ofac', 'uk_sanctions', 'swiss_sanctions', 'pep'],
      status: 'queued',
      createdAt: new Date(),
    };
    this.screenings.set(screeningId, screening);
    this.queue.push(screening);
    await this.recordScreening(tenantId, actorId, screeningId, { type: 'linked_entity', organisationNumber: dto.organisationNumber });
    return screening;
  }

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
