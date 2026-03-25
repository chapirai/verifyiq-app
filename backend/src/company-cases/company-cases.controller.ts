import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CompanyCasesService } from './company-cases.service';
import { CreateCompanyCaseDto } from './dto/create-company-case.dto';
import { RecordProhibitionDto } from './dto/record-prohibition.dto';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

@Controller('company-cases')
@UseGuards(JwtAuthGuard)
export class CompanyCasesController {
  constructor(private readonly companyCasesService: CompanyCasesService) {}

  @Post()
  createCase(@Body() dto: CreateCompanyCaseDto, @CurrentUser('id') actorId: string) {
    return this.companyCasesService.createCase(TENANT_ID, actorId, dto);
  }

  @Get(':orgNr')
  listCases(@Param('orgNr') orgNr: string) {
    return this.companyCasesService.listCases(TENANT_ID, orgNr);
  }

  @Post('prohibitions')
  recordProhibition(@Body() dto: RecordProhibitionDto, @CurrentUser('id') actorId: string) {
    return this.companyCasesService.recordProhibition(TENANT_ID, actorId, dto);
  }

  @Get('prohibitions/:personnummer')
  checkPersonProhibition(@Param('personnummer') personnummer: string) {
    return this.companyCasesService.checkPersonProhibition(TENANT_ID, personnummer);
  }
}
