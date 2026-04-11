import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { CompanyServingReadService } from '../services/company-serving-read.service';

function normalizeOrgNumber(raw: string): string {
  return raw.replace(/\D/g, '') || raw;
}

/**
 * Read models from bv_read.* physical serving tables (tenant from JWT).
 * Base path: GET /api/v1/company-serving/:organisationNumber/…
 */
@Controller('company-serving')
@UseGuards(JwtAuthGuard)
export class CompanyServingController {
  constructor(private readonly serving: CompanyServingReadService) {}

  @Get(':organisationNumber/overview')
  getOverview(@TenantId() tenantId: string, @Param('organisationNumber') organisationNumber: string) {
    const org = normalizeOrgNumber(organisationNumber);
    return this.serving.getOverview(tenantId, org);
  }

  @Get(':organisationNumber/officers')
  getOfficers(@TenantId() tenantId: string, @Param('organisationNumber') organisationNumber: string) {
    const org = normalizeOrgNumber(organisationNumber);
    return this.serving.getOfficers(tenantId, org);
  }

  @Get(':organisationNumber/financial-reports')
  getFinancialReports(@TenantId() tenantId: string, @Param('organisationNumber') organisationNumber: string) {
    const org = normalizeOrgNumber(organisationNumber);
    return this.serving.getFiReports(tenantId, org);
  }

  @Get(':organisationNumber/documents')
  getDocuments(@TenantId() tenantId: string, @Param('organisationNumber') organisationNumber: string) {
    const org = normalizeOrgNumber(organisationNumber);
    return this.serving.getHvdDocuments(tenantId, org);
  }

  @Get(':organisationNumber/fi-cases')
  getFiCases(@TenantId() tenantId: string, @Param('organisationNumber') organisationNumber: string) {
    const org = normalizeOrgNumber(organisationNumber);
    return this.serving.getFiCases(tenantId, org);
  }

  @Get(':organisationNumber/share-capital')
  getShareCapital(@TenantId() tenantId: string, @Param('organisationNumber') organisationNumber: string) {
    const org = normalizeOrgNumber(organisationNumber);
    return this.serving.getShareCapital(tenantId, org);
  }

  @Get(':organisationNumber/engagements')
  getEngagements(@TenantId() tenantId: string, @Param('organisationNumber') organisationNumber: string) {
    const org = normalizeOrgNumber(organisationNumber);
    return this.serving.getEngagements(tenantId, org);
  }
}
