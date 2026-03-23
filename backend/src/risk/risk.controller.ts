import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { AssessRiskDto } from './dto/assess-risk.dto';
import { RiskService } from './risk.service';

@Controller('risk')
export class RiskController {
  constructor(private readonly riskService: RiskService) {}

  @Post('assess')
  assess(@Req() req: any, @Body() dto: AssessRiskDto) {
    return this.riskService.assess(req.user.tenantId, dto);
  }

  @Get('party/:partyId/latest')
  latest(@Req() req: any, @Param('partyId') partyId: string) {
    return this.riskService.latestForParty(req.user.tenantId, partyId);
  }
}
