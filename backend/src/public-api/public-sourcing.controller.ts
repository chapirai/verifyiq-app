import { Body, Controller, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { CompaniesService } from '../companies/companies.service';
import { ListCompaniesDto } from '../companies/dto/list-companies.dto';
import { CompareCompaniesDto } from '../companies/dto/compare-companies.dto';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { PublicApiKeyGuard } from './guards/public-api-key.guard';
import { ApiQuotaService } from '../common/services/api-quota.service';

@Controller('public/v1/sourcing')
@UseGuards(PublicApiKeyGuard)
export class PublicSourcingController {
  constructor(
    private readonly companiesService: CompaniesService,
    private readonly apiQuotaService: ApiQuotaService,
  ) {}

  private async consumeQuota(req: Record<string, unknown>, res: Response, bucket: string) {
    const tenantId = String(req['apiTenantId'] ?? '');
    const environment = String(req['apiKeyEnvironment'] ?? 'live') as 'live' | 'sandbox';
    const clientKey = String(req['apiKeyId'] ?? 'public-api-key');
    const quota = await this.apiQuotaService.consumeQuota({
      tenantId,
      environment,
      clientKey,
      bucket,
    });
    res.setHeader('X-RateLimit-Limit', String(quota.limit));
    res.setHeader('X-RateLimit-Remaining', String(quota.remaining));
    res.setHeader('X-Plan', quota.plan);
    if (!quota.allowed) {
      return { error: 'rate_limit_exceeded', message: 'Daily quota exceeded for this key.' };
    }
    return null;
  }

  @Get('search')
  async search(@Req() req: Record<string, unknown>, @Res({ passthrough: true }) res: Response, @Query() query: ListCompaniesDto) {
    const quotaError = await this.consumeQuota(req, res, 'companies');
    if (quotaError) return quotaError;
    const tenantId = String(req['apiTenantId'] ?? '');
    const ctx: TenantContext = { tenantId, actorId: null };
    return this.companiesService.findAll(ctx, query, { viaSearchEndpoint: true });
  }

  @Get('capabilities')
  capabilities() {
    return {
      product: 'VerifyIQ Public Sourcing API',
      version: 'v1',
      endpoints: [
        { method: 'GET', path: '/public/v1/sourcing/search', quota_bucket: 'companies' },
        { method: 'POST', path: '/public/v1/sourcing/compare', quota_bucket: 'companies' },
        { method: 'GET', path: '/public/v1/sourcing/quota', quota_bucket: 'companies' },
      ],
      auth: {
        header: 'x-api-key',
      },
    };
  }

  @Post('compare')
  async compare(
    @Req() req: Record<string, unknown>,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: CompareCompaniesDto,
  ) {
    const quotaError = await this.consumeQuota(req, res, 'companies');
    if (quotaError) return quotaError;
    const tenantId = String(req['apiTenantId'] ?? '');
    const ctx: TenantContext = { tenantId, actorId: null };
    return this.companiesService.compareCompanies(ctx, dto);
  }

  @Get('quota')
  async quota(@Req() req: Record<string, unknown>, @Res({ passthrough: true }) res: Response) {
    const tenantId = String(req['apiTenantId'] ?? '');
    const environment = String(req['apiKeyEnvironment'] ?? 'live') as 'live' | 'sandbox';
    const clientKey = String(req['apiKeyId'] ?? 'public-api-key');
    const quota = await this.apiQuotaService.readQuota({
      tenantId,
      environment,
      clientKey,
      bucket: 'companies',
    });
    res.setHeader('X-RateLimit-Limit', String(quota.limit));
    res.setHeader('X-RateLimit-Remaining', String(quota.remaining));
    return {
      environment,
      plan: quota.plan,
      limit: quota.limit,
      remaining: quota.remaining,
      used: quota.used,
    };
  }
}

