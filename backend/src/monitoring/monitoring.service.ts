import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { ChangeType, CompanyChangeEventEntity } from '../companies/entities/company-change-event.entity';
import { CompanySignalEntity } from '../companies/entities/company-signal.entity';
import { CompanyEntity } from '../companies/entities/company.entity';
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
    @InjectRepository(CompanyChangeEventEntity)
    private readonly changeEventRepo: Repository<CompanyChangeEventEntity>,
    @InjectRepository(CompanySignalEntity)
    private readonly signalRepo: Repository<CompanySignalEntity>,
    @InjectRepository(CompanyEntity)
    private readonly companyRepo: Repository<CompanyEntity>,
    private readonly auditService: AuditService,
  ) {}

  private normalizeOrg(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const n = raw.replace(/\D/g, '');
    return n.length === 10 || n.length === 12 ? n : null;
  }

  async createSubscription(tenantId: string, dto: CreateMonitoringSubscriptionDto, actorUserId?: string | null) {
    const subscription = this.subscriptionsRepo.create({
      tenantId,
      partyId: dto.partyId ?? null,
      companyId: dto.companyId ?? null,
      eventTypes: dto.eventTypes,
      subjectType: dto.subjectType ?? 'company',
      organisationNumber: dto.organisationNumber ?? null,
      personnummer: dto.personnummer ?? null,
      datasetFamilies: dto.datasetFamilies ?? [],
      alertConfig: dto.alertConfig ?? {},
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

  listSubscriptions(tenantId: string) {
    return this.subscriptionsRepo.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
  }

  async createAlert(tenantId: string, dto: CreateMonitoringAlertDto, actorUserId?: string | null) {
    const subscription = await this.subscriptionsRepo.findOne({ where: { id: dto.subscriptionId, tenantId } });
    if (!subscription) throw new NotFoundException('Subscription not found');
    const alert = this.alertsRepo.create({
      tenantId: subscription.tenantId,
      subscriptionId: subscription.id,
      alertType: dto.alertType,
      severity: dto.severity,
      title: dto.title,
      description: dto.description ?? null,
      datasetFamily: (dto.payload as { datasetFamily?: string } | undefined)?.datasetFamily ?? null,
      organisationNumber: subscription.organisationNumber ?? null,
      personnummer: subscription.personnummer ?? null,
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

  listAlerts(tenantId: string) {
    return this.alertsRepo.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
  }

  async listAlertFeedGrouped(tenantId: string, limit = 100) {
    const rows = await this.alertsRepo
      .createQueryBuilder('a')
      .select('COALESCE(a.organisationNumber, \'unknown\')', 'organisationNumber')
      .addSelect('a.alertType', 'alertType')
      .addSelect('MAX(a.createdAt)', 'latestCreatedAt')
      .addSelect('COUNT(1)', 'alertCount')
      .addSelect('SUM(CASE WHEN a.isAcknowledged = false THEN 1 ELSE 0 END)', 'openCount')
      .where('a.tenantId = :tenantId', { tenantId })
      .groupBy('COALESCE(a.organisationNumber, \'unknown\')')
      .addGroupBy('a.alertType')
      .orderBy('MAX(a.createdAt)', 'DESC')
      .limit(Math.min(Math.max(limit, 1), 500))
      .getRawMany<{
        organisationNumber: string;
        alertType: string;
        latestCreatedAt: string;
        alertCount: string;
        openCount: string;
      }>();
    return rows.map((r) => ({
      organisationNumber: r.organisationNumber === 'unknown' ? null : r.organisationNumber,
      alertType: r.alertType,
      latestCreatedAt: r.latestCreatedAt,
      alertCount: Number(r.alertCount) || 0,
      openCount: Number(r.openCount) || 0,
    }));
  }

  async acknowledgeAlert(tenantId: string, alertId: string, actorUserId: string | null) {
    const alert = await this.alertsRepo.findOne({ where: { id: alertId, tenantId } });
    if (!alert) throw new NotFoundException('Alert not found');
    alert.isAcknowledged = true;
    alert.acknowledgedAt = new Date();
    alert.acknowledgedByUserId = actorUserId;
    const saved = await this.alertsRepo.save(alert);
    await this.auditService.log({
      tenantId: alert.tenantId,
      actorId: actorUserId ?? null,
      action: 'monitoring.alert.acknowledged',
      resourceType: 'monitoring_alert',
      resourceId: alertId,
      metadata: null,
    });
    return saved;
  }

  async listAlertsByDatasetFamily(tenantId: string, datasetFamily: string) {
    return this.alertsRepo.find({
      where: { tenantId, datasetFamily },
      order: { createdAt: 'DESC' },
    });
  }

  async listSubscriptionsByOrg(tenantId: string, organisationNumber: string) {
    const org = this.normalizeOrg(organisationNumber) ?? organisationNumber;
    return this.subscriptionsRepo.find({
      where: { tenantId, organisationNumber: org },
      order: { createdAt: 'DESC' },
    });
  }

  private alertTypeForAttribute(attr: string): 'ownership.change' | 'board.change' | 'filings.change' | null {
    const a = attr.toLowerCase();
    if (/(owner|ownership|beneficial|verklig|huvudman|control)/.test(a)) return 'ownership.change';
    if (/(officer|director|board|styrelse|firmateckn|funktion[aä]r)/.test(a)) return 'board.change';
    if (/(arende|dokument|document|filing|status|snapshot|registrering)/.test(a)) return 'filings.change';
    return null;
  }

  private severityForAlertType(alertType: string): 'low' | 'medium' | 'high' | 'critical' {
    if (alertType === 'ownership.change') return 'high';
    if (alertType === 'board.change') return 'medium';
    if (alertType === 'signal.change') return 'medium';
    return 'low';
  }

  private async createAlertIfMissing(input: {
    tenantId: string;
    subscriptionId: string;
    organisationNumber: string | null;
    alertType: string;
    title: string;
    description: string;
    payload: Record<string, unknown>;
    datasetFamily: string | null;
    cooldownMinutes: number;
  }) {
    const cooldownSince = new Date(Date.now() - input.cooldownMinutes * 60 * 1000);
    const cooldownExists = await this.alertsRepo
      .createQueryBuilder('a')
      .where('a.tenantId = :tenantId', { tenantId: input.tenantId })
      .andWhere('a.subscriptionId = :subscriptionId', { subscriptionId: input.subscriptionId })
      .andWhere('a.alertType = :alertType', { alertType: input.alertType })
      .andWhere('COALESCE(a.organisationNumber, \'\') = :org', { org: input.organisationNumber ?? '' })
      .andWhere('a.createdAt >= :since', { since: cooldownSince })
      .getOne();
    if (cooldownExists) return { created: false, id: cooldownExists.id, reason: 'cooldown' as const };

    const dedupeKey = String(input.payload['dedupeKey'] ?? '');
    if (dedupeKey) {
      const existing = await this.alertsRepo
        .createQueryBuilder('a')
        .where('a.tenantId = :tenantId', { tenantId: input.tenantId })
        .andWhere('a.subscriptionId = :subscriptionId', { subscriptionId: input.subscriptionId })
        .andWhere('a.alertType = :alertType', { alertType: input.alertType })
        .andWhere("CAST(a.payload AS text) ILIKE :needle", { needle: `%${dedupeKey}%` })
        .getOne();
      if (existing) return { created: false, id: existing.id, reason: 'duplicate' as const };
    }
    const row = this.alertsRepo.create({
      tenantId: input.tenantId,
      subscriptionId: input.subscriptionId,
      alertType: input.alertType,
      severity: this.severityForAlertType(input.alertType),
      title: input.title,
      description: input.description,
      payload: input.payload,
      datasetFamily: input.datasetFamily,
      organisationNumber: input.organisationNumber,
      personnummer: null,
      status: 'open',
    });
    const saved = await this.alertsRepo.save(row);
    return { created: true, id: saved.id, reason: 'created' as const };
  }

  async detectChangesAndCreateAlerts(tenantId: string, actorUserId: string | null, lookbackHours: number) {
    const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);
    const subs = await this.subscriptionsRepo.find({
      where: { tenantId, status: 'active' },
      order: { createdAt: 'DESC' },
    });
    const companySubs = subs.filter((s) => this.normalizeOrg(s.organisationNumber) != null);
    const orgs = Array.from(
      new Set(companySubs.map((s) => this.normalizeOrg(s.organisationNumber)).filter(Boolean) as string[]),
    );
    if (orgs.length === 0) return { scanned_subscriptions: companySubs.length, created_alerts: 0, triggered: [] as string[] };

    const [events, signals, companies] = await Promise.all([
      this.changeEventRepo
        .createQueryBuilder('ce')
        .where('ce.tenantId = :tenantId', { tenantId })
        .andWhere('ce.orgNumber IN (:...orgs)', { orgs })
        .andWhere('ce.createdAt >= :since', { since })
        .andWhere('ce.changeType != :unchanged', { unchanged: ChangeType.UNCHANGED })
        .orderBy('ce.createdAt', 'DESC')
        .getMany(),
      this.signalRepo
        .createQueryBuilder('s')
        .where('s.tenantId = :tenantId', { tenantId })
        .andWhere('s.organisationNumber IN (:...orgs)', { orgs })
        .orderBy('s.organisationNumber', 'ASC')
        .addOrderBy('s.signalType', 'ASC')
        .addOrderBy('s.computedAt', 'DESC')
        .getMany(),
      this.companyRepo.find({
        where: { tenantId, organisationNumber: In(orgs) } as any,
        select: ['organisationNumber', 'legalName'],
      }),
    ]);

    const companyNameByOrg = new Map(companies.map((c) => [c.organisationNumber, c.legalName]));
    const eventsByOrg = new Map<string, CompanyChangeEventEntity[]>();
    for (const e of events) {
      const arr = eventsByOrg.get(e.orgNumber) ?? [];
      arr.push(e);
      eventsByOrg.set(e.orgNumber, arr);
    }
    const signalByOrgType = new Map<string, CompanySignalEntity[]>();
    for (const s of signals) {
      const key = `${s.organisationNumber}::${s.signalType}`;
      const arr = signalByOrgType.get(key) ?? [];
      arr.push(s);
      signalByOrgType.set(key, arr);
    }

    let created = 0;
    const triggered = new Set<string>();
    for (const sub of companySubs) {
      const org = this.normalizeOrg(sub.organisationNumber);
      if (!org) continue;
      const eventTypes = new Set((sub.eventTypes ?? []).map((x) => x.toLowerCase()));
      const cooldownMinutes = Number((sub.alertConfig as { cooldownMinutes?: number } | null)?.cooldownMinutes ?? 60);
      const orgEvents = eventsByOrg.get(org) ?? [];
      for (const evt of orgEvents) {
        const mapped = this.alertTypeForAttribute(evt.attributeName);
        if (!mapped || !eventTypes.has(mapped)) continue;
        const dedupeKey = `${mapped}:${evt.id}`;
        const res = await this.createAlertIfMissing({
          tenantId,
          subscriptionId: sub.id,
          organisationNumber: org,
          alertType: mapped,
          title: `${mapped.replace('.', ' ')} detected`,
          description: `${companyNameByOrg.get(org) ?? org}: ${evt.attributeName} (${evt.changeType})`,
          payload: {
            dedupeKey,
            changeEventId: evt.id,
            attributeName: evt.attributeName,
            changeType: evt.changeType,
            oldValue: evt.oldValue,
            newValue: evt.newValue,
            createdAt: evt.createdAt,
          },
          datasetFamily: mapped === 'filings.change' ? 'filings' : mapped === 'ownership.change' ? 'ownership' : 'board',
          cooldownMinutes,
        });
        if (res.created) {
          created += 1;
          triggered.add(mapped);
        }
      }

      if (eventTypes.has('signal.change')) {
        for (const [key, rows] of signalByOrgType.entries()) {
          if (!key.startsWith(`${org}::`)) continue;
          if (rows.length < 2) continue;
          const latest = rows[0];
          const prev = rows[1];
          const latestN = latest.score != null ? Number(latest.score) : null;
          const prevN = prev.score != null ? Number(prev.score) : null;
          if (latestN == null || prevN == null) continue;
          const delta = latestN - prevN;
          const threshold = Number((sub.alertConfig as { signalDeltaMin?: number } | null)?.signalDeltaMin ?? 10);
          if (Math.abs(delta) < threshold) continue;
          const dedupeKey = `signal.change:${latest.id}`;
          const res = await this.createAlertIfMissing({
            tenantId,
            subscriptionId: sub.id,
            organisationNumber: org,
            alertType: 'signal.change',
            title: `Signal moved: ${latest.signalType}`,
            description: `${companyNameByOrg.get(org) ?? org}: ${latest.signalType} moved ${delta > 0 ? '+' : ''}${delta.toFixed(1)}.`,
            payload: {
              dedupeKey,
              signalType: latest.signalType,
              latestScore: latestN,
              previousScore: prevN,
              delta,
              latestSignalId: latest.id,
              previousSignalId: prev.id,
            },
            datasetFamily: 'signals',
            cooldownMinutes,
          });
          if (res.created) {
            created += 1;
            triggered.add('signal.change');
          }
        }
      }
    }

    await this.auditService.log({
      tenantId,
      actorId: actorUserId ?? null,
      action: 'monitoring.detect_changes.run',
      resourceType: 'monitoring',
      resourceId: `window:${lookbackHours}h`,
      metadata: {
        scanned_subscriptions: companySubs.length,
        created_alerts: created,
        lookback_hours: lookbackHours,
        triggered_event_types: [...triggered],
      },
    });

    return {
      scanned_subscriptions: companySubs.length,
      created_alerts: created,
      lookback_hours: lookbackHours,
      triggered_event_types: [...triggered],
    };
  }
}
