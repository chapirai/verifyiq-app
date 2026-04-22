import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequiredScopes } from '../common/decorators/required-scopes.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { ScopeGuard } from '../common/guards/scope.guard';
import { CreateMonitoringAlertDto } from './dto/create-monitoring-alert.dto';
import { CreateMonitoringSubscriptionDto } from './dto/create-monitoring-subscription.dto';
import { MonitoringService } from './monitoring.service';

@Controller('monitoring')
@UseGuards(JwtAuthGuard, ScopeGuard)
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Post('subscriptions')
  @RequiredScopes('companies:write')
  createSubscription(
    @TenantId() tenantId: string,
    @CurrentUser('sub') actorId: string | undefined,
    @Body() dto: CreateMonitoringSubscriptionDto,
  ) {
    return this.monitoringService.createSubscription(tenantId, dto, actorId ?? null);
  }

  @Get('subscriptions')
  @RequiredScopes('companies:read')
  listSubscriptions(@TenantId() tenantId: string) {
    return this.monitoringService.listSubscriptions(tenantId);
  }

  @Post('alerts')
  @RequiredScopes('companies:write')
  createAlert(
    @TenantId() tenantId: string,
    @CurrentUser('sub') actorId: string | undefined,
    @Body() dto: CreateMonitoringAlertDto,
  ) {
    return this.monitoringService.createAlert(tenantId, dto, actorId ?? null);
  }

  @Get('alerts')
  @RequiredScopes('companies:read')
  listAlerts(@TenantId() tenantId: string) {
    return this.monitoringService.listAlerts(tenantId);
  }

  @Get('alerts/feed-grouped')
  @RequiredScopes('companies:read')
  listGroupedFeed(@TenantId() tenantId: string, @Query('limit') limit?: string) {
    const parsed = Number.parseInt(limit ?? '100', 10);
    const take = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 500) : 100;
    return this.monitoringService.listAlertFeedGrouped(tenantId, take);
  }

  @Patch(':id/acknowledge')
  @RequiredScopes('companies:write')
  acknowledgeAlert(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser('sub') actorId: string | undefined,
  ) {
    return this.monitoringService.acknowledgeAlert(tenantId, id, actorId ?? null);
  }

  @Get('alerts/by-dataset/:family')
  @RequiredScopes('companies:read')
  listAlertsByDataset(@TenantId() tenantId: string, @Param('family') family: string) {
    return this.monitoringService.listAlertsByDatasetFamily(tenantId, family);
  }

  @Get('subscriptions/by-org/:orgNr')
  @RequiredScopes('companies:read')
  listSubscriptionsByOrg(@TenantId() tenantId: string, @Param('orgNr') orgNr: string) {
    return this.monitoringService.listSubscriptionsByOrg(tenantId, orgNr);
  }

  /**
   * POST /monitoring/detect-changes
   * Phase 7: derive alerts from recent change-events + signal deltas.
   */
  @Post('detect-changes')
  @RequiredScopes('companies:write')
  detectChanges(
    @TenantId() tenantId: string,
    @CurrentUser('sub') actorId: string | undefined,
    @Query('lookbackHours') lookbackHours?: string,
  ) {
    const parsed = Number.parseInt(lookbackHours ?? '24', 10);
    const hours = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 24 * 30) : 24;
    return this.monitoringService.detectChangesAndCreateAlerts(tenantId, actorId ?? null, hours);
  }
}
