import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';

@Injectable()
export class CompaniesService {
  private readonly companies = new Map<string, any>();

  constructor(private readonly auditService: AuditService) {}

  async lookup(ctx: TenantContext, dto: any) {
    const id = dto?.id ?? dto?.identitetsbeteckning ?? `company_${Date.now()}`;
    const saved = {
      id,
      tenantId: ctx.tenantId,
      organisationNumber: dto?.identitetsbeteckning ?? null,
      name: dto?.name ?? dto?.namn ?? 'Unknown company',
      raw: dto,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.companies.set(id, saved);

    await this.auditService.log({
      tenantId: ctx.tenantId,
      actorId: ctx.actorId ?? null,
      action: 'company.lookup',
      resourceType: 'company',
      resourceId: saved.id,
      metadata: {
        organisationNumber: saved.organisationNumber,
      },
    });

    return saved;
  }

  async findAll(ctx: TenantContext, query: any) {
    const items = Array.from(this.companies.values()).filter((company) => company.tenantId === ctx.tenantId);

    if (query?.organisationNumber) {
      return items.filter((company) => company.organisationNumber === query.organisationNumber);
    }

    return items;
  }

  async findOne(ctx: TenantContext, id: string) {
    const company = this.companies.get(id);
    if (!company || company.tenantId !== ctx.tenantId) {
      throw new NotFoundException('Company not found');
    }

    return company;
  }
}
