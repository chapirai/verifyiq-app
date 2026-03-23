import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { PartyEntity } from '../parties/party.entity';
import { MockScreeningProvider } from './providers/mock-screening.provider';
import { ScreeningProcessor } from './processors/screening.processor';
import { ScreeningController } from './screening.controller';
import { ScreeningJobEntity } from './screening-job.entity';
import { ScreeningMatchEntity } from './screening-match.entity';
import { ScreeningService } from './screening.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ScreeningJobEntity, ScreeningMatchEntity, PartyEntity]),
    BullModule.registerQueue({ name: 'screening' }),
    AuditModule,
  ],
  controllers: [ScreeningController],
  providers: [ScreeningService, MockScreeningProvider, ScreeningProcessor],
  exports: [ScreeningService],
})
export class ScreeningModule {}
