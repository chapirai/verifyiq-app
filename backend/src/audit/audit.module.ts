import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditLog } from './audit-log.entity';
import { AuditEventEntity } from './audit-event.entity';
import { UsageEventEntity } from './usage-event.entity';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AuditEventQueryService } from './audit-event-query.service';
import { UsageEventQueryService } from './usage-event-query.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog, AuditEventEntity, UsageEventEntity])],
  controllers: [AuditController],
  providers: [AuditService, AuditEventQueryService, UsageEventQueryService],
  exports: [AuditService, AuditEventQueryService, UsageEventQueryService, TypeOrmModule],
})
export class AuditModule {}
