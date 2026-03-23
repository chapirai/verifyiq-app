import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { CompaniesService } from './companies.service';

@Controller('companies')
@UseGuards(JwtAuthGuard)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post('lookup')
  lookup(@TenantId() tenantId: string, @CurrentUser('sub') actorId: string | undefined, @Body() dto: any) {
    const ctx: TenantContext = { tenantId, actorId: actorId ?? null };
    return this.companiesService.lookup(ctx, dto);
  }

  @Get()
  findAll(@TenantId() tenantId: string, @CurrentUser('sub') actorId: string | undefined, @Query() query: any) {
    const ctx: TenantContext = { tenantId, actorId: actorId ?? null };
    return this.companiesService.findAll(ctx, query);
  }

  @Get(':id')
  findOne(@TenantId() tenantId: string, @CurrentUser('sub') actorId: string | undefined, @Param('id') id: string) {
    const ctx: TenantContext = { tenantId, actorId: actorId ?? null };
    return this.companiesService.findOne(ctx, id);
  }
}
