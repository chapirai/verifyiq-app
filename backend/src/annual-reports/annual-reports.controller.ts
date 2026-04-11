import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
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
  async history(@TenantId() tenantId: string, @Param('organisationNumber') organisationNumber: string) {
    const org = normalizeOrgParam(organisationNumber);
    const headers = await this.annualReports.getHistory(tenantId, org);
    return { organisationNumber: org, headers };
  }

  @Get('companies/:organisationNumber/financials')
  async financials(@TenantId() tenantId: string, @Param('organisationNumber') organisationNumber: string) {
    const org = normalizeOrgParam(organisationNumber);
    const data = await this.annualReports.getFinancialsForOrg(tenantId, org);
    return { organisationNumber: org, ...data };
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
