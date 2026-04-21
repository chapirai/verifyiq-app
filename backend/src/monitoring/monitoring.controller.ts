import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
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
}
