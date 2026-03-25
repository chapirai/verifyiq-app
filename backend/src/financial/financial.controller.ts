import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateCreditRatingDto } from './dto/create-credit-rating.dto';
import { CreateFinancialStatementDto } from './dto/create-financial-statement.dto';
import { FinancialService } from './financial.service';

const STUB_TENANT_ID = '00000000-0000-0000-0000-000000000001';

@Controller('financial')
@UseGuards(JwtAuthGuard)
export class FinancialController {
  constructor(private readonly financialService: FinancialService) {}

  @Post('statements')
  upsertStatement(@Body() dto: CreateFinancialStatementDto) {
    return this.financialService.upsertStatement(STUB_TENANT_ID, null, dto);
  }

  @Get('statements/:orgNr')
  listStatements(@Param('orgNr') orgNr: string) {
    return this.financialService.listStatements(STUB_TENANT_ID, orgNr);
  }

  @Get('statements/:orgNr/:fiscalYear')
  getStatement(@Param('orgNr') orgNr: string, @Param('fiscalYear') fiscalYear: string) {
    return this.financialService.getStatement(STUB_TENANT_ID, orgNr, fiscalYear);
  }

  @Post('ratings')
  createRating(@Body() dto: CreateCreditRatingDto) {
    return this.financialService.createRating(STUB_TENANT_ID, null, dto);
  }

  @Get('ratings/:orgNr')
  listRatings(@Param('orgNr') orgNr: string) {
    return this.financialService.listRatings(STUB_TENANT_ID, orgNr);
  }

  @Get('ratings/:orgNr/current')
  getCurrentRating(@Param('orgNr') orgNr: string) {
    return this.financialService.getCurrentRating(STUB_TENANT_ID, orgNr);
  }
}
