import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreditDecisioningService } from './credit-decisioning.service';
import { CreateCreditDecisionTemplateDto } from './dto/create-credit-decision-template.dto';
import { RunCreditDecisionDto } from './dto/run-credit-decision.dto';

const STUB_TENANT_ID = '00000000-0000-0000-0000-000000000001';

@Controller('credit-decisioning')
@UseGuards(JwtAuthGuard)
export class CreditDecisioningController {
  constructor(private readonly creditDecisioningService: CreditDecisioningService) {}

  @Post('templates')
  createTemplate(@Body() dto: CreateCreditDecisionTemplateDto) {
    return this.creditDecisioningService.createTemplate(STUB_TENANT_ID, null, dto);
  }

  @Get('templates')
  listTemplates() {
    return this.creditDecisioningService.listTemplates(STUB_TENANT_ID);
  }

  @Get('templates/:id')
  getTemplate(@Param('id') id: string) {
    return this.creditDecisioningService.getTemplate(STUB_TENANT_ID, id);
  }

  @Post('decisions')
  runDecision(@Body() dto: RunCreditDecisionDto) {
    return this.creditDecisioningService.runDecision(STUB_TENANT_ID, null, dto);
  }

  @Get('decisions')
  listResults(@Query('organisationNumber') organisationNumber?: string) {
    return this.creditDecisioningService.listResults(STUB_TENANT_ID, organisationNumber);
  }
}
