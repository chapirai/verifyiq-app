import { Body, Controller, ForbiddenException, Get, Param, Post, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequiredScopes } from '../common/decorators/required-scopes.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { ScopeGuard } from '../common/guards/scope.guard';
import { ApiQuotaInterceptor } from '../common/interceptors/api-quota.interceptor';
import { ApiQuotaBucket } from '../common/decorators/api-quota-bucket.decorator';
import { BolagsverketBulkService } from './bolagsverket-bulk.service';
import { RequestBulkEnrichmentDto } from './dto/request-bulk-enrichment.dto';

@Controller('bolagsverket-bulk')
@UseGuards(JwtAuthGuard, ScopeGuard)
@RequiredScopes('companies:read')
@UseInterceptors(ApiQuotaInterceptor)
@ApiQuotaBucket('companies')
export class BolagsverketBulkController {
  constructor(private readonly bulkService: BolagsverketBulkService) {}

  private assertPlatformAdmin(req: Request): void {
    const user = (req.user as { role?: string; tenantId?: string } | undefined) ?? {};
    try {
      this.bulkService.ensureAdminRole(user.role ?? null, user.tenantId ?? null);
    } catch {
      throw new ForbiddenException('Bulk weekly run visibility is restricted to platform admin role.');
    }
  }

  @Post('runs/weekly')
  @RequiredScopes('companies:write')
  triggerWeeklyRun(@Req() req: Request) {
    this.assertPlatformAdmin(req);
    return this.bulkService.enqueueWeeklyIngestion();
  }

  @Get('runs')
  listRuns(@Req() req: Request, @Query('limit') limit?: string) {
    this.assertPlatformAdmin(req);
    return this.bulkService.listWeeklyRuns(Number(limit ?? 52));
  }

  @Get('runs/:runId/files')
  getRunFiles(@Req() req: Request, @Param('runId') runId: string) {
    this.assertPlatformAdmin(req);
    return this.bulkService.getRunFileLinks(runId);
  }

  @Get('ops/dashboard')
  getOpsDashboard(@Req() req: Request) {
    this.assertPlatformAdmin(req);
    return this.bulkService.getOpsDashboardSummary();
  }

  @Get('companies')
  listShallow(
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('seed_state') seedState?: string,
  ) {
    return this.bulkService.listCurrentShallow({
      q,
      page: Number(page ?? 1),
      limit: Number(limit ?? 20),
      seedState,
    });
  }

  @Get('companies/:organisationNumber')
  getShallow(@Param('organisationNumber') organisationNumber: string) {
    return this.bulkService.getShallowByOrg(organisationNumber);
  }

  @Post('companies/enrich')
  @RequiredScopes('companies:write')
  requestEnrichment(
    @TenantId() tenantId: string,
    @CurrentUser('sub') userId: string | undefined,
    @Body() dto: RequestBulkEnrichmentDto,
  ) {
    return this.bulkService.requestDeepEnrichment({
      organisationNumber: dto.organisationNumber,
      tenantId,
      userId: userId ?? null,
      reason: dto.reason,
      priority: dto.priority,
    });
  }
}

