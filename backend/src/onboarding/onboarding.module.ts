import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { OnboardingController } from './onboarding.controller';
import { OnboardingCaseEntity } from './onboarding-case.entity';
import { OnboardingCaseEventEntity } from './onboarding-case-event.entity';
import { OnboardingService } from './onboarding.service';

@Module({
  imports: [TypeOrmModule.forFeature([OnboardingCaseEntity, OnboardingCaseEventEntity]), AuditModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
