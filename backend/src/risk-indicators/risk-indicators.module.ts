import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { RiskIndicatorConfigEntity } from './entities/risk-indicator-config.entity';
import { RiskIndicatorResultEntity } from './entities/risk-indicator-result.entity';
import { RiskIndicatorsController } from './risk-indicators.controller';
import { RiskIndicatorsService } from './risk-indicators.service';

@Module({
  imports: [TypeOrmModule.forFeature([RiskIndicatorConfigEntity, RiskIndicatorResultEntity]), AuditModule],
  controllers: [RiskIndicatorsController],
  providers: [RiskIndicatorsService],
  exports: [RiskIndicatorsService],
})
export class RiskIndicatorsModule {}
