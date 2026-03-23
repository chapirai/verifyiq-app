import { Body, Controller, Get, Post } from '@nestjs/common';
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
}
