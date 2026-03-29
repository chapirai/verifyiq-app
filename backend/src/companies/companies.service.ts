import { GatewayTimeoutException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { ListCompaniesDto } from './dto/list-companies.dto';
import { CACHE_TTL_DAYS } from './services/bv-cache.service';
import { BolagsverketService } from './services/bolagsverket.service';
import { CachePolicyEvaluationService } from './services/cache-policy-evaluation.service';
import { RefreshDecisionService } from './services/refresh-decision.service';
import {
  LineageMetadataCaptureService,
} from './services/lineage-metadata-capture.service';
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

/**
 * Compute FreshnessStatus using policy-derived thresholds (hours → days).
 * Falls back to hardcoded defaults when policy is unavailable.
 */
function computeFreshness(
  ageDays: number,
  freshnessWindowHours = CACHE_TTL_DAYS * 24,
  maxAgeHours = STALE_THRESHOLD_DAYS * 24,
): FreshnessStatus {
  const freshnessWindowDays = freshnessWindowHours / 24;
  const maxAgeDays = maxAgeHours / 24;
  if (ageDays < freshnessWindowDays) return 'fresh';
  if (ageDays < maxAgeDays) return 'stale';
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
    private readonly cachePolicyEvaluationService: CachePolicyEvaluationService,
    private readonly refreshDecisionService: RefreshDecisionService,
    private readonly lineageCapture: LineageMetadataCaptureService,
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
    // P02-T06: Capture lineage metadata (best-effort; never throws).
    this.lineageCapture.capture({
      tenantId: ctx.tenantId,
      userId: ctx.actorId ?? null,
      correlationId,
      triggerType: LineageMetadataCaptureService.resolveTriggerType({
        forceRefresh: dto.force_refresh ?? false,
      }),
      httpMethod: 'POST',
      sourceEndpoint: '/companies/lookup',
      requestParameters: { orgNumber: dto.orgNumber, force_refresh: dto.force_refresh ?? false },
    }).catch((err) =>
      this.logger.warn(`[P02-T06] Lineage capture error: ${err}`),
    );

    // P02-T05: Emit a pre-enrich refresh decision for auditability and
    // downstream billing/quota hook points.  Note: dataAgeHours=0 is passed
    // here because the real cache age is not yet known at this stage — the
    // BolagsverketService resolves the actual cache state and re-evaluates
    // policy internally.  This call serves as an explicit orchestration hook
    // for quota checks and produces an audit trail of the intent to refresh.
    const refreshDecision = await this.refreshDecisionService.decide({
      tenantId: ctx.tenantId,
      dataAgeHours: 0,
      forceRefresh: dto.force_refresh ?? false,
      entityId: dto.orgNumber,
      entityType: 'company',
      correlationId,
      actorId: ctx.actorId ?? null,
    });

    this.logger.log(
      `[${correlationId}] [P02-T05] refresh decision: serve_from=${refreshDecision.serve_from} reason=${refreshDecision.reason}`,
    );

    const enrichPromise = this.bolagsverketService.enrichAndSave(
      ctx.tenantId,
      dto.orgNumber,
      dto.force_refresh ?? false,
      correlationId,
      ctx.actorId ?? null,
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

    // Resolve the effective policy for freshness metadata (best-effort; fallback to defaults)
    let freshnessWindowHours = CACHE_TTL_DAYS * 24;
    let maxAgeHours = STALE_THRESHOLD_DAYS * 24;
    try {
      const policy = await this.cachePolicyEvaluationService.getPolicyForTenant(ctx.tenantId);
      if (policy) {
        freshnessWindowHours = policy.freshnessWindowHours;
        maxAgeHours = policy.maxAgeHours;
      }
    } catch {
      // Non-blocking: safe to ignore — defaults are used
    }

    const metadata: CompanyMetadataDto = {
      source,
      fetched_at: fetchedAt,
      age_days: ageDays,
      freshness: computeFreshness(ageDays, freshnessWindowHours, maxAgeHours),
      cache_ttl_days: CACHE_TTL_DAYS,
      snapshot_id: snapshot.id,
      correlation_id: correlationId,
      policy_decision: snapshot.policyDecision ?? (isFromCache ? 'cache_hit' : 'fresh_fetch'),
    };

    const company = result.normalisedData as unknown as Record<string, unknown>;

    this.logger.log(
      `[${correlationId}] Lookup complete source=${source} age=${ageDays}d freshness=${metadata.freshness} snapshotId=${snapshot.id}`,
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
        snapshotId: snapshot.id,
        policyDecision: metadata.policy_decision,
        refreshDecision: {
          serve_from: refreshDecision.serve_from,
          reason: refreshDecision.reason,
          cost_flags: refreshDecision.cost_flags,
        },
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
