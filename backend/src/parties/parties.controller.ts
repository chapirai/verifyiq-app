import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { PartiesService } from './parties.service';

@Controller('parties')
@UseGuards(JwtAuthGuard)
export class PartiesController {
  constructor(private readonly partiesService: PartiesService) {}

  @Post()
  create(@TenantId() tenantId: string, @CurrentUser('sub') actorId: string | undefined, @Body() dto: any) {
    const ctx: TenantContext = { tenantId, actorId: actorId ?? null };
    return this.partiesService.create(ctx, dto);
  }

  @Get()
  findAll(@TenantId() tenantId: string, @CurrentUser('sub') actorId: string | undefined, @Query() query: any) {
    const ctx: TenantContext = { tenantId, actorId: actorId ?? null };
    return this.partiesService.findAll(ctx, query);
  }

  @Get(':id')
  findOne(@TenantId() tenantId: string, @CurrentUser('sub') actorId: string | undefined, @Param('id') id: string) {
    const ctx: TenantContext = { tenantId, actorId: actorId ?? null };
    return this.partiesService.findOne(ctx, id);
  }

  @Patch(':id')
  update(
    @TenantId() tenantId: string,
    @CurrentUser('sub') actorId: string | undefined,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    const ctx: TenantContext = { tenantId, actorId: actorId ?? null };
    return this.partiesService.update(ctx, id, dto);
  }
}
