import { Controller, Get, Query } from '@nestjs/common';
import { AuditService } from './audit.service';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async list(
    @Query('tenantId') tenantId: string,
    @Query('limit') limit?: string,
  ): Promise<any[]> {
    return this.auditService.listForTenant(tenantId, Number(limit ?? 50));
  }
}