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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUser } from '../auth/interfaces/jwt-user.interface';
import { RecordUsageDto } from './dto/record-usage.dto';
import { SetEntitlementDto } from './dto/set-entitlement.dto';
import { EntitlementsService } from './entitlements.service';

@Controller('entitlements')
@UseGuards(JwtAuthGuard)
export class EntitlementsController {
  constructor(private readonly entitlementsService: EntitlementsService) {}

  @Get()
  listEntitlements(@CurrentUser() currentUser: JwtUser) {
    return this.entitlementsService.listEntitlements(currentUser.tenantId);
  }

  @Put(':datasetFamily')
  setEntitlement(
    @Param('datasetFamily') datasetFamily: string,
    @Body() dto: SetEntitlementDto,
    @CurrentUser() currentUser: JwtUser,
  ) {
    dto.datasetFamily = datasetFamily;
    return this.entitlementsService.setEntitlement(currentUser.tenantId, currentUser.sub, dto);
  }

  @Get('usage/summary')
  getUsageSummary(
    @CurrentUser() currentUser: JwtUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    return this.entitlementsService.getUsageSummary(currentUser.tenantId, fromDate, toDate);
  }

  @Get('usage/events')
  listUsageEvents(
    @CurrentUser() currentUser: JwtUser,
    @Query('datasetFamily') datasetFamily?: string,
    @Query('limit') limit?: string,
  ) {
    return this.entitlementsService.listUsageEvents(
      currentUser.tenantId,
      datasetFamily,
      limit ? parseInt(limit, 10) : 100,
    );
  }

  @Post('usage')
  recordUsage(@Body() dto: RecordUsageDto, @CurrentUser() currentUser: JwtUser) {
    return this.entitlementsService.recordUsage(currentUser.tenantId, currentUser.sub, dto);
  }

  @Post('initialize')
  initializeDefaultEntitlements(@CurrentUser() currentUser: JwtUser) {
    return this.entitlementsService.initializeDefaultEntitlements(currentUser.tenantId);
  }
}
