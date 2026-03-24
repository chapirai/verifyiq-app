import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import {
  BolagsverketArendeDto,
  BolagsverketDocumentListDto,
  BolagsverketEngagemangDto,
  BolagsverketFinancialReportsDto,
  BolagsverketLookupDto,
  BolagsverketShareCapitalHistoryDto,
  BolagsverketSignatoryPowerDto,
} from '../dto/bolagsverket-request.dto';
import { BolagsverketService } from '../services/bolagsverket.service';

@Controller('bolagsverket')
@UseGuards(JwtAuthGuard)
export class BolagsverketController {
  constructor(private readonly bolagsverketService: BolagsverketService) {}

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
}
