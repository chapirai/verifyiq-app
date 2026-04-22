import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { CompanyChangeEventEntity } from '../companies/entities/company-change-event.entity';
import { CompanySignalEntity } from '../companies/entities/company-signal.entity';
import { CompanyEntity } from '../companies/entities/company.entity';
import { MonitoringAlertEntity } from './monitoring-alert.entity';
import { MonitoringSubscriptionEntity } from './monitoring-subscription.entity';
import { MonitoringController } from './monitoring.controller';
import { MonitoringScheduler } from './monitoring.scheduler';
import { MonitoringService } from './monitoring.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MonitoringSubscriptionEntity,
      MonitoringAlertEntity,
      CompanyChangeEventEntity,
      CompanySignalEntity,
      CompanyEntity,
    ]),
    AuditModule,
  ],
  controllers: [MonitoringController],
  providers: [MonitoringService, MonitoringScheduler],
  exports: [MonitoringService],
})
export class MonitoringModule {}
