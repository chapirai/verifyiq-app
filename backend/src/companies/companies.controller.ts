import { Body, Controller, Get, Param, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiQuotaBucket } from '../common/decorators/api-quota-bucket.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequiredScopes } from '../common/decorators/required-scopes.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { ScopeGuard } from '../common/guards/scope.guard';
import { ApiQuotaInterceptor } from '../common/interceptors/api-quota.interceptor';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { CompaniesService } from './companies.service';
import { CompanyMetadataService } from './services/company-metadata.service';
import { ListCompaniesDto } from './dto/list-companies.dto';
import { LookupCompanyDto } from './dto/lookup-company.dto';

@Controller('companies')
@UseGuards(JwtAuthGuard, ScopeGuard)
@RequiredScopes('companies:read')
@UseInterceptors(ApiQuotaInterceptor)
@ApiQuotaBucket('companies')
export class CompaniesController {
  constructor(
    private readonly companiesService: CompaniesService,
    private readonly companyMetadataService: CompanyMetadataService,
  ) {}

  @Post('lookup')
  lookup(@TenantId() tenantId: string, @CurrentUser('sub') actorId: string | undefined, @Body() dto: LookupCompanyDto) {
    const ctx: TenantContext = { tenantId, actorId: actorId ?? null };
    return this.companiesService.orchestrateLookup(ctx, dto);
  }

  @Get()
  findAll(@TenantId() tenantId: string, @CurrentUser('sub') actorId: string | undefined, @Query() query: ListCompaniesDto) {
    const ctx: TenantContext = { tenantId, actorId: actorId ?? null };
    return this.companiesService.findAll(ctx, query);
  }

  @Get(':id')
  findOne(@TenantId() tenantId: string, @CurrentUser('sub') actorId: string | undefined, @Param('id') id: string) {
    const ctx: TenantContext = { tenantId, actorId: actorId ?? null };
    return this.companiesService.findOne(ctx, id);
  }

  /**
   * GET /companies/:orgNumber/freshness
   * P02-T11: Freshness + source metadata for company profile panels.
   */
  @Get(':orgNumber/freshness')
  getFreshness(@TenantId() tenantId: string, @Param('orgNumber') orgNumber: string) {
    return this.companyMetadataService.getFreshnessMetadata(tenantId, orgNumber);
  }

  /**
   * GET /companies/:orgNumber/snapshots?limit=…
   * P02-T11: Snapshot history for company profile panels.
   */
  @Get(':orgNumber/snapshots')
  getSnapshotHistory(
    @TenantId() tenantId: string,
    @Param('orgNumber') orgNumber: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = Number.parseInt(limit ?? '', 10);
    const take = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 100) : 20;
    return this.companyMetadataService.getSnapshotHistory(tenantId, orgNumber, take);
  }
}
