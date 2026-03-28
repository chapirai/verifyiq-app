import { GatewayTimeoutException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { ListCompaniesDto } from './dto/list-companies.dto';
import { CACHE_TTL_DAYS } from './services/bv-cache.service';
import { BolagsverketService } from './services/bolagsverket.service';
import {
  CompanyMetadataDto,
  FreshnessStatus,
  LookupCompanyDto,
  LookupCompanyResponseDto,
} from './dto/lookup-company.dto';
import { CompanyEntity } from './entities/company.entity';

/** Timeout for external Bolagsverket API calls (ms). */
const API_TIMEOUT_MS = 10_000;

/** Stale threshold: data older than TTL but within this window is 'stale'. */
const STALE_THRESHOLD_DAYS = CACHE_TTL_DAYS * 2; // 60 days

function computeFreshness(ageDays: number): FreshnessStatus {
  if (ageDays < CACHE_TTL_DAYS) return 'fresh';
  if (ageDays < STALE_THRESHOLD_DAYS) return 'stale';
  return 'expired';
}

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);

  /** In-flight API call promises for request deduplication. */
  private readonly inFlight = new Map<string, Promise<LookupCompanyResponseDto>>();

  constructor(
    private readonly auditService: AuditService,
    private readonly bolagsverketService: BolagsverketService,
    @InjectRepository(CompanyEntity)
    private readonly companyRepo: Repository<CompanyEntity>,
  ) {}

  /**
   * Main orchestration method for company lookup.
   * Checks DB cache first; falls back to Bolagsverket API on cache miss or force_refresh.
   * Deduplicates concurrent API calls for the same tenant + org number.
   */
  async orchestrateLookup(
    ctx: TenantContext,
    dto: LookupCompanyDto,
  ): Promise<LookupCompanyResponseDto> {
    const correlationId = randomUUID();
    this.logger.log(
      `[${correlationId}] orchestrateLookup tenant=${ctx.tenantId} orgNumber=${dto.orgNumber} forceRefresh=${dto.force_refresh ?? false}`,
    );

    const dedupeKey = `${ctx.tenantId}:${dto.orgNumber}`;

    // Deduplication: reuse an in-flight API call for the same org within this request window
    if (!dto.force_refresh && this.inFlight.has(dedupeKey)) {
      this.logger.log(`[${correlationId}] Reusing in-flight request for ${dedupeKey}`);
      return this.inFlight.get(dedupeKey)!;
    }

    const callPromise = this._doEnrich(ctx, dto, correlationId).finally(() => {
      this.inFlight.delete(dedupeKey);
    });

    this.inFlight.set(dedupeKey, callPromise);
    return callPromise;
  }

  private async _doEnrich(
    ctx: TenantContext,
    dto: LookupCompanyDto,
    correlationId: string,
  ): Promise<LookupCompanyResponseDto> {
    const enrichPromise = this.bolagsverketService.enrichAndSave(
      ctx.tenantId,
      dto.orgNumber,
      dto.force_refresh ?? false,
    );

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new GatewayTimeoutException('Bolagsverket API request timed out')),
        API_TIMEOUT_MS,
      ),
    );

    const { result, snapshot, isFromCache, ageInDays } = await Promise.race([
      enrichPromise,
      timeoutPromise,
    ]);

    const source = isFromCache ? 'DB' : 'API';
    const ageDays = ageInDays ?? 0;
    const fetchedAt = isFromCache
      ? snapshot.fetchedAt.toISOString()
      : result.retrievedAt;

    const metadata: CompanyMetadataDto = {
      source,
      fetched_at: fetchedAt,
      age_days: ageDays,
      freshness: computeFreshness(ageDays),
      cache_ttl_days: CACHE_TTL_DAYS,
    };

    const company = result.normalisedData as unknown as Record<string, unknown>;

    this.logger.log(
      `[${correlationId}] Lookup complete source=${source} age=${ageDays}d freshness=${metadata.freshness}`,
    );

    await this.auditService.log({
      tenantId: ctx.tenantId,
      actorId: ctx.actorId ?? null,
      action: 'company.lookup',
      resourceType: 'company',
      resourceId: dto.orgNumber,
      metadata: {
        correlationId,
        source,
        orgNumber: dto.orgNumber,
        ageDays,
        freshness: metadata.freshness,
        forceRefresh: dto.force_refresh ?? false,
      },
    });

    return { company, metadata };
  }

  /** @deprecated Use orchestrateLookup instead. Kept for backward compatibility. */
  async lookup(ctx: TenantContext, dto: LookupCompanyDto): Promise<LookupCompanyResponseDto> {
    return this.orchestrateLookup(ctx, dto);
  }

  /**
   * List companies for a tenant with optional fuzzy name search, exact org number
   * lookup, status filtering, and pagination.
   */
  async findAll(ctx: TenantContext, query: ListCompaniesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;

    const qb = this.companyRepo
      .createQueryBuilder('c')
      .select([
        'c.id',
        'c.organisationNumber',
        'c.legalName',
        'c.status',
        'c.createdAt',
        'c.updatedAt',
      ])
      .where('c.tenantId = :tenantId', { tenantId: ctx.tenantId });

    if (query.q) {
      qb.andWhere('c.legalName ILIKE :q', { q: `%${query.q}%` });
    }

    if (query.org_number) {
      qb.andWhere('c.organisationNumber = :orgNumber', { orgNumber: query.org_number });
    }

    if (query.status) {
      qb.andWhere('c.status = :status', { status: query.status });
    }

    const [data, total] = await qb.skip(offset).take(limit).getManyAndCount();

    await this.auditService.log({
      tenantId: ctx.tenantId,
      actorId: ctx.actorId ?? null,
      action: 'company.search',
      resourceType: 'company',
      resourceId: query.q ?? query.org_number ?? '*',
      metadata: {
        q: query.q ?? null,
        org_number: query.org_number ?? null,
        status: query.status ?? null,
        page,
        limit,
        total,
      },
    });

    return {
      data,
      total,
      page,
      limit,
      has_next: offset + data.length < total,
    };
  }

  /**
   * @todo Implement DB-backed company fetch by ID.
   * Currently always throws NotFoundException as this endpoint is not yet implemented.
   */
  async findOne(_ctx: TenantContext, _id: string) {
    throw new NotFoundException('Company not found');
  }
}
