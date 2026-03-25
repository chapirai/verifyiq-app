import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateRiskIndicatorConfigDto } from './dto/create-risk-indicator-config.dto';
import { EvaluateIndicatorsDto } from './dto/evaluate-indicators.dto';
import { RiskIndicatorsService } from './risk-indicators.service';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

@Controller('risk-indicators')
@UseGuards(JwtAuthGuard)
export class RiskIndicatorsController {
  constructor(private readonly riskIndicatorsService: RiskIndicatorsService) {}

  @Post('configs')
  createConfig(@Body() dto: CreateRiskIndicatorConfigDto, @CurrentUser('id') actorId: string) {
    return this.riskIndicatorsService.createConfig(TENANT_ID, actorId, dto);
  }

  @Get('configs')
  listConfigs(@Query('category') category?: string) {
    return this.riskIndicatorsService.listConfigs(TENANT_ID, category);
  }

  @Post('evaluate')
  evaluateIndicators(@Body() dto: EvaluateIndicatorsDto, @CurrentUser('id') actorId: string) {
    return this.riskIndicatorsService.evaluateIndicators(TENANT_ID, actorId, dto);
  }

  @Get('results')
  listResults(@Query('organisationNumber') organisationNumber?: string) {
    return this.riskIndicatorsService.listResults(TENANT_ID, organisationNumber);
  }
}
