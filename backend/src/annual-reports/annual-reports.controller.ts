import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiQuotaBucket } from '../common/decorators/api-quota-bucket.decorator';
import { RequiredScopes } from '../common/decorators/required-scopes.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { ScopeGuard } from '../common/guards/scope.guard';
import { ApiQuotaInterceptor } from '../common/interceptors/api-quota.interceptor';
import { AnnualReportsService } from './services/annual-reports.service';

type UploadedZipFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
};

function normalizeOrgParam(raw: string): string {
  return raw.replace(/\D/g, '') || raw;
}

@Controller('annual-reports')
@UseGuards(JwtAuthGuard)
export class AnnualReportsController {
  constructor(private readonly annualReports: AnnualReportsService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: Number(process.env.AR_UPLOAD_MAX_BYTES ?? 80 * 1024 * 1024) },
    }),
  )
  async upload(
    @TenantId() tenantId: string,
    @UploadedFile() file: UploadedZipFile,
    @Body('organisationsnummer') organisationsnummer?: string,
    @Body('enqueue') enqueue?: string,
  ) {
    if (!file?.buffer?.length) {
      return { error: 'file_required' };
    }
    const { file: row, created } = await this.annualReports.registerZipBuffer({
      tenantId,
      buffer: file.buffer,
      originalFilename: file.originalname || 'report.zip',
      contentType: file.mimetype,
      organisationsnummer: organisationsnummer ? normalizeOrgParam(organisationsnummer) : undefined,
    });
    let jobId: string | undefined;
    if (enqueue !== 'false') {
      const q = await this.annualReports.enqueueParse(tenantId, row.id, false);
      jobId = q.jobId;
    }
    return { fileId: row.id, created, status: row.status, jobId };
  }

  @Post('from-bv-document/:documentId')
  async fromBvDocument(@TenantId() tenantId: string, @Param('documentId') documentId: string) {
    const { file, created } = await this.annualReports.registerFromBvStoredDocument(tenantId, documentId);
    const { jobId } = await this.annualReports.enqueueParse(tenantId, file.id, false);
    return { fileId: file.id, created, jobId };
  }

  /**
   * Fetch HVD ZIP on the server, store in MinIO, register annual_report_files, queue parse.
   * Use this from the workspace instead of browser-only download (which never populated the DB).
   */
  @Post('ingest-hvd-dokument')
  async ingestHvdDokument(
    @TenantId() tenantId: string,
    @Body() body: { dokumentId?: string; identitetsbeteckning?: string },
  ) {
    const dokumentId = body.dokumentId?.trim();
    const identitetsbeteckning = body.identitetsbeteckning?.trim();
    if (!dokumentId || !identitetsbeteckning) {
      throw new BadRequestException('dokumentId_and_identitetsbeteckning_required');
    }
    return this.annualReports.ingestHvdDokument(tenantId, identitetsbeteckning, dokumentId);
  }

  @Post('files/:fileId/enqueue-parse')
  async enqueueParse(
    @TenantId() tenantId: string,
    @Param('fileId') fileId: string,
    @Body('force') force?: boolean,
  ) {
    return this.annualReports.enqueueParse(tenantId, fileId, Boolean(force));
  }

  @Post('jobs/backfill')
  async backfill(@TenantId() tenantId: string, @Body('limit') limit?: number) {
    return this.annualReports.enqueueBackfill(tenantId, limit ?? 50);
  }

  @Post('files/:fileId/rebuild-serving')
  async rebuildServing(@TenantId() tenantId: string, @Param('fileId') fileId: string) {
    return this.annualReports.enqueueRebuildServing(tenantId, fileId);
  }

  @Get('companies/:organisationNumber/latest')
  async latest(@TenantId() tenantId: string, @Param('organisationNumber') organisationNumber: string) {
    const org = normalizeOrgParam(organisationNumber);
    const header = await this.annualReports.getLatestHeader(tenantId, org);
    return { organisationNumber: org, header };
  }

  @Get('companies/:organisationNumber/history')
  async history(
    @TenantId() tenantId: string,
    @Param('organisationNumber') organisationNumber: string,
    @Query('limit') limitRaw?: string,
  ) {
    const org = normalizeOrgParam(organisationNumber);
    const parsed = limitRaw != null ? parseInt(limitRaw, 10) : NaN;
    const fallbackRaw = Number(process.env.AR_HISTORY_LIMIT ?? 200);
    const fallback = Number.isFinite(fallbackRaw) ? fallbackRaw : 200;
    const limit = Number.isFinite(parsed) ? Math.min(500, Math.max(1, parsed)) : Math.min(500, Math.max(1, fallback));
    const headers = await this.annualReports.getHistory(tenantId, org, limit);
    return { organisationNumber: org, headers };
  }

  @Get('companies/:organisationNumber/financials')
  async financials(@TenantId() tenantId: string, @Param('organisationNumber') organisationNumber: string) {
    const org = normalizeOrgParam(organisationNumber);
    const data = await this.annualReports.getFinancialsForOrg(tenantId, org);
    return { organisationNumber: org, ...data };
  }

  /** Dashboard/workspace read model: import, source files, statements, audit, capped raw facts. */
  @Get('companies/:organisationNumber/workspace-read-model')
  async workspaceReadModel(
    @TenantId() tenantId: string,
    @Param('organisationNumber') organisationNumber: string,
  ) {
    const org = normalizeOrgParam(organisationNumber);
    return this.annualReports.getWorkspaceReadModel(tenantId, org);
  }

  /** Final API-facing financial table built from normalized annual report data. */
  @Get('companies/:organisationNumber/api-financial-table')
  @UseGuards(ScopeGuard)
  @UseInterceptors(ApiQuotaInterceptor)
  @ApiQuotaBucket('financial-api')
  @RequiredScopes('financials:read')
  async apiFinancialTable(
    @TenantId() tenantId: string,
    @Param('organisationNumber') organisationNumber: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const org = normalizeOrgParam(organisationNumber);
    const data = await this.annualReports.getApiFinancialTableWithFreshness(tenantId, org);
    if (data.status === 'processing') {
      res.status(202);
      return {
        organisationNumber: org,
        status: data.status,
        message: 'No financial table exists yet; rebuild has been queued.',
        rows: [],
      };
    }
    return {
      organisationNumber: org,
      status: data.status,
      stale: data.stale,
      lastUpdatedAt: data.lastUpdatedAt,
      rows: data.rows,
    };
  }

  @Post('companies/:organisationNumber/api-financial-table/rebuild')
  async rebuildApiFinancialTable(
    @TenantId() tenantId: string,
    @Param('organisationNumber') organisationNumber: string,
  ) {
    const org = normalizeOrgParam(organisationNumber);
    const result = await this.annualReports.rebuildApiFinancialTableForOrg(tenantId, org);
    return { organisationNumber: org, ...result };
  }

  /** Latest N distinct fiscal years (by filing period end), pivoted canonical metrics. */
  @Get('companies/:organisationNumber/financial-comparison')
  async financialComparison(
    @TenantId() tenantId: string,
    @Param('organisationNumber') organisationNumber: string,
    @Query('maxYears') maxYearsRaw?: string,
  ) {
    const org = normalizeOrgParam(organisationNumber);
    const parsed = maxYearsRaw != null ? parseInt(maxYearsRaw, 10) : NaN;
    const defaultRaw = Number(process.env.AR_FINANCIAL_COMPARISON_MAX_YEARS ?? 30);
    const defaultMax = Number.isFinite(defaultRaw) ? Math.min(80, Math.max(1, defaultRaw)) : 30;
    const maxYears = Number.isFinite(parsed) ? Math.min(80, Math.max(1, parsed)) : defaultMax;
    const data = await this.annualReports.getFinancialComparisonForOrg(tenantId, org, maxYears);
    return data;
  }

  @Get('files/:fileId/meta')
  async fileMeta(@TenantId() tenantId: string, @Param('fileId') fileId: string) {
    return this.annualReports.getFileMeta(tenantId, fileId);
  }

  @Get('files/:fileId/detail')
  async fileDetail(@TenantId() tenantId: string, @Param('fileId') fileId: string) {
    return this.annualReports.getFileDetail(tenantId, fileId);
  }
}
