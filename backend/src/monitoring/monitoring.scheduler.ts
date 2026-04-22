import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MonitoringSubscriptionEntity } from './monitoring-subscription.entity';
import { MonitoringService } from './monitoring.service';

@Injectable()
export class MonitoringScheduler {
  private readonly logger = new Logger(MonitoringScheduler.name);
  private readonly intervalMs: number;
  private readonly lookbackHours: number;
  private readonly enabled: boolean;
  private running = false;
  private lastRunAt = 0;

  constructor(
    private readonly monitoringService: MonitoringService,
    private readonly config: ConfigService,
    @InjectRepository(MonitoringSubscriptionEntity)
    private readonly subscriptionsRepo: Repository<MonitoringSubscriptionEntity>,
  ) {
    this.intervalMs = Number(this.config.get<string>('MONITORING_DETECT_INTERVAL_MS') ?? 300_000);
    this.lookbackHours = Number(this.config.get<string>('MONITORING_DETECT_LOOKBACK_HOURS') ?? 24);
    this.enabled = String(this.config.get<string>('MONITORING_DETECT_ENABLED') ?? 'true') !== 'false';
  }

  @Interval(60_000)
  async runDetectionTick() {
    if (!this.enabled) return;
    if (this.running) return;

    const now = Date.now();
    if (now - this.lastRunAt < this.intervalMs) return;
    this.lastRunAt = now;

    this.running = true;
    try {
      const tenantRows = await this.subscriptionsRepo
        .createQueryBuilder('s')
        .select('DISTINCT s.tenantId', 'tenantId')
        .where('s.status = :status', { status: 'active' })
        .getRawMany<{ tenantId: string }>();
      for (const row of tenantRows) {
        try {
          await this.monitoringService.detectChangesAndCreateAlerts(row.tenantId, null, this.lookbackHours);
        } catch (err) {
          this.logger.warn(`Detection failed for tenant ${row.tenantId}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    } finally {
      this.running = false;
    }
  }
}

