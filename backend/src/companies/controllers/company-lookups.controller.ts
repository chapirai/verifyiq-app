import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { LookupCompanyDto } from '../dto/lookup-company.dto';
import { CompaniesService } from '../companies.service';
import { BvPipelineService } from '../services/bv-pipeline.service';

@Controller('company-lookups')
@UseGuards(JwtAuthGuard)
export class CompanyLookupsController {
  constructor(
    private readonly companiesService: CompaniesService,
    private readonly pipeline: BvPipelineService,
  ) {}

  /**
   * POST /company-lookups — track lookup lifecycle, run orchestrated lookup, enqueue parse + drain queues.
   */
  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser('sub') actorId: string | undefined,
    @Body() dto: LookupCompanyDto,
  ) {
    const org = dto.identitetsbeteckning ?? dto.orgNumber;
    if (!org) {
      throw new BadRequestException('identitetsbeteckning or orgNumber is required');
    }
    const lookupRequestId = await this.pipeline.createLookupRequest(tenantId, org, null);
    const ctx: TenantContext = { tenantId, actorId: actorId ?? null };
    const lookupResult = await this.companiesService.orchestrateLookup(ctx, dto);
    const rawId = await this.pipeline.latestRawPayloadIdForOrg(tenantId, org);
    if (rawId) {
      await this.pipeline.enqueueRawPayloadForParse(rawId, lookupRequestId, 0);
      await this.pipeline.drainQueues();
    } else {
      await this.pipeline.markLookupFailed(lookupRequestId, 'No raw payload available for parse');
    }
    return { lookupRequestId, ...lookupResult };
  }

  @Get(':lookupRequestId/status')
  async status(@TenantId() tenantId: string, @Param('lookupRequestId') lookupRequestId: string) {
    const row = await this.pipeline.getLookupRequest(lookupRequestId, tenantId);
    if (!row) throw new NotFoundException('Lookup request not found');
    return row;
  }
}
