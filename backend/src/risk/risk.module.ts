import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyEntity } from '../companies/entities/company.entity';
import { PartyEntity } from '../parties/party.entity';
import { ScreeningMatchEntity } from '../screening/screening-match.entity';
import { RiskController } from './risk.controller';
import { RiskAssessmentEntity } from './risk-assessment.entity';
import { RiskService } from './risk.service';

@Module({
  imports: [TypeOrmModule.forFeature([RiskAssessmentEntity, PartyEntity, CompanyEntity, ScreeningMatchEntity])],
  controllers: [RiskController],
  providers: [RiskService],
  exports: [RiskService],
})
export class RiskModule {}
