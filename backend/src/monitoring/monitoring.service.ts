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

  async acknowledgeAlert(alertId: string, actorUserId: string) {
    const alert = await this.alertsRepo.findOne({ where: { id: alertId } });
    if (!alert) throw new NotFoundException('Alert not found');
    alert.isAcknowledged = true;
    alert.acknowledgedAt = new Date();
    alert.acknowledgedByUserId = actorUserId;
    const saved = await this.alertsRepo.save(alert);
    await this.auditService.log({
      tenantId: alert.tenantId,
      actorId: actorUserId,
      action: 'monitoring.alert.acknowledged',
      resourceType: 'monitoring_alert',
      resourceId: alertId,
      metadata: null,
    });
    return saved;
  }

  async listAlertsByDatasetFamily(tenantId: string, datasetFamily: string) {
    return this.alertsRepo.find({
      where: { tenantId, datasetFamily } as any,
      order: { createdAt: 'DESC' },
    });
  }

  async listSubscriptionsByOrg(tenantId: string, organisationNumber: string) {
    return this.subscriptionsRepo.find({
      where: { tenantId, organisationNumber } as any,
      order: { createdAt: 'DESC' },
    });
  }
}
