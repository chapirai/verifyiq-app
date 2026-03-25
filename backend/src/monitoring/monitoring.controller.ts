import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateMonitoringAlertDto } from './dto/create-monitoring-alert.dto';
import { CreateMonitoringSubscriptionDto } from './dto/create-monitoring-subscription.dto';
import { MonitoringService } from './monitoring.service';

@Controller('monitoring')
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Post('subscriptions')
  createSubscription(@Body() dto: CreateMonitoringSubscriptionDto) {
    return this.monitoringService.createSubscription(dto);
  }

  @Get('subscriptions')
  listSubscriptions() {
    return this.monitoringService.listSubscriptions();
  }

  @Post('alerts')
  createAlert(@Body() dto: CreateMonitoringAlertDto) {
    return this.monitoringService.createAlert(dto);
  }

  @Get('alerts')
  listAlerts() {
    return this.monitoringService.listAlerts();
  }

  @Patch(':id/acknowledge')
  acknowledgeAlert(@Param('id') id: string, @CurrentUser('id') actorId: string) {
    return this.monitoringService.acknowledgeAlert(id, actorId);
  }

  @Get('alerts/by-dataset/:family')
  listAlertsByDataset(@Param('family') family: string) {
    const tenantId = '00000000-0000-0000-0000-000000000001';
    return this.monitoringService.listAlertsByDatasetFamily(tenantId, family);
  }

  @Get('subscriptions/by-org/:orgNr')
  listSubscriptionsByOrg(@Param('orgNr') orgNr: string) {
    const tenantId = '00000000-0000-0000-0000-000000000001';
    return this.monitoringService.listSubscriptionsByOrg(tenantId, orgNr);
  }
}
