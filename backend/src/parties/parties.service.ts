import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';

@Injectable()
export class PartiesService {
  private readonly parties = new Map<string, any>();

  constructor(private readonly auditService: AuditService) {}

  async create(ctx: TenantContext, dto: any) {
    const saved = {
      id: dto?.id ?? `party_${Date.now()}`,
      tenantId: ctx.tenantId,
      type: dto?.type ?? 'legal_entity',
      name: dto?.name ?? 'Unnamed party',
      ...dto,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.parties.set(saved.id, saved);

    await this.auditService.log({
      tenantId: ctx.tenantId,
      actorId: ctx.actorId ?? null,
      action: 'party.create',
      resourceType: 'party',
      resourceId: saved.id,
      metadata: { type: saved.type },
    });

    return saved;
  }

  async findAll(ctx: TenantContext, query: any) {
    const items = Array.from(this.parties.values()).filter((party) => party.tenantId === ctx.tenantId);
    if (query?.type) {
      return items.filter((party) => party.type === query.type);
    }
    return items;
  }

  async findOne(ctx: TenantContext, id: string) {
    const saved = this.parties.get(id);
    if (!saved || saved.tenantId !== ctx.tenantId) {
      throw new NotFoundException('Party not found');
    }
    return saved;
  }

  async update(ctx: TenantContext, id: string, dto: any) {
    const existing = await this.findOne(ctx, id);
    const saved = {
      ...existing,
      ...dto,
      updatedAt: new Date().toISOString(),
    };

    this.parties.set(id, saved);

    await this.auditService.log({
      tenantId: ctx.tenantId,
      actorId: ctx.actorId ?? null,
      action: 'party.update',
      resourceType: 'party',
      resourceId: saved.id,
      metadata: { updatedFields: Object.keys(dto ?? {}) },
    });

    return saved;
  }
}
