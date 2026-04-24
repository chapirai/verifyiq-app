import { Body, Controller, ForbiddenException, Get, Param, Post, Query, Req, Res, UseGuards, UseInterceptors } from '@nestjs/common';
import type { Request } from 'express';
import type { Response } from 'express';
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
    const enforce = String(process.env.BV_BULK_ENFORCE_PLATFORM_ADMIN ?? 'false').toLowerCase() === 'true';
    if (!enforce) return;
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

  @Post('runs/force')
  @RequiredScopes('companies:write')
  forceRunNow(@Req() req: Request, @Body() body?: { sourceUrl?: string }) {
    this.assertPlatformAdmin(req);
    const allowSync = String(process.env.BV_BULK_FORCE_SYNC_ENABLED ?? 'false').toLowerCase() === 'true';
    if (!allowSync) return this.bulkService.enqueueForcedIngestion(body?.sourceUrl);
    return this.bulkService.runWeeklyIngestion(body?.sourceUrl, true);
  }

  @Post('runs/:runId/replay')
  @RequiredScopes('companies:write')
  replayRunFromArchive(@Req() req: Request, @Param('runId') runId: string) {
    this.assertPlatformAdmin(req);
    return this.bulkService.replayRunFromArchive(runId);
  }

  @Get('runs')
  listRuns(@Req() req: Request, @Query('limit') limit?: string) {
    this.assertPlatformAdmin(req);
    return this.bulkService.listWeeklyRuns(Number(limit ?? 52));
  }

  @Get('runs/queue-status')
  getFileIngestionQueue(@Req() req: Request) {
    this.assertPlatformAdmin(req);
    return this.bulkService.getFileIngestionQueueSnapshot();
  }

  @Get('runs/:runId/files')
  getRunFiles(@Req() req: Request, @Param('runId') runId: string) {
    this.assertPlatformAdmin(req);
    return this.bulkService.getRunFileLinks(runId);
  }

  @Get('ops/dashboard')
  getOpsDashboard(
    @Req() req: Request,
    @Query('week_start') weekStart?: string,
    @Query('tenant_id') tenantId?: string,
    @Query('plan_code') planCode?: string,
    @Query('tenant_page') tenantPage?: string,
    @Query('tenant_limit') tenantLimit?: string,
  ) {
    this.assertPlatformAdmin(req);
    return this.bulkService.getOpsDashboardSummary({
      weekStart,
      tenantId,
      planCode,
      tenantPage: Number(tenantPage ?? 1),
      tenantLimit: Number(tenantLimit ?? 10),
    });
  }

  @Get('ops/runtime-safety')
  getRuntimeSafety(@Req() req: Request) {
    this.assertPlatformAdmin(req);
    return this.bulkService.getRuntimeSafetyReport();
  }

  @Get('ops/dashboard/export.csv')
  async exportOpsDashboardCsv(
    @Req() req: Request,
    @Res() res: Response,
    @Query('type') type: 'tenant_usage' | 'run_deltas' = 'tenant_usage',
    @Query('week_start') weekStart?: string,
    @Query('tenant_id') tenantId?: string,
    @Query('plan_code') planCode?: string,
    @CurrentUser('sub') userId?: string,
    @TenantId() actorTenantId?: string,
  ) {
    this.assertPlatformAdmin(req);
    const csv = await this.bulkService.exportOpsDashboardCsv(
      type,
      { weekStart, tenantId, planCode },
      { actorUserId: userId ?? null, actorTenantId: actorTenantId ?? null },
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="verifyiq-${type}.csv"`);
    res.send(csv);
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

