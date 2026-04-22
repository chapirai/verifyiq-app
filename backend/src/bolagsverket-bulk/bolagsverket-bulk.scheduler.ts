import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { BolagsverketBulkService } from './bolagsverket-bulk.service';

@Injectable()
export class BolagsverketBulkScheduler {
  constructor(
    private readonly config: ConfigService,
    private readonly bulkService: BolagsverketBulkService,
  ) {}

  @Cron('0 3 * * 1')
  async scheduleWeeklyBulkRun(): Promise<void> {
    const enabled = String(this.config.get('BV_BULK_WEEKLY_ENABLED', 'true')).toLowerCase() === 'true';
    if (!enabled) return;
    await this.bulkService.enqueueWeeklyIngestion();
  }
}

