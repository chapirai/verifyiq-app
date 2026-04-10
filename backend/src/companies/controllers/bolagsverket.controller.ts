import { Body, Controller, ForbiddenException, Get, HttpException, InternalServerErrorException, Param, Post, Query, Req, Res, StreamableFile, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { AuditEventType } from '../../audit/audit-event.entity';
import { AuditService } from '../../audit/audit.service';
import {
  BolagsverketArendeDto,
  BolagsverketDocumentListDto,
  BolagsverketEngagemangDto,
  BolagsverketFinancialReportsDto,
  BolagsverketLookupDto,
  BolagsverketPersonDto,
  BolagsverketShareCapitalHistoryDto,
  BolagsverketSignatoryPowerDto,
  BvEnrichDto,
  BvPersonEnrichDto,
} from '../dto/bolagsverket-request.dto';
import { BolagsverketService } from '../services/bolagsverket.service';
import { BvCacheService } from '../services/bv-cache.service';
import { BvDocumentStorageService } from '../services/bv-document-storage.service';
import { SnapshotQueryService } from '../services/snapshot-query.service';
import { RawPayloadQueryService } from '../services/raw-payload-query.service';

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

/** Roles that are authorised to access raw provider payloads. */
const RAW_PAYLOAD_ALLOWED_ROLES = ['admin', 'compliance'] as const;

function assertRawPayloadAccess(req: any): void {
  const role = (req.user?.role ?? req.user?.roles?.[0]) as string | undefined;
  if (!role || !(RAW_PAYLOAD_ALLOWED_ROLES as readonly string[]).includes(role)) {
    throw new ForbiddenException(
      'Raw payload access is restricted to admin and compliance roles.',
    );
  }
}

@Controller('bolagsverket')
@UseGuards(JwtAuthGuard)
export class BolagsverketController {
  constructor(
    private readonly bolagsverketService: BolagsverketService,
    private readonly bvCacheService: BvCacheService,
    private readonly bvDocumentStorageService: BvDocumentStorageService,
    private readonly snapshotQueryService: SnapshotQueryService,
    private readonly rawPayloadQueryService: RawPayloadQueryService,
    private readonly auditService: AuditService,
  ) {}

  private requireRawPayloadAccess(req: any, resourceId: string, accessType: string): void {
    try {
      assertRawPayloadAccess(req);
    } catch (err) {
      const tenantId = (req.user?.tenantId as string | undefined) ?? DEFAULT_TENANT_ID;
      const actorId = (req.user?.sub ?? req.user?.id) as string | undefined;
      void this.auditService.emitAuditEvent({
        tenantId,
        userId: actorId ?? null,
        eventType: AuditEventType.SENSITIVE_ACCESS,
        action: 'raw_payload.access',
        status: 'denied',
        resourceId,
        metadata: { accessType, granted: false },
      });
      void this.auditService.emitAuditEvent({
        tenantId,
        userId: actorId ?? null,
        eventType: AuditEventType.PERMISSION_DENIED,
        action: 'raw_payload.access',
        status: 'denied',
        resourceId,
        metadata: { accessType },
      });
      throw err;
    }
  }

  /** GET /bolagsverket/health – check Bolagsverket HVD API availability. */
  @Get('health')
  healthCheck() {
    return this.bolagsverketService.healthCheck();
  }

  @Get('hvd/isalive')
  hvdIsAlive(@Req() req: any) {
    const tenantId = (req.user?.tenantId as string | undefined) ?? DEFAULT_TENANT_ID;
    const actorId = (req.user?.sub ?? req.user?.id) as string | undefined;
    return this.bolagsverketService.hvdIsAlive({ tenantId, actorId: actorId ?? null });
  }

  /** GET /bolagsverket/health/foretagsinfo – check Företagsinformation v4 API availability. */
  @Get('health/foretagsinfo')
  foretagsinfoHealthCheck() {
    return this.bolagsverketService.foretagsinfoHealthCheck();
  }

  @Get('fi/isalive')
  fiIsAlive(@Req() req: any) {
    const tenantId = (req.user?.tenantId as string | undefined) ?? DEFAULT_TENANT_ID;
    const actorId = (req.user?.sub ?? req.user?.id) as string | undefined;
    return this.bolagsverketService.fiIsAlive({ tenantId, actorId: actorId ?? null });
  }

  /** GET /bolagsverket/token-cache – expose OAuth token cache diagnostics. */
  @Get('token-cache')
  tokenCacheStatus() {
    return this.bolagsverketService.getTokenCacheStatus();
  }

  /**
   * POST /bolagsverket/company
   * Retrieve complete company profile (HVD + organisation information + documents).
   */
  @Post('company')
  getCompleteCompanyData(@Body() dto: BolagsverketLookupDto, @Req() req: any) {
    const tenantId = (req.user?.tenantId as string | undefined) ?? DEFAULT_TENANT_ID;
    const actorId = (req.user?.sub ?? req.user?.id) as string | undefined;
    return this.bolagsverketService.getCompleteCompanyData(dto.identitetsbeteckning, {
      tenantId,
      actorId: actorId ?? null,
    });
  }

  @Post('hvd/organisationer')
  getHvdOrganisation(@Body() dto: BolagsverketLookupDto, @Req() req: any) {
    const tenantId = (req.user?.tenantId as string | undefined) ?? DEFAULT_TENANT_ID;
    const actorId = (req.user?.sub ?? req.user?.id) as string | undefined;
    return this.bolagsverketService.getHighValueCompanyInformation(dto.identitetsbeteckning, {
      tenantId,
      actorId: actorId ?? null,
    });
  }

  /**
   * POST /bolagsverket/company-information
   * Retrieve company information from Företagsinformation API.
   */
  @Post('company-information')
  getCompanyInformation(@Body() dto: BolagsverketLookupDto, @Req() req: any) {
    const tenantId = (req.user?.tenantId as string | undefined) ?? DEFAULT_TENANT_ID;
    const actorId = (req.user?.sub ?? req.user?.id) as string | undefined;
    return this.bolagsverketService.getCompanyInformation(
      dto.identitetsbeteckning,
      dto.informationCategories,
      dto.tidpunkt,
      { tenantId, actorId: actorId ?? null },
    );
  }

  @Post('fi/organisationer')
  getFiOrganisation(@Body() dto: BolagsverketLookupDto, @Req() req: any) {
    return this.getCompanyInformation(dto, req);
  }

  @Post('fi/personer')
  getFiPerson(@Body() dto: BolagsverketPersonDto, @Req() req: any) {
    const tenantId = (req.user?.tenantId as string | undefined) ?? DEFAULT_TENANT_ID;
    const actorId = (req.user?.sub ?? req.user?.id) as string | undefined;
    return this.bolagsverketService.getPersonInformation(
      dto.identitetsbeteckning,
      { tenantId, actorId: actorId ?? null },
      dto.personInformationsmangd,
    );
  }

  /**
   * POST /bolagsverket/documents
   * List available annual reports and financial documents for an organisation.
   */
  @Post('documents')
  getDocumentList(@Body() dto: BolagsverketDocumentListDto, @Req() req: any) {
    const tenantId = (req.user?.tenantId as string | undefined) ?? DEFAULT_TENANT_ID;
    const actorId = (req.user?.sub ?? req.user?.id) as string | undefined;
    return this.bolagsverketService.getDocumentList(dto.identitetsbeteckning, {
      tenantId,
      actorId: actorId ?? null,
    });
  }

  @Post('hvd/dokumentlista')
  getHvdDocumentList(@Body() dto: BolagsverketDocumentListDto, @Req() req: any) {
    return this.getDocumentList(dto, req);
  }

  /**
   * GET /bolagsverket/documents/:dokumentId/download
   * Download a document ZIP from Bolagsverket (Värdefulla Datamängder).
   */
  @Get('documents/:dokumentId/download')
  async downloadDocument(@Param('dokumentId') dokumentId: string, @Req() req: any, @Res({ passthrough: true }) res: Response) {
    const tenantId = (req.user?.tenantId as string | undefined) ?? DEFAULT_TENANT_ID;
    const actorId = (req.user?.sub ?? req.user?.id) as string | undefined;
    const document = await this.bolagsverketService.getDocument(dokumentId, {
      tenantId,
      actorId: actorId ?? null,
    });
    res.set({
      'Content-Type': document.contentType,
      'Content-Disposition': `attachment; filename="${document.fileName}"`,
    });
    return new StreamableFile(document.data);
  }

  @Get('hvd/dokument/:dokumentId')
  async downloadHvdDocument(@Param('dokumentId') dokumentId: string, @Req() req: any, @Res({ passthrough: true }) res: Response) {
    return this.downloadDocument(dokumentId, req, res);
  }

  /**
   * POST /bolagsverket/officers
   * Get officer information (board, signatories, all).
   */
  @Post('officers')
  getOfficers(@Body() dto: BolagsverketLookupDto, @Req() req: any, @Query('type') type?: 'all' | 'signatories' | 'board') {
    const tenantId = (req.user?.tenantId as string | undefined) ?? DEFAULT_TENANT_ID;
    const actorId = (req.user?.sub ?? req.user?.id) as string | undefined;
    return this.bolagsverketService.getOfficerInformation(dto.identitetsbeteckning, type ?? 'all', {
      tenantId,
      actorId: actorId ?? null,
    });
  }

  /**
   * POST /bolagsverket/signatory-power
   * Verify if a person/organisation has signatory authority.
   */
  @Post('signatory-power')
  verifySignatoryPower(@Body() dto: BolagsverketSignatoryPowerDto, @Req() req: any) {
    const tenantId = (req.user?.tenantId as string | undefined) ?? DEFAULT_TENANT_ID;
    const actorId = (req.user?.sub ?? req.user?.id) as string | undefined;
    return this.bolagsverketService.getSignatoryOptions(
      dto.funktionarIdentitetsbeteckning,
      dto.organisationIdentitetsbeteckning,
      { tenantId, actorId: actorId ?? null },
    );
  }

  @Post('fi/firmateckningsalternativ')
  getFiSignatoryAlternatives(@Body() dto: BolagsverketSignatoryPowerDto, @Req() req: any) {
    return this.verifySignatoryPower(dto, req);
  }

  /**
   * POST /bolagsverket/share-capital-history
   * Retrieve historical share capital changes.
   */
  @Post('share-capital-history')
  getShareCapitalHistory(@Body() dto: BolagsverketShareCapitalHistoryDto, @Req() req: any) {
    const tenantId = (req.user?.tenantId as string | undefined) ?? DEFAULT_TENANT_ID;
    const actorId = (req.user?.sub ?? req.user?.id) as string | undefined;
    return this.bolagsverketService.getShareCapitalChanges(
      dto.identitetsbeteckning,
      dto.fromdatum,
      dto.tomdatum,
      { tenantId, actorId: actorId ?? null },
    );
  }

  @Post('fi/aktiekapitalforandringar')
  getFiShareCapitalHistory(@Body() dto: BolagsverketShareCapitalHistoryDto, @Req() req: any) {
    return this.getShareCapitalHistory(dto, req);
  }

  /**
   * POST /bolagsverket/cases
   * Retrieve case/arende information.
   */
  @Post('cases')
  getCaseInformation(@Body() dto: BolagsverketArendeDto, @Req() req: any) {
    const tenantId = (req.user?.tenantId as string | undefined) ?? DEFAULT_TENANT_ID;
    const actorId = (req.user?.sub ?? req.user?.id) as string | undefined;
    return this.bolagsverketService.getCases(
      dto.arendenummer,
      dto.organisationIdentitetsbeteckning,
      dto.fromdatum,
      dto.tomdatum,
      { tenantId, actorId: actorId ?? null },
    );
  }

  @Post('fi/arenden')
  getFiCases(@Body() dto: BolagsverketArendeDto, @Req() req: any) {
    return this.getCaseInformation(dto, req);
  }

  /**
   * POST /bolagsverket/engagements
   * Find all organisations where a person/organisation holds officer positions.
   */
  @Post('engagements')
  getEngagements(@Body() dto: BolagsverketEngagemangDto, @Req() req: any) {
    const tenantId = (req.user?.tenantId as string | undefined) ?? DEFAULT_TENANT_ID;
    const actorId = (req.user?.sub ?? req.user?.id) as string | undefined;
    return this.bolagsverketService.getOrganisationEngagements(
      dto.identitetsbeteckning,
      dto.paginering?.sida,
      dto.paginering?.antalPerSida,
      { tenantId, actorId: actorId ?? null },
    );
  }

  @Post('fi/organisationsengagemang')
  getFiEngagements(@Body() dto: BolagsverketEngagemangDto, @Req() req: any) {
    return this.getEngagements(dto, req);
  }

  /**
   * POST /bolagsverket/financial-reports
   * Retrieve financial reports for an organisation.
   */
  @Post('financial-reports')
  getFinancialReports(@Body() dto: BolagsverketFinancialReportsDto, @Req() req: any) {
    const tenantId = (req.user?.tenantId as string | undefined) ?? DEFAULT_TENANT_ID;
    const actorId = (req.user?.sub ?? req.user?.id) as string | undefined;
    return this.bolagsverketService.getFinancialReports(
      dto.identitetsbeteckning,
      dto.fromdatum,
      dto.tomdatum,
      { tenantId, actorId: actorId ?? null },
    );
  }

  @Post('fi/finansiella-rapporter')
  getFiFinancialReports(@Body() dto: BolagsverketFinancialReportsDto, @Req() req: any) {
    return this.getFinancialReports(dto, req);
  }

  /**
   * POST /bolagsverket/financial-snapshot
   * Get a snapshot of share capital, financial year, and available reports.
   */
  @Post('financial-snapshot')
  getFinancialSnapshot(@Body() dto: BolagsverketDocumentListDto, @Req() req: any) {
    const tenantId = (req.user?.tenantId as string | undefined) ?? DEFAULT_TENANT_ID;
    const actorId = (req.user?.sub ?? req.user?.id) as string | undefined;
    return this.bolagsverketService.getFinancialSnapshot(dto.identitetsbeteckning, {
      tenantId,
      actorId: actorId ?? null,
    });
  }

  /**
   * POST /bolagsverket/enrich
   * Full enrichment with persistence and cache checking (30-day TTL).
   */
  @Post('enrich')
  async enrich(@Body() dto: BvEnrichDto, @Req() req: any) {
    const tenantId = (req.user?.tenantId as string | undefined) ?? DEFAULT_TENANT_ID;
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
    const tenantId = (req.user?.tenantId as string | undefined) ?? DEFAULT_TENANT_ID;
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
    const tenantId = (req.user?.tenantId as string | undefined) ?? DEFAULT_TENANT_ID;
    return this.bvCacheService.listSnapshots(tenantId, orgNr);
  }

  /**
   * GET /bolagsverket/snapshots/:id
   * Get a single snapshot by ID (scoped to the authenticated tenant).
   */
  @Get('snapshots/:id')
  async getSnapshotById(@Param('id') id: string, @Req() req: any) {
    const tenantId = (req.user?.tenantId as string | undefined) ?? DEFAULT_TENANT_ID;
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
    const tenantId = (req.user?.tenantId as string | undefined) ?? DEFAULT_TENANT_ID;
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
    const tenantId = (req.user?.tenantId as string | undefined) ?? DEFAULT_TENANT_ID;
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
    const tenantId = (req.user?.tenantId as string | undefined) ?? DEFAULT_TENANT_ID;
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
    const tenantId = (req.user?.tenantId as string | undefined) ?? DEFAULT_TENANT_ID;
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

  // ── Raw Payload endpoints (P02-T02) ────────────────────────────────────────
  // All raw-payload routes are permission-gated: admin and compliance only.

  /**
   * GET /bolagsverket/raw-payloads/:id
   * Retrieve a raw payload by ID.
   * Restricted to admin / compliance roles.
   */
  @Get('raw-payloads/:id')
  async getRawPayloadById(@Param('id') id: string, @Req() req: any) {
    this.requireRawPayloadAccess(req, id, 'by_id');
    const tenantId = (req.user?.tenantId as string | undefined) ?? DEFAULT_TENANT_ID;
    const actorId = (req.user?.sub ?? req.user?.id) as string | undefined;
    return this.rawPayloadQueryService.getById(tenantId, id, actorId);
  }

  /**
   * GET /bolagsverket/raw-payloads/by-snapshot/:snapshotId
   * Retrieve the raw payload linked to a specific snapshot.
   * Restricted to admin / compliance roles.
   */
  @Get('raw-payloads/by-snapshot/:snapshotId')
  async getRawPayloadBySnapshot(@Param('snapshotId') snapshotId: string, @Req() req: any) {
    this.requireRawPayloadAccess(req, snapshotId, 'by_snapshot');
    const tenantId = (req.user?.tenantId as string | undefined) ?? DEFAULT_TENANT_ID;
    const actorId = (req.user?.sub ?? req.user?.id) as string | undefined;
    return this.rawPayloadQueryService.getBySnapshotId(tenantId, snapshotId, actorId);
  }

  /**
   * GET /bolagsverket/raw-payloads/by-checksum?checksum=…
   * Find all raw payloads with a specific checksum (deduplication audit).
   * Restricted to admin / compliance roles.
   */
  @Get('raw-payloads/by-checksum')
  async getRawPayloadsByChecksum(@Query('checksum') checksum: string, @Req() req: any) {
    this.requireRawPayloadAccess(req, checksum, 'by_checksum');
    const tenantId = (req.user?.tenantId as string | undefined) ?? DEFAULT_TENANT_ID;
    return this.rawPayloadQueryService.getByChecksum(tenantId, checksum);
  }

  /**
   * GET /bolagsverket/raw-payloads/by-provider?source=…&limit=…
   * List raw payloads from a specific provider source.
   * Restricted to admin / compliance roles.
   */
  @Get('raw-payloads/by-provider')
  async getRawPayloadsByProvider(
    @Query('source') source: string,
    @Query('limit') limit: string | undefined,
    @Req() req: any,
  ) {
    this.requireRawPayloadAccess(req, source, 'by_provider');
    const tenantId = (req.user?.tenantId as string | undefined) ?? DEFAULT_TENANT_ID;
    const take = limit ? Math.min(parseInt(limit, 10), 100) : 50;
    return this.rawPayloadQueryService.listByProviderSource(tenantId, source, take);
  }

  /**
   * GET /bolagsverket/raw-payloads/by-org?orgNr=…&limit=…
   * List raw payloads for a specific organisation.
   * Restricted to admin / compliance roles.
   */
  @Get('raw-payloads/by-org')
  async getRawPayloadsByOrg(
    @Query('orgNr') orgNr: string,
    @Query('limit') limit: string | undefined,
    @Req() req: any,
  ) {
    this.requireRawPayloadAccess(req, orgNr, 'by_org');
    const tenantId = (req.user?.tenantId as string | undefined) ?? DEFAULT_TENANT_ID;
    const take = limit ? Math.min(parseInt(limit, 10), 100) : 50;
    return this.rawPayloadQueryService.listByOrganisationsnummer(tenantId, orgNr, take);
  }
}
