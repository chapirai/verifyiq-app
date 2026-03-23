import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class UsersService {
  private readonly users = new Map<string, any>();

  constructor(private readonly auditService: AuditService) {}

  async create(dto: any) {
    const user = {
      id: dto?.id ?? `user_${Date.now()}`,
      tenantId: dto?.tenantId ?? 'demo-tenant',
      email: dto?.email ?? 'unknown@example.com',
      role: dto?.role ?? 'user',
      ...dto,
    };

    this.users.set(user.id, user);

    await this.auditService.log({
      tenantId: user.tenantId,
      actorId: dto?.actorId ?? null,
      action: 'user.create',
      resourceType: 'user',
      resourceId: user.id,
      metadata: { email: user.email, role: user.role },
    });

    return user;
  }

  async update(id: string, dto: any) {
    const existing = this.users.get(id) ?? { id, tenantId: dto?.tenantId ?? 'demo-tenant' };
    const user = {
      ...existing,
      ...dto,
      id,
    };

    this.users.set(id, user);

    await this.auditService.log({
      tenantId: user.tenantId,
      actorId: dto?.actorId ?? null,
      action: 'user.update',
      resourceType: 'user',
      resourceId: user.id,
      metadata: { updatedFields: Object.keys(dto ?? {}) },
    });

    return user;
  }
}
