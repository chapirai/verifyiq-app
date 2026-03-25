import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RecordUsageDto } from './dto/record-usage.dto';
import { SetEntitlementDto } from './dto/set-entitlement.dto';
import { EntitlementsService } from './entitlements.service';

const STUB_TENANT_ID = '00000000-0000-0000-0000-000000000001';

@Controller('entitlements')
@UseGuards(JwtAuthGuard)
export class EntitlementsController {
  constructor(private readonly entitlementsService: EntitlementsService) {}

  @Get()
  listEntitlements() {
    return this.entitlementsService.listEntitlements(STUB_TENANT_ID);
  }

  @Put(':datasetFamily')
  setEntitlement(@Param('datasetFamily') datasetFamily: string, @Body() dto: SetEntitlementDto) {
    dto.datasetFamily = datasetFamily;
    return this.entitlementsService.setEntitlement(STUB_TENANT_ID, null, dto);
  }

  @Get('usage/summary')
  getUsageSummary(@Query('from') from?: string, @Query('to') to?: string) {
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    return this.entitlementsService.getUsageSummary(STUB_TENANT_ID, fromDate, toDate);
  }

  @Get('usage/events')
  listUsageEvents(
    @Query('datasetFamily') datasetFamily?: string,
    @Query('limit') limit?: string,
  ) {
    return this.entitlementsService.listUsageEvents(
      STUB_TENANT_ID,
      datasetFamily,
      limit ? parseInt(limit, 10) : 100,
    );
  }

  @Post('usage')
  recordUsage(@Body() dto: RecordUsageDto) {
    return this.entitlementsService.recordUsage(STUB_TENANT_ID, null, dto);
  }

  @Post('initialize')
  initializeDefaultEntitlements() {
    return this.entitlementsService.initializeDefaultEntitlements(STUB_TENANT_ID);
  }
}
