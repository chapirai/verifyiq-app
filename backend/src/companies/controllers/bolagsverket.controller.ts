import { Body, Controller, Get, HttpException, InternalServerErrorException, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import {
  BolagsverketArendeDto,
  BolagsverketDocumentListDto,
  BolagsverketEngagemangDto,
  BolagsverketFinancialReportsDto,
  BolagsverketLookupDto,
  BolagsverketShareCapitalHistoryDto,
  BolagsverketSignatoryPowerDto,
  BvEnrichDto,
  BvPersonEnrichDto,
} from '../dto/bolagsverket-request.dto';
import { BolagsverketService } from '../services/bolagsverket.service';
import { BvCacheService } from '../services/bv-cache.service';
import { BvDocumentStorageService } from '../services/bv-document-storage.service';
import { SnapshotQueryService } from '../services/snapshot-query.service';

@Controller('bolagsverket')
@UseGuards(JwtAuthGuard)
export class BolagsverketController {
  constructor(
    private readonly bolagsverketService: BolagsverketService,
    private readonly bvCacheService: BvCacheService,
    private readonly bvDocumentStorageService: BvDocumentStorageService,
    private readonly snapshotQueryService: SnapshotQueryService,
  ) {}

  /** GET /bolagsverket/health – check Bolagsverket API availability. */
  @Get('health')
  healthCheck() {
    return this.bolagsverketService.healthCheck();
  }

  /**
   * POST /bolagsverket/company
   * Retrieve complete company profile (HVD + organisation information + documents).
   */
  @Post('company')
  getCompleteCompanyData(@Body() dto: BolagsverketLookupDto) {
    return this.bolagsverketService.getCompleteCompanyData(dto.identitetsbeteckning);
  }

  /**
   * POST /bolagsverket/documents
   * List available annual reports and financial documents for an organisation.
   */
  @Post('documents')
  getDocumentList(@Body() dto: BolagsverketDocumentListDto) {
    return this.bolagsverketService.getDocumentList(dto.identitetsbeteckning);
  }

  /**
   * POST /bolagsverket/officers
   * Get officer information (board, signatories, all).
   */
  @Post('officers')
  getOfficers(@Body() dto: BolagsverketLookupDto, @Query('type') type?: 'all' | 'signatories' | 'board') {
    return this.bolagsverketService.getOfficerInformation(dto.identitetsbeteckning, type ?? 'all');
  }

  /**
   * POST /bolagsverket/signatory-power
   * Verify if a person/organisation has signatory authority.
   */
  @Post('signatory-power')
  verifySignatoryPower(@Body() dto: BolagsverketSignatoryPowerDto) {
    return this.bolagsverketService.verifySignatoryPower(
      dto.funktionarIdentitetsbeteckning,
      dto.organisationIdentitetsbeteckning,
    );
  }

  /**
   * POST /bolagsverket/share-capital-history
   * Retrieve historical share capital changes.
   */
  @Post('share-capital-history')
  getShareCapitalHistory(@Body() dto: BolagsverketShareCapitalHistoryDto) {
    return this.bolagsverketService.getShareCapitalHistory(
      dto.identitetsbeteckning,
      dto.fromdatum,
      dto.tomdatum,
    );
  }

  /**
   * POST /bolagsverket/cases
   * Retrieve case/arende information.
   */
  @Post('cases')
  getCaseInformation(@Body() dto: BolagsverketArendeDto) {
    return this.bolagsverketService.getCaseInformation(
      dto.arendenummer,
      dto.organisationIdentitetsbeteckning,
      dto.fromdatum,
      dto.tomdatum,
    );
  }

  /**
   * POST /bolagsverket/engagements
   * Find all organisations where a person/organisation holds officer positions.
   */
  @Post('engagements')
  getEngagements(@Body() dto: BolagsverketEngagemangDto) {
    return this.bolagsverketService.getOrganizationEngagements(
      dto.identitetsbeteckning,
      dto.paginering?.sida,
      dto.paginering?.antalPerSida,
    );
  }

  /**
   * POST /bolagsverket/financial-reports
   * Retrieve financial reports for an organisation.
   */
  @Post('financial-reports')
  getFinancialReports(@Body() dto: BolagsverketFinancialReportsDto) {
    return this.bolagsverketService.getFinancialReports(
      dto.identitetsbeteckning,
      dto.fromdatum,
      dto.tomdatum,
    );
  }

  /**
   * POST /bolagsverket/financial-snapshot
   * Get a snapshot of share capital, financial year, and available reports.
   */
  @Post('financial-snapshot')
  getFinancialSnapshot(@Body() dto: BolagsverketDocumentListDto) {
    return this.bolagsverketService.getFinancialSnapshot(dto.identitetsbeteckning);
  }

  /**
   * POST /bolagsverket/enrich
   * Full enrichment with persistence and cache checking (30-day TTL).
   */
  @Post('enrich')
  async enrich(@Body() dto: BvEnrichDto, @Req() req: any) {
    const tenantId = (req.user?.tenantId as string | undefined) ?? 'demo-tenant';
    try {
      return await this.bolagsverketService.enrichAndSave(
        tenantId,
        dto.identitetsbeteckning,
        dto.forceRefresh,
      );
    } catch (err) {
      if (err instanceof HttpException) {
        throw err;
      }
      throw new InternalServerErrorException(
        `Failed to enrich company ${dto.identitetsbeteckning}: ${String(err)}`,
      );
    }
  }

  /**
   * POST /bolagsverket/enrich/person
   * Engagements search by personnummer with cache checking.
   */
  @Post('enrich/person')
  async enrichPerson(@Body() dto: BvPersonEnrichDto, @Req() req: any) {
    const tenantId = (req.user?.tenantId as string | undefined) ?? 'demo-tenant';
    return this.bolagsverketService.enrichPersonEngagements(
      tenantId,
      dto.personnummer,
      dto.forceRefresh,
    );
  }

  /**
   * GET /bolagsverket/snapshots?orgNr=…
   * List fetch snapshots for an organisation (most-recent first).
   */
  @Get('snapshots')
  async getSnapshots(@Query('orgNr') orgNr: string, @Req() req: any) {
    const tenantId = (req.user?.tenantId as string | undefined) ?? 'demo-tenant';
    return this.bvCacheService.listSnapshots(tenantId, orgNr);
  }

  /**
   * GET /bolagsverket/snapshots/:id
   * Get a single snapshot by ID (scoped to the authenticated tenant).
   */
  @Get('snapshots/:id')
  async getSnapshotById(@Param('id') id: string, @Req() req: any) {
    const tenantId = (req.user?.tenantId as string | undefined) ?? 'demo-tenant';
    return this.snapshotQueryService.getSnapshotById(tenantId, id);
  }

  /**
   * GET /bolagsverket/snapshots/history?orgNr=…&limit=…
   * Paginated fetch history for an organisation.
   */
  @Get('snapshots/history')
  async getSnapshotHistory(
    @Query('orgNr') orgNr: string,
    @Query('limit') limit: string | undefined,
    @Req() req: any,
  ) {
    const tenantId = (req.user?.tenantId as string | undefined) ?? 'demo-tenant';
    const take = limit ? Math.min(parseInt(limit, 10), 100) : 20;
    return this.snapshotQueryService.getSnapshotHistory(tenantId, orgNr, take);
  }

  /**
   * GET /bolagsverket/snapshots/stats?orgNr=…
   * Aggregate fetch-history statistics for an organisation.
   * Includes total fetches, success rate, last fetch timestamp, cache-hit count.
   */
  @Get('snapshots/stats')
  async getSnapshotStats(@Query('orgNr') orgNr: string, @Req() req: any) {
    const tenantId = (req.user?.tenantId as string | undefined) ?? 'demo-tenant';
    return this.snapshotQueryService.getFetchStats(tenantId, orgNr);
  }

  /**
   * GET /bolagsverket/snapshots/audit?correlationId=…&policyDecision=…&limit=…
   * Audit / lineage query endpoint — filter snapshots by correlation ID, actor,
   * policy decision, fetch status, or stale-fallback flag.
   */
  @Get('snapshots/audit')
  async getAuditSnapshots(
    @Query('correlationId') correlationId: string | undefined,
    @Query('actorId') actorId: string | undefined,
    @Query('policyDecision') policyDecision: string | undefined,
    @Query('fetchStatus') fetchStatus: string | undefined,
    @Query('staleFallbackOnly') staleFallbackOnly: string | undefined,
    @Query('limit') limit: string | undefined,
    @Req() req: any,
  ) {
    const tenantId = (req.user?.tenantId as string | undefined) ?? 'demo-tenant';
    return this.snapshotQueryService.listForAudit(tenantId, {
      correlationId,
      actorId,
      policyDecision: policyDecision as any,
      fetchStatus,
      staleFallbackOnly: staleFallbackOnly === 'true',
      limit: limit ? Math.min(parseInt(limit, 10), 100) : 50,
    });
  }

  /**
   * GET /bolagsverket/stored-documents?orgNr=…
   * List stored documents for an organisation.
   */
  @Get('stored-documents')
  async getStoredDocuments(@Query('orgNr') orgNr: string, @Req() req: any) {
    const tenantId = (req.user?.tenantId as string | undefined) ?? 'demo-tenant';
    return this.bvDocumentStorageService.listStoredDocuments(tenantId, orgNr);
  }

  /**
   * GET /bolagsverket/stored-documents/:id/download
   * Generate a pre-signed MinIO download URL for a stored document.
   */
  @Get('stored-documents/:id/download')
  async downloadStoredDocument(@Param('id') id: string) {
    return this.bvDocumentStorageService.getDownloadUrl(id);
  }
}
