import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { CreateMonitoringAlertDto } from './dto/create-monitoring-alert.dto';
import { CreateMonitoringSubscriptionDto } from './dto/create-monitoring-subscription.dto';
import { MonitoringAlertEntity } from './monitoring-alert.entity';
import { MonitoringSubscriptionEntity } from './monitoring-subscription.entity';

@Injectable()
export class MonitoringService {
  constructor(
    @InjectRepository(MonitoringSubscriptionEntity)
    private readonly subscriptionsRepo: Repository<MonitoringSubscriptionEntity>,
    @InjectRepository(MonitoringAlertEntity)
    private readonly alertsRepo: Repository<MonitoringAlertEntity>,
    private readonly auditService: AuditService,
  ) {}

  async createSubscription(dto: CreateMonitoringSubscriptionDto, actorUserId?: string) {
    const tenantId = '00000000-0000-0000-0000-000000000001';
    const subscription = this.subscriptionsRepo.create({
      tenantId,
      partyId: dto.partyId ?? null,
      companyId: dto.companyId ?? null,
      eventTypes: dto.eventTypes,
      createdByUserId: actorUserId ?? null,
    });
    const saved = await this.subscriptionsRepo.save(subscription);
    await this.auditService.log({
      tenantId,
      actorId: actorUserId ?? null,
      action: 'monitoring.subscription.created',
      resourceType: 'monitoring_subscription',
      resourceId: saved.id,
      metadata: dto,
    });
    return saved;
  }

  listSubscriptions() {
    return this.subscriptionsRepo.find({ order: { createdAt: 'DESC' } });
  }

  async createAlert(dto: CreateMonitoringAlertDto, actorUserId?: string) {
    const subscription = await this.subscriptionsRepo.findOne({ where: { id: dto.subscriptionId } });
    if (!subscription) throw new NotFoundException('Subscription not found');
    const alert = this.alertsRepo.create({
      tenantId: subscription.tenantId,
      subscriptionId: subscription.id,
      alertType: dto.alertType,
      severity: dto.severity,
      title: dto.title,
      description: dto.description ?? null,
      payload: dto.payload ?? {},
    });
    const saved = await this.alertsRepo.save(alert);
    await this.auditService.log({
      tenantId: subscription.tenantId,
      actorId: actorUserId ?? null,
      action: 'monitoring.alert.created',
      resourceType: 'monitoring_alert',
      resourceId: saved.id,
      metadata: dto,
    });
    return saved;
  }

  listAlerts() {
    return this.alertsRepo.find({ order: { createdAt: 'DESC' } });
  }
}
