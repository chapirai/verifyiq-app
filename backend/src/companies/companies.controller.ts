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
import { CompanyDecisionService } from './services/company-decision.service';
import { CompanySignalsService } from './services/company-signals.service';
import { DecisionRefreshTriggerService } from './services/decision-refresh-trigger.service';
import { CompanySourcingProfileService } from './services/company-sourcing-profile.service';
import { CompareCompaniesDto } from './dto/compare-companies.dto';
import { ListCompaniesDto } from './dto/list-companies.dto';
import { LookupCompanyDto } from './dto/lookup-company.dto';
import { SourcingParseQueryDto } from './dto/sourcing-parse-query.dto';
import { parseSourcingQueryText } from './utils/sourcing-query-parser';

@Controller('companies')
@UseGuards(JwtAuthGuard, ScopeGuard)
@RequiredScopes('companies:read')
@UseInterceptors(ApiQuotaInterceptor)
@ApiQuotaBucket('companies')
export class CompaniesController {
  constructor(
    private readonly companiesService: CompaniesService,
    private readonly companyMetadataService: CompanyMetadataService,
    private readonly companySignalsService: CompanySignalsService,
    private readonly companyDecisionService: CompanyDecisionService,
    private readonly decisionRefreshTriggerService: DecisionRefreshTriggerService,
    private readonly sourcingProfileService: CompanySourcingProfileService,
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

  /**
   * GET /companies/search
   * Phase 4 discovery API — same query contract as GET /companies (ranked via sort_by=sourcing_rank).
   * Registered before :id so `search` is never captured as an id.
   */
  @Get('search')
  searchCompanies(@TenantId() tenantId: string, @CurrentUser('sub') actorId: string | undefined, @Query() query: ListCompaniesDto) {
    const ctx: TenantContext = { tenantId, actorId: actorId ?? null };
    return this.companiesService.findAll(ctx, query, { viaSearchEndpoint: true });
  }

  /**
   * POST /companies/sourcing/parse-query
   * Phase 4: deterministic natural-language style text → structured list filters (no external LLM).
   */
  @Post('sourcing/parse-query')
  parseSourcingQuery(@Body() dto: SourcingParseQueryDto) {
    return parseSourcingQueryText(dto.text);
  }

  /**
   * POST /companies/compare
   * Phase 6: one-call comparison payload for multiple companies.
   */
  @Post('compare')
  compareCompanies(
    @TenantId() tenantId: string,
    @CurrentUser('sub') actorId: string | undefined,
    @Body() dto: CompareCompaniesDto,
  ) {
    const ctx: TenantContext = { tenantId, actorId: actorId ?? null };
    return this.companiesService.compareCompanies(ctx, dto);
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

  /**
   * GET /companies/:organisationNumber/similar?limit=…
   * Phase 4: same legal form (`company_form`) as anchor org, excluding anchor (tenant-scoped).
   */
  @Get(':organisationNumber/similar')
  findSimilarCompanies(
    @TenantId() tenantId: string,
    @CurrentUser('sub') actorId: string | undefined,
    @Param('organisationNumber') organisationNumber: string,
    @Query('limit') limit?: string,
    @Query('mode') mode?: string,
  ) {
    const ctx: TenantContext = { tenantId, actorId: actorId ?? null };
    const parsed = Number.parseInt(limit ?? '10', 10);
    const take = Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
    return this.companiesService.findSimilarCompanies(ctx, organisationNumber, take, mode);
  }

  /**
   * GET /companies/:organisationNumber/signals
   * Phase 5: latest stored signal scores + driver explanations for the org.
   */
  @Get(':organisationNumber/signals')
  listCompanySignals(@TenantId() tenantId: string, @Param('organisationNumber') organisationNumber: string) {
    return this.companySignalsService.listLatest(tenantId, organisationNumber);
  }

  /**
   * POST /companies/:organisationNumber/signals/recompute
   * Phase 5: enqueue BullMQ job to recompute all catalog signals (async, versioned rows).
   */
  @Post(':organisationNumber/signals/recompute')
  @RequiredScopes('companies:write')
  recomputeCompanySignals(
    @TenantId() tenantId: string,
    @CurrentUser('sub') actorId: string | undefined,
    @Param('organisationNumber') organisationNumber: string,
  ) {
    return this.companySignalsService.enqueueRecompute({
      tenantId,
      actorId: actorId ?? null,
      organisationNumber,
    });
  }

  /**
   * GET /companies/:organisationNumber/signals/jobs/:jobId
   * Poll BullMQ signal recompute job status.
   */
  @Get(':organisationNumber/signals/jobs/:jobId')
  getSignalsJobStatus(@TenantId() tenantId: string, @Param('jobId') jobId: string) {
    return this.companySignalsService.getJobStatus(tenantId, jobId);
  }

  /**
   * GET /companies/:organisationNumber/decision-insight
   * Phase 9: why this company matters now + recommended action.
   */
  @Get(':organisationNumber/decision-insight')
  getDecisionInsight(
    @TenantId() tenantId: string,
    @CurrentUser('sub') actorId: string | undefined,
    @Param('organisationNumber') organisationNumber: string,
    @Query('mode') mode?: string,
    @Query('persist') persist?: string,
  ) {
    const ctx: TenantContext = { tenantId, actorId: actorId ?? null };
    const persistSnapshot = persist === 'true';
    return this.companyDecisionService.generateInsight(ctx, organisationNumber, mode, persistSnapshot);
  }

  /**
   * GET /companies/:organisationNumber/decision-insight/history
   * Phase 9: persisted decision snapshots for drift tracking.
   */
  @Get(':organisationNumber/decision-insight/history')
  getDecisionInsightHistory(
    @TenantId() tenantId: string,
    @CurrentUser('sub') actorId: string | undefined,
    @Param('organisationNumber') organisationNumber: string,
    @Query('mode') mode?: string,
    @Query('limit') limit?: string,
  ) {
    const ctx: TenantContext = { tenantId, actorId: actorId ?? null };
    const parsed = Number.parseInt(limit ?? '20', 10);
    const take = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 200) : 20;
    return this.companyDecisionService.listHistory(ctx, organisationNumber, mode, take);
  }

  /**
   * POST /companies/:organisationNumber/decision-insight/snapshot
   * Phase 9: force-capture snapshots for all strategy modes.
   */
  @Post(':organisationNumber/decision-insight/snapshot')
  @RequiredScopes('companies:write')
  captureDecisionSnapshots(
    @TenantId() tenantId: string,
    @Param('organisationNumber') organisationNumber: string,
  ) {
    return this.companyDecisionService.generateAndPersistAllModes(tenantId, organisationNumber);
  }

  @Post('sourcing/profiles/rebuild')
  @RequiredScopes('companies:write')
  rebuildSourcingProfiles(
    @TenantId() tenantId: string,
    @Body() dto: { organisationNumbers: string[] },
  ) {
    return this.sourcingProfileService.rebuildProfiles(tenantId, dto.organisationNumbers ?? []);
  }

  @Get('sourcing/backtest')
  backtestSourcingMode(@TenantId() tenantId: string, @Query('deal_mode') dealMode?: string) {
    const mode = (dealMode ?? 'founder_exit') as 'founder_exit' | 'distressed' | 'roll_up';
    return this.sourcingProfileService.backtestDealMode(tenantId, mode);
  }

  @Get('search/performance')
  searchPerformance() {
    return this.companiesService.getSearchPerformance();
  }

  @Post('sourcing/profiles/refresh-materialized-view')
  @RequiredScopes('companies:write')
  refreshSourcingMaterializedView() {
    return this.sourcingProfileService.refreshMaterializedView();
  }

  /**
   * GET /companies/decision-refresh/status
   * Phase 10: observability for unified decision refresh trigger queue.
   */
  @Get('decision-refresh/status')
  getDecisionRefreshStatus(@TenantId() tenantId: string, @Query('limit') limit?: string) {
    const parsed = Number.parseInt(limit ?? '25', 10);
    const take = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 200) : 25;
    return this.decisionRefreshTriggerService.getQueueStatus(tenantId, take);
  }

  /**
   * GET /companies/:id — must stay after multi-segment routes so paths like …/freshness match first.
   */
  @Get(':id')
  findOne(@TenantId() tenantId: string, @CurrentUser('sub') actorId: string | undefined, @Param('id') id: string) {
    const ctx: TenantContext = { tenantId, actorId: actorId ?? null };
    return this.companiesService.findOne(ctx, id);
  }
}
