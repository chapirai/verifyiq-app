import {
  GatewayTimeoutException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { In, Not, Repository } from 'typeorm';
import { AuditEventType } from '../audit/audit-event.entity';
import { AuditService } from '../audit/audit.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { FinancialStatementEntity } from '../financial/entities/financial-statement.entity';
import { OwnershipLinkEntity } from '../ownership/entities/ownership-link.entity';
import { ListCompaniesDto } from './dto/list-companies.dto';
import { CompareCompaniesDto } from './dto/compare-companies.dto';
import { CACHE_TTL_DAYS, BvCacheService } from './services/bv-cache.service';
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
import { CompanySignalEntity } from './entities/company-signal.entity';
import { BvFetchSnapshotEntity, SnapshotPolicyDecision } from './entities/bv-fetch-snapshot.entity';
import { FailureStateService } from './services/failure-state.service';
import { CompanySourcingProfileService } from './services/company-sourcing-profile.service';
import { NormalisedCompany } from './integrations/bolagsverket.mapper';
import {
  DocumentListResponse,
  HighValueDatasetResponse,
  OrganisationInformationResponse,
  OrganisationsengagemangResponse,
  PersonResponse,
  VerkligaHuvudmanRegisterResponse,
} from './integrations/bolagsverket.types';

/** Timeout for external Bolagsverket API calls (ms). */
const API_TIMEOUT_MS = 10_000;

/** Stale threshold: data older than TTL but within this window is 'stale'. */
const STALE_THRESHOLD_DAYS = CACHE_TTL_DAYS * 2; // 60 days
const MS_PER_HOUR = 1000 * 60 * 60;
const COMPARE_CACHE_TTL_MS = 2 * 60 * 1000;

type EnrichResponse = Awaited<ReturnType<BolagsverketService['enrichAndSave']>>;

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

const SIMILAR_MODES = ['form', 'industry', 'financial', 'ownership'] as const;
type SimilarMode = (typeof SIMILAR_MODES)[number];

function parseSimilarMode(raw?: string): SimilarMode {
  const m = (raw ?? 'form').toLowerCase();
  return (SIMILAR_MODES as readonly string[]).includes(m) ? (m as SimilarMode) : 'form';
}

/** First chunk of verksamhetsbeskrivning for overlap search (no LLM). */
function industrySnippet(text: string | null | undefined): string | null {
  if (!text) return null;
  const t = text.normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (t.length < 8) return null;
  return t.slice(0, 96);
}

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);

  /** In-flight API call promises for request deduplication. */
  private readonly inFlight = new Map<string, Promise<LookupCompanyResponseDto>>();
  private readonly compareCache = new Map<string, { expiresAt: number; value: unknown }>();
  private readonly searchCache = new Map<string, { expiresAt: number; value: unknown }>();
  private readonly searchLatencyMs: number[] = [];

  constructor(
    private readonly auditService: AuditService,
    private readonly bolagsverketService: BolagsverketService,
    private readonly cachePolicyEvaluationService: CachePolicyEvaluationService,
    private readonly refreshDecisionService: RefreshDecisionService,
    private readonly failureStateService: FailureStateService,
    private readonly bvCacheService: BvCacheService,
    private readonly lineageCapture: LineageMetadataCaptureService,
    @InjectRepository(CompanyEntity)
    private readonly companyRepo: Repository<CompanyEntity>,
    @InjectRepository(FinancialStatementEntity)
    private readonly financialStatementRepo: Repository<FinancialStatementEntity>,
    @InjectRepository(OwnershipLinkEntity)
    private readonly ownershipLinkRepo: Repository<OwnershipLinkEntity>,
    @InjectRepository(CompanySignalEntity)
    private readonly companySignalRepo: Repository<CompanySignalEntity>,
    private readonly sourcingProfileService: CompanySourcingProfileService,
  ) {}

  async compareCompanies(ctx: TenantContext, dto: CompareCompaniesDto) {
    const uniqueOrgs = Array.from(
      new Set(
        (dto.organisationNumbers ?? [])
          .map((x) => x.replace(/\D/g, ''))
          .filter((x) => x.length === 10 || x.length === 12),
      ),
    ).slice(0, 8);
    if (uniqueOrgs.length < 2) {
      return { data: [], summary: { compared: 0, reason: 'need_at_least_two_valid_orgs' } };
    }
    const cacheKey = `${ctx.tenantId}::${(dto.years ?? 4).toString()}::${uniqueOrgs.join(',')}`;
    const cached = this.compareCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as {
        data: unknown[];
        summary: { compared: number; orgs: string[] };
      };
    }

    const [companies, ownershipAgg, financialRows, signalRows] = await Promise.all([
      this.companyRepo.find({
        where: { tenantId: ctx.tenantId, organisationNumber: In(uniqueOrgs) },
        select: [
          'id',
          'organisationNumber',
          'legalName',
          'status',
          'companyForm',
          'countryCode',
          'updatedAt',
          'businessDescription',
        ],
      }),
      this.ownershipLinkRepo
        .createQueryBuilder('ol')
        .select('ol.ownedOrganisationNumber', 'org')
        .addSelect('COUNT(1)', 'edges')
        .where('ol.tenantId = :tenantId', { tenantId: ctx.tenantId })
        .andWhere('ol.ownedOrganisationNumber IN (:...orgs)', { orgs: uniqueOrgs })
        .andWhere('ol.isCurrent = true')
        .groupBy('ol.ownedOrganisationNumber')
        .getRawMany<{ org: string; edges: string }>(),
      this.financialStatementRepo.find({
        where: { tenantId: ctx.tenantId, organisationNumber: In(uniqueOrgs) },
        order: { fiscalYearEnd: 'DESC', updatedAt: 'DESC' },
      }),
      this.companySignalRepo
        .createQueryBuilder('s')
        .distinctOn(['s.organisationNumber', 's.signalType'])
        .where('s.tenantId = :tenantId', { tenantId: ctx.tenantId })
        .andWhere('s.organisationNumber IN (:...orgs)', { orgs: uniqueOrgs })
        .orderBy('s.organisationNumber', 'ASC')
        .addOrderBy('s.signalType', 'ASC')
        .addOrderBy('s.computedAt', 'DESC')
        .getMany(),
    ]);

    const companyByOrg = new Map(companies.map((c) => [c.organisationNumber, c]));
    const ownershipByOrg = new Map(ownershipAgg.map((r) => [r.org, Number(r.edges) || 0]));
    const financialByOrg = new Map<string, FinancialStatementEntity[]>();
    for (const r of financialRows) {
      const curr = financialByOrg.get(r.organisationNumber) ?? [];
      curr.push(r);
      financialByOrg.set(r.organisationNumber, curr);
    }
    const signalsByOrg = new Map<string, CompanySignalEntity[]>();
    for (const s of signalRows) {
      const curr = signalsByOrg.get(s.organisationNumber) ?? [];
      curr.push(s);
      signalsByOrg.set(s.organisationNumber, curr);
    }

    const profiles = await this.sourcingProfileService.ensureProfiles(ctx.tenantId, uniqueOrgs);
    const ownershipRiskByOrg = new Map<string, number>(
      profiles.map((p) => [p.organisationNumber, Number(p.ownershipRiskScore) || 0]),
    );

    const data = uniqueOrgs.map((org) => {
      const c = companyByOrg.get(org);
      const fs = financialByOrg.get(org) ?? [];
      const latest = fs[0];
      const sig = signalsByOrg.get(org) ?? [];
      return {
        organisationNumber: org,
        company: c
          ? {
              legalName: c.legalName,
              status: c.status ?? null,
              companyForm: c.companyForm ?? null,
              countryCode: c.countryCode,
              updatedAt: c.updatedAt,
              businessDescription: c.businessDescription ?? null,
            }
          : null,
        ownership: {
          currentEdges: ownershipByOrg.get(org) ?? 0,
          ownershipRiskScore: ownershipRiskByOrg.get(org) ?? 0,
        },
        financials: latest
          ? {
              fiscalYear: latest.fiscalYear,
              revenue: latest.revenue,
              netResult: latest.netResult,
              totalAssets: latest.totalAssets,
              totalEquity: latest.totalEquity,
              equityRatio:
                latest.totalAssets && Number(latest.totalAssets) !== 0 && latest.totalEquity
                  ? Number(latest.totalEquity) / Number(latest.totalAssets)
                  : null,
              statementsCount: fs.length,
            }
          : {
              fiscalYear: null,
              revenue: null,
              netResult: null,
              totalAssets: null,
              totalEquity: null,
              equityRatio: null,
              statementsCount: 0,
            },
        signals: sig.map((x) => ({
          signalType: x.signalType,
          score: x.score != null ? Number(x.score) : null,
          engineVersion: x.engineVersion,
          computedAt: x.computedAt,
          explanation: x.explanation,
        })),
      };
    });

    await this.auditService.log({
      tenantId: ctx.tenantId,
      actorId: ctx.actorId ?? null,
      action: 'company.compare',
      resourceType: 'company',
      resourceId: uniqueOrgs.join(','),
      metadata: { compared: data.length, orgs: uniqueOrgs },
    });
    const response = { data, summary: { compared: data.length, orgs: uniqueOrgs } };
    this.compareCache.set(cacheKey, { expiresAt: Date.now() + COMPARE_CACHE_TTL_MS, value: response });
    return response;
  }

  async getDecisionInsight(ctx: TenantContext, organisationNumberRaw: string) {
    const organisationNumber = organisationNumberRaw.replace(/\D/g, '');
    if (organisationNumber.length !== 10 && organisationNumber.length !== 12) {
      throw new NotFoundException('Invalid organisation number');
    }
    const company = await this.companyRepo.findOne({ where: { tenantId: ctx.tenantId, organisationNumber } });
    if (!company) throw new NotFoundException('Company not found');
    const [latestSignals, latestFinancial, ownershipEdges] = await Promise.all([
      this.companySignalRepo
        .createQueryBuilder('s')
        .distinctOn(['s.signalType'])
        .where('s.tenantId = :tenantId', { tenantId: ctx.tenantId })
        .andWhere('s.organisationNumber = :organisationNumber', { organisationNumber })
        .orderBy('s.signalType', 'ASC')
        .addOrderBy('s.computedAt', 'DESC')
        .getMany(),
      this.financialStatementRepo.findOne({
        where: { tenantId: ctx.tenantId, organisationNumber },
        order: { fiscalYearEnd: 'DESC', updatedAt: 'DESC' },
      }),
      this.ownershipLinkRepo.count({
        where: { tenantId: ctx.tenantId, ownedOrganisationNumber: organisationNumber, isCurrent: true },
      }),
    ]);
    const scoreOf = (type: string) =>
      latestSignals.find((s) => s.signalType === type)?.score != null
        ? Number(latestSignals.find((s) => s.signalType === type)!.score)
        : null;
    const acquisition = scoreOf('acquisition_likelihood');
    const stress = scoreOf('financial_stress');
    const readiness = scoreOf('seller_readiness');
    const complexity = scoreOf('compliance_ownership_complexity');

    const drivers = [
      { key: 'acquisition_likelihood', value: acquisition, meaning: 'Higher means stronger deal attractiveness proxy.' },
      { key: 'financial_stress', value: stress, meaning: 'Higher means greater risk of distress / downside.' },
      { key: 'seller_readiness', value: readiness, meaning: 'Higher means greater near-term transactability proxy.' },
      { key: 'compliance_ownership_complexity', value: complexity, meaning: 'Higher means greater diligence complexity.' },
      {
        key: 'ownership_edges_current',
        value: ownershipEdges,
        meaning: 'Count of current ownership edges touching this company as owned node.',
      },
      {
        key: 'latest_financial_statement_year',
        value: latestFinancial?.fiscalYear ?? null,
        meaning: 'Recency of parsed financial statement evidence.',
      },
    ];

    let recommendedAction = 'Monitor';
    if ((acquisition ?? 0) >= 70 && (stress ?? 100) <= 45) recommendedAction = 'Prioritize outreach';
    else if ((stress ?? 0) >= 70) recommendedAction = 'High-risk diligence';
    else if ((readiness ?? 0) >= 65) recommendedAction = 'Prepare approach hypothesis';

    const fmt = (n: number | null) => (n == null || !Number.isFinite(n) ? 'n/a' : n.toFixed(1));
    const summary = `${company.legalName}: acquisition ${fmt(acquisition)}, stress ${fmt(stress)}, readiness ${fmt(readiness)} — ${recommendedAction.toLowerCase()}.`;
    const confidence =
      latestSignals.length >= 4 && latestFinancial != null ? 'high' : latestSignals.length >= 2 ? 'medium' : 'low';

    return {
      organisation_number: organisationNumber,
      legal_name: company.legalName,
      summary,
      recommended_action: recommendedAction,
      confidence,
      drivers,
      generated_at: new Date().toISOString(),
    };
  }

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
    const orgId = dto.identitetsbeteckning ?? dto.orgNumber ?? '';
    this.logger.log(
      `[${correlationId}] orchestrateLookup tenant=${ctx.tenantId} identitetsbeteckning=${orgId} forceRefresh=${dto.force_refresh ?? false}`,
    );

    const dedupeKey = `${ctx.tenantId}:${orgId}`;

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
    const actorId = ctx.actorId ?? null;
    const orgId = dto.identitetsbeteckning ?? dto.orgNumber ?? '';
    const lookupMetadata = {
      identitetsbeteckning: orgId,
      forceRefresh: dto.force_refresh ?? false,
    };

    void this.auditService.emitAuditEvent({
      tenantId: ctx.tenantId,
      userId: actorId,
      eventType: AuditEventType.LOOKUP_INITIATED,
      action: 'company.lookup',
      status: 'initiated',
      resourceId: orgId,
      correlationId,
      metadata: lookupMetadata,
    });

    // P02-T06: Capture lineage metadata (best-effort; never throws).
    this.lineageCapture.capture({
      tenantId: ctx.tenantId,
      userId: actorId,
      correlationId,
      triggerType: LineageMetadataCaptureService.resolveTriggerType({
        forceRefresh: dto.force_refresh ?? false,
      }),
      httpMethod: 'POST',
      sourceEndpoint: '/companies/lookup',
      requestParameters: { identitetsbeteckning: orgId, force_refresh: dto.force_refresh ?? false },
    }).catch((err) =>
      this.logger.warn(`[P02-T06] Lineage capture error: ${err}`),
    );

    // P02-T05: Emit a pre-enrich refresh decision for auditability and
    // downstream billing/quota hook points.  Note: dataAgeHours=0 is passed
    // here because the real cache age is not yet known at this stage — the
    // BolagsverketService resolves the actual cache state and re-evaluates
    // policy internally.  This call serves as an explicit orchestration hook
    // for quota checks and produces an audit trail of the intent to refresh.
    let refreshDecision: Awaited<ReturnType<RefreshDecisionService['decide']>> | null = null;
    let fallbackUsed = false;
    let failureStateLabel: string | null = null;
    const recoveryStatus = await this.failureStateService.getRecoveryStatusForEntity(
      ctx.tenantId,
      'company',
      orgId,
    );
    const isApiAvailable = recoveryStatus.canRetry;

    try {
      refreshDecision = await this.refreshDecisionService.decide({
        tenantId: ctx.tenantId,
        dataAgeHours: 0,
        forceRefresh: dto.force_refresh ?? false,
        entityId: orgId,
        entityType: 'company',
        correlationId,
        actorId,
        isApiAvailable,
      });

      this.logger.log(
        `[${correlationId}] [P02-T05] refresh decision: serve_from=${refreshDecision.serve_from} reason=${refreshDecision.reason}`,
      );

      let result: Awaited<ReturnType<BolagsverketService['enrichAndSave']>>['result'];
      let snapshot: Awaited<ReturnType<BolagsverketService['enrichAndSave']>>['snapshot'];
      let isFromCache = false;
      let ageInDays: number | null = null;
      let policyDecisionOverride: SnapshotPolicyDecision | null = null;

      if (!isApiAvailable) {
        const fallback = await this._attemptStaleFallback(
          ctx.tenantId,
          orgId,
          correlationId,
          actorId,
          recoveryStatus.failureReason ?? 'provider_unavailable_backoff',
        );
        if (fallback) {
          ({ result, snapshot, isFromCache, ageInDays } = fallback);
          fallbackUsed = true;
          failureStateLabel = 'DEGRADED';
          policyDecisionOverride = 'stale_fallback';
          await this.failureStateService.recordFailure({
            tenantId: ctx.tenantId,
            entityType: 'company',
            entityId: orgId,
            failureState: recoveryStatus.state,
            failureReason: recoveryStatus.failureReason ?? 'provider_unavailable_backoff',
            isRecoverable: recoveryStatus.isRecoverable,
            fallbackUsed: true,
            staleDataTimestamp: snapshot.fetchedAt,
            correlationId,
            actorId,
            incrementRetry: false,
          });
          void this.auditService.emitAuditEvent({
            tenantId: ctx.tenantId,
            userId: actorId,
            eventType: AuditEventType.STALE_SERVED,
            action: 'company.cache',
            status: 'provider_unavailable_backoff',
            resourceId: orgId,
            correlationId,
            metadata: {
              ...lookupMetadata,
              failureState: recoveryStatus.state,
              failureReason: recoveryStatus.failureReason ?? 'provider_unavailable_backoff',
            },
          });
        } else {
          await this.failureStateService.recordFailure({
            tenantId: ctx.tenantId,
            entityType: 'company',
            entityId: orgId,
            failureState: 'NO_DATA_AVAILABLE',
            failureReason: recoveryStatus.failureReason ?? 'provider_unavailable_backoff',
            isRecoverable: recoveryStatus.isRecoverable,
            fallbackUsed: false,
            staleDataTimestamp: null,
            correlationId,
            actorId,
            incrementRetry: false,
          });
          throw new ServiceUnavailableException('Provider unavailable and no cached data available');
        }
      } else {
        const enrichPromise = this.bolagsverketService.enrichAndSave(
          ctx.tenantId,
          orgId,
          dto.force_refresh ?? false,
          correlationId,
          actorId,
        );

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new GatewayTimeoutException('Bolagsverket API request timed out')),
            API_TIMEOUT_MS,
          ),
        );

        try {
          const enrichResult = await Promise.race([enrichPromise, timeoutPromise]);
          result = enrichResult.result;
          snapshot = enrichResult.snapshot;
          isFromCache = enrichResult.isFromCache;
          ageInDays = enrichResult.ageInDays;
          if (!isFromCache && snapshot.fetchStatus === 'success') {
            await this.failureStateService.recordSuccess({
              tenantId: ctx.tenantId,
              entityType: 'company',
              entityId: orgId,
              correlationId,
              actorId,
            });
          }
        } catch (err) {
          const classification = this.failureStateService.classifyFailure(err);
          const fallback = await this._attemptStaleFallback(
            ctx.tenantId,
            orgId,
            correlationId,
            actorId,
            classification.failureReason,
          );
          if (!fallback) {
            await this.failureStateService.recordFailure({
              tenantId: ctx.tenantId,
              entityType: 'company',
              entityId: orgId,
              failureState: 'NO_DATA_AVAILABLE',
              failureReason: classification.failureReason,
              isRecoverable: classification.isRecoverable,
              fallbackUsed: false,
              staleDataTimestamp: null,
              correlationId,
              actorId,
            });
            throw err;
          }

          ({ result, snapshot, isFromCache, ageInDays } = fallback);
          fallbackUsed = true;
          failureStateLabel = 'DEGRADED';
          policyDecisionOverride = 'stale_fallback';

          await this.failureStateService.recordFailure({
            tenantId: ctx.tenantId,
            entityType: 'company',
            entityId: orgId,
            failureState: classification.failureState,
            failureReason: classification.failureReason,
            isRecoverable: classification.isRecoverable,
            fallbackUsed: true,
            staleDataTimestamp: snapshot.fetchedAt,
            correlationId,
            actorId,
          });
          void this.auditService.emitAuditEvent({
            tenantId: ctx.tenantId,
            userId: actorId,
            eventType: AuditEventType.STALE_SERVED,
            action: 'company.cache',
            status: 'provider_failure_fallback',
            resourceId: orgId,
            correlationId,
            metadata: {
              ...lookupMetadata,
              failureState: classification.failureState,
              failureReason: classification.failureReason,
            },
          });
        }
      }

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

      const policyDecision =
        policyDecisionOverride ??
        snapshot.policyDecision ??
        (isFromCache ? 'cache_hit' : 'fresh_fetch');
      const degraded = policyDecision === 'stale_fallback' || fallbackUsed;
      const resolvedFailureState = degraded ? failureStateLabel ?? 'DEGRADED' : null;
      const hasHvdData = result.highValueDataset != null;
      const hasForetagsinfoData = Array.isArray(result.organisationInformation) && result.organisationInformation.length > 0;
      const hasVerkligaHuvudmanData =
        result.verkligaHuvudman != null &&
        result.verkligaHuvudman.organisation != null &&
        typeof result.verkligaHuvudman.organisation.identitetsbeteckning === 'string';
      const metadata: CompanyMetadataDto = {
        source,
        fetched_at: fetchedAt,
        age_days: ageDays,
        freshness: computeFreshness(ageDays, freshnessWindowHours, maxAgeHours),
        cache_ttl_days: CACHE_TTL_DAYS,
        snapshot_id: snapshot.id,
        correlation_id: correlationId,
        policy_decision: policyDecision,
        degraded,
        failure_state: resolvedFailureState,
        has_hvd_data: hasHvdData,
        has_foretagsinfo_data: hasForetagsinfoData,
        has_verkliga_huvudman_data: hasVerkligaHuvudmanData,
        profile_completeness: hasHvdData && hasForetagsinfoData ? 'complete' : 'partial',
      };

      const company = result.normalisedData as unknown as Record<string, unknown>;

      this.logger.log(
        `[${correlationId}] Lookup complete source=${source} age=${ageDays}d freshness=${metadata.freshness} snapshotId=${snapshot.id}`,
      );

      await this.auditService.log({
        tenantId: ctx.tenantId,
        actorId,
        action: 'company.lookup',
        resourceType: 'company',
        resourceId: orgId,
        metadata: {
          correlationId,
          source,
          identitetsbeteckning: orgId,
          ageDays,
          freshness: metadata.freshness,
          forceRefresh: dto.force_refresh ?? false,
          snapshotId: snapshot.id,
          policyDecision: metadata.policy_decision,
          refreshDecision: refreshDecision
            ? {
                serve_from: refreshDecision.serve_from,
                reason: refreshDecision.reason,
                cost_flags: refreshDecision.cost_flags,
              }
            : null,
        },
      });

      const costImpact = {
        source,
        provider_call: !isFromCache,
        api_call_count: snapshot.apiCallCount ?? 0,
        force_refresh: dto.force_refresh ?? false,
        policy_decision: metadata.policy_decision,
        refresh_cost_flags: refreshDecision?.cost_flags ?? {},
        snapshot_cost_flags: snapshot.costImpactFlags ?? {},
      };

      void this.auditService.emitAuditEvent({
        tenantId: ctx.tenantId,
        userId: actorId,
        eventType: AuditEventType.LOOKUP_COMPLETED,
        action: 'company.lookup',
        status: 'success',
        resourceId: orgId,
        correlationId,
        costImpact,
        metadata: {
          ...lookupMetadata,
          source,
          cacheDecision: metadata.policy_decision,
          providerCall: !isFromCache,
          resultStatus: snapshot.fetchStatus,
          snapshotId: snapshot.id,
        },
      });

      void this.auditService.emitUsageEvent({
        tenantId: ctx.tenantId,
        userId: actorId,
        eventType: AuditEventType.LOOKUP_COMPLETED,
        action: 'company.lookup',
        status: 'success',
        resourceId: orgId,
        correlationId,
        costImpact,
        metadata: {
          source,
          snapshotId: snapshot.id,
        },
      });

      return { company, metadata };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      void this.auditService.emitAuditEvent({
        tenantId: ctx.tenantId,
        userId: actorId,
        eventType: AuditEventType.LOOKUP_COMPLETED,
        action: 'company.lookup',
        status: 'error',
        resourceId: orgId,
        correlationId,
        costImpact: {
          force_refresh: dto.force_refresh ?? false,
          refresh_cost_flags: refreshDecision?.cost_flags ?? {},
        },
        metadata: {
          ...lookupMetadata,
          resultStatus: 'error',
          error: errorMessage,
        },
      });

      void this.auditService.emitUsageEvent({
        tenantId: ctx.tenantId,
        userId: actorId,
        eventType: AuditEventType.LOOKUP_COMPLETED,
        action: 'company.lookup',
        status: 'error',
        resourceId: orgId,
        correlationId,
        costImpact: {
          force_refresh: dto.force_refresh ?? false,
        },
        metadata: {
          error: errorMessage,
        },
      });

      throw err;
    }
  }

  private async _attemptStaleFallback(
    tenantId: string,
    orgNumber: string,
    correlationId: string,
    actorId: string | null,
    failureReason: string,
  ): Promise<EnrichResponse | null> {
    const cacheCheck = await this.bvCacheService.checkFreshness(tenantId, orgNumber);
    if (!cacheCheck || !cacheCheck.snapshot) return null;

    const ageHours = (Date.now() - cacheCheck.snapshot.fetchedAt.getTime()) / MS_PER_HOUR;

    let staleFallbackAllowed = true;
    try {
      const policyResult = await this.cachePolicyEvaluationService.evaluate(
        tenantId,
        ageHours,
        {
          entityType: 'company',
          entityId: orgNumber,
          correlationId,
          actorId,
          orgNumber,
        },
      );
      staleFallbackAllowed = policyResult.staleFallbackAllowed;
    } catch (policyErr) {
      this.logger.warn(
        `[P02-T10] Policy evaluation failed while attempting stale fallback for ${orgNumber}; defaulting to allow. ${policyErr}`,
      );
      staleFallbackAllowed = true;
    }

    if (!staleFallbackAllowed) {
      this.logger.warn(
        `[P02-T10] Stale fallback disallowed by policy for ${orgNumber}. Failure reason: ${failureReason}`,
      );
      return null;
    }

    const updatedSnapshot: BvFetchSnapshotEntity = {
      ...cacheCheck.snapshot,
      policyDecision: 'stale_fallback',
      isStaleFallback: true,
    };

    const rawSummary = (updatedSnapshot.rawPayloadSummary ?? {}) as Record<string, unknown>;
    const fallbackResult: EnrichResponse['result'] = {
      normalisedData: updatedSnapshot.normalisedSummary as unknown as NormalisedCompany,
      highValueDataset:
        (rawSummary.highValueDataset as HighValueDatasetResponse | undefined) ?? null,
      organisationInformation:
        (rawSummary.organisationInformation as OrganisationInformationResponse[] | undefined) ?? [],
      documents: (rawSummary.documents as DocumentListResponse | undefined) ?? null,
      verkligaHuvudman:
        (rawSummary.verkligaHuvudman as VerkligaHuvudmanRegisterResponse | undefined) ?? null,
      retrievedAt: updatedSnapshot.fetchedAt.toISOString(),
      vhRequestId: null,
      organisationEngagementsAggregated:
        (rawSummary.organisationEngagementsAggregated as OrganisationsengagemangResponse | undefined) ?? null,
      relatedPersonInformation:
        (rawSummary.relatedPersonInformation as Record<string, PersonResponse> | undefined) ?? undefined,
      bolagsverketApiCallCount: updatedSnapshot.apiCallCount ?? 0,
    };

    return {
      result: fallbackResult,
      snapshot: updatedSnapshot,
      isFromCache: true,
      ageInDays: cacheCheck.ageInDays,
    };
  }

  /** @deprecated Use orchestrateLookup instead. Kept for backward compatibility. */
  async lookup(ctx: TenantContext, dto: LookupCompanyDto): Promise<LookupCompanyResponseDto> {
    return this.orchestrateLookup(ctx, dto);
  }

  /**
   * List companies for a tenant with optional fuzzy name search, exact org number
   * lookup, status filtering, and pagination.
   */
  async findAll(ctx: TenantContext, query: ListCompaniesDto, opts?: { viaSearchEndpoint?: boolean }) {
    const started = Date.now();
    const cacheKey = `${ctx.tenantId}:${JSON.stringify(query)}:${opts?.viaSearchEndpoint ? 'search' : 'list'}`;
    const cached = this.searchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      this.searchLatencyMs.push(Date.now() - started);
      if (this.searchLatencyMs.length > 300) this.searchLatencyMs.shift();
      const payload = cached.value as {
        data: unknown[];
        total: number;
        page: number;
        limit: number;
        has_next: boolean;
        perf?: { elapsed_ms: number; cache_hit: boolean };
      };
      return {
        ...payload,
        perf: {
          elapsed_ms: Date.now() - started,
          cache_hit: true,
        },
      };
    }
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
        'c.companyForm',
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

    const cfRaw = (query.company_form_contains ?? '').replace(/%/g, '').trim();
    if (cfRaw.length > 0) {
      qb.andWhere('c.companyForm ILIKE :cf', { cf: `%${cfRaw}%` });
    }

    const indRaw = (query.industry_contains ?? '').replace(/%/g, '').trim();
    if (indRaw.length > 0) {
      qb.andWhere('c.businessDescription ILIKE :ind', { ind: `%${indRaw}%` });
    }

    if (query.country_code) {
      qb.andWhere('c.countryCode = :cc', { cc: query.country_code });
    }

    if (query.has_financial_reports === true) {
      qb.andWhere('jsonb_array_length(c.financialReports) > 0');
    } else if (query.has_financial_reports === false) {
      qb.andWhere('jsonb_array_length(c.financialReports) = 0');
    }

    const offRaw = (query.officer_role_contains ?? '').replace(/%/g, '').trim();
    if (offRaw.length > 0) {
      qb.andWhere('CAST(c.officers AS text) ILIKE :off', { off: `%${offRaw}%` });
    }

    const sortFieldMap: Record<string, string> = {
      updatedAt: 'c.updatedAt',
      legalName: 'c.legalName',
      createdAt: 'c.createdAt',
    };
    const sortBy = query.sort_by ?? 'updatedAt';
    const sortDir = (query.sort_dir ?? 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const dealMode = query.deal_mode;

    if (sortBy === 'sourcing_rank' && !dealMode) {
      const rankExpr = `(
          (CASE WHEN COALESCE((c.source_payload_summary->>'hasHighValueDataset'), '') = 'true' THEN 3 ELSE 0 END) +
          (CASE WHEN COALESCE((c.source_payload_summary->>'hasRichOrganisationInformation'), '') = 'true' THEN 3 ELSE 0 END) +
          (CASE WHEN c.business_description IS NOT NULL AND length(trim(c.business_description)) >= 24 THEN 2 ELSE 0 END) +
          (CASE WHEN c.company_form IS NOT NULL AND length(trim(c.company_form)) > 0 THEN 1 ELSE 0 END)
        )`;
      qb.orderBy(rankExpr, 'DESC').addOrderBy('c.updatedAt', 'DESC').addOrderBy('c.id', 'DESC');
    } else if (sortBy !== 'ownership_risk' && !dealMode) {
      const sortField = sortFieldMap[sortBy] ?? 'c.updatedAt';
      qb.orderBy(sortField, sortDir).addOrderBy('c.id', 'DESC');
    }
    const needsAdvancedScoring = sortBy === 'ownership_risk' || !!dealMode;
    let data: Array<Record<string, unknown>> = [];
    let total = 0;
    if (!needsAdvancedScoring) {
      const [rows, count] = await qb.skip(offset).take(limit).getManyAndCount();
      data = rows as unknown as Array<Record<string, unknown>>;
      total = count;
    } else {
      const candidateLimit = Math.max(limit * 10, 120);
      const candidates = await qb
        .clone()
        .orderBy('c.updatedAt', 'DESC')
        .addOrderBy('c.id', 'DESC')
        .take(candidateLimit)
        .getMany();
      total = await qb.clone().getCount();
      const orgs = candidates.map((c) => c.organisationNumber);
      const profiles = await this.sourcingProfileService.ensureProfiles(ctx.tenantId, orgs);
      const profileByOrg = new Map(profiles.map((p) => [p.organisationNumber, p]));
      const scored = await Promise.all(
        candidates.map(async (c) => {
          const profile = profileByOrg.get(c.organisationNumber);
          const ownershipRiskScore = Number(profile?.ownershipRiskScore ?? 0);
          const modeScores = (profile?.dealModeScores ?? {}) as Record<string, unknown>;
          const modeRationale = (profile?.dealModeRationale ?? {}) as Record<string, unknown>;
          const dealModeScore = dealMode ? Number(modeScores[dealMode] ?? 0) : null;
          const dealModeRationale = dealMode ? ((modeRationale[dealMode] as unknown[]) ?? []) : [];
          return {
            ...c,
            ownershipRiskScore,
            dealMode: dealMode ?? null,
            dealModeScore,
            dealModeRationale,
          };
        }),
      );
      scored.sort((a, b) => {
        if (dealMode) {
          return Number(b.dealModeScore ?? 0) - Number(a.dealModeScore ?? 0) || b.updatedAt.getTime() - a.updatedAt.getTime();
        }
        return Number(b.ownershipRiskScore ?? 0) - Number(a.ownershipRiskScore ?? 0) || b.updatedAt.getTime() - a.updatedAt.getTime();
      });
      data = scored.slice(offset, offset + limit);
    }

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
        company_form_contains: cfRaw || null,
        industry_contains: indRaw || null,
        country_code: query.country_code ?? null,
        has_financial_reports: query.has_financial_reports ?? null,
        officer_role_contains: offRaw || null,
        via: opts?.viaSearchEndpoint ? 'companies/search' : 'companies',
        deal_mode: dealMode ?? null,
        sort_by: query.sort_by ?? 'updatedAt',
        sort_dir: query.sort_dir ?? 'desc',
        page,
        limit,
        total,
      },
    });

    const elapsedMs = Date.now() - started;
    this.searchLatencyMs.push(elapsedMs);
    if (this.searchLatencyMs.length > 300) this.searchLatencyMs.shift();
    const response = {
      data,
      total,
      page,
      limit,
      has_next: offset + data.length < total,
      perf: {
        elapsed_ms: elapsedMs,
        cache_hit: false,
      },
    };
    this.searchCache.set(cacheKey, { expiresAt: Date.now() + 30_000, value: response });
    return response;
  }

  getSearchPerformance() {
    const arr = [...this.searchLatencyMs].sort((a, b) => a - b);
    const pick = (q: number) => (arr.length === 0 ? 0 : arr[Math.min(arr.length - 1, Math.floor(arr.length * q))]);
    return {
      samples: arr.length,
      p50_ms: pick(0.5),
      p95_ms: pick(0.95),
      p99_ms: pick(0.99),
      target_ms: 200,
      target_met_p95: arr.length > 0 ? pick(0.95) <= 200 : null,
    };
  }

  /**
   * Phase 4 sourcing: similar companies (tenant index). Modes:
   * - `form` — same `company_form` as anchor (default)
   * - `industry` — overlap on opening of `business_description` (ILIKE)
   * - `financial` — closest `jsonb_array_length(financial_reports)` among companies with reports
   * - `ownership` — closest officer count among companies with at least one officer row
   */
  async findSimilarCompanies(
    ctx: TenantContext,
    organisationNumber: string,
    limit = 10,
    modeRaw?: string,
  ) {
    const mode = parseSimilarMode(modeRaw);
    const norm = organisationNumber.replace(/\D/g, '');
    if (norm.length !== 10 && norm.length !== 12) {
      return {
        data: [] as CompanyEntity[],
        total: 0,
        anchorOrganisationNumber: norm,
        strategy: 'invalid_org' as const,
        companyForm: null as string | null,
        mode,
      };
    }

    const ref = await this.companyRepo.findOne({
      where: { tenantId: ctx.tenantId, organisationNumber: norm },
    });
    if (!ref) {
      return {
        data: [] as CompanyEntity[],
        total: 0,
        anchorOrganisationNumber: norm,
        strategy: 'not_indexed' as const,
        companyForm: null as string | null,
        mode,
      };
    }

    const take = Math.min(Math.max(limit, 1), 50);
    const baseSelect = [
      'c.id',
      'c.organisationNumber',
      'c.legalName',
      'c.status',
      'c.companyForm',
      'c.createdAt',
      'c.updatedAt',
    ] as const;

    if (mode === 'form') {
      const form = ref.companyForm?.trim();
      if (!form) {
        return {
          data: [] as CompanyEntity[],
          total: 0,
          anchorOrganisationNumber: norm,
          strategy: 'no_company_form' as const,
          companyForm: null as string | null,
          mode,
        };
      }
      const [data, total] = await this.companyRepo.findAndCount({
        where: {
          tenantId: ctx.tenantId,
          companyForm: form,
          organisationNumber: Not(norm),
        },
        order: { updatedAt: 'DESC' },
        take,
        select: [
          'id',
          'organisationNumber',
          'legalName',
          'status',
          'companyForm',
          'createdAt',
          'updatedAt',
        ],
      });
      await this.auditService.log({
        tenantId: ctx.tenantId,
        actorId: ctx.actorId ?? null,
        action: 'company.similar',
        resourceType: 'company',
        resourceId: norm,
        metadata: { strategy: 'same_company_form', companyForm: form, limit: take, total, mode },
      });
      return {
        data,
        total,
        anchorOrganisationNumber: norm,
        strategy: 'same_company_form' as const,
        companyForm: form,
        mode,
      };
    }

    if (mode === 'industry') {
      const snippet = industrySnippet(ref.businessDescription);
      if (!snippet) {
        return {
          data: [] as CompanyEntity[],
          total: 0,
          anchorOrganisationNumber: norm,
          strategy: 'no_industry_text' as const,
          companyForm: ref.companyForm ?? null,
          mode,
          industrySnippet: null as string | null,
        };
      }
      const qb = this.companyRepo
        .createQueryBuilder('c')
        .select([...baseSelect])
        .where('c.tenantId = :tenantId', { tenantId: ctx.tenantId })
        .andWhere('c.organisationNumber != :norm', { norm })
        .andWhere('c.businessDescription ILIKE :needle', { needle: `%${snippet}%` })
        .orderBy('c.updatedAt', 'DESC');
      const [data, total] = await qb.skip(0).take(take).getManyAndCount();
      await this.auditService.log({
        tenantId: ctx.tenantId,
        actorId: ctx.actorId ?? null,
        action: 'company.similar',
        resourceType: 'company',
        resourceId: norm,
        metadata: { strategy: 'industry_narrative_overlap', limit: take, total, mode, industrySnippet: snippet },
      });
      return {
        data,
        total,
        anchorOrganisationNumber: norm,
        strategy: 'industry_narrative_overlap' as const,
        companyForm: ref.companyForm ?? null,
        mode,
        industrySnippet: snippet,
      };
    }

    if (mode === 'financial') {
      const refJsonLen = Array.isArray(ref.financialReports) ? ref.financialReports.length : 0;
      const refStatementCount = await this.financialStatementRepo.count({
        where: { tenantId: ctx.tenantId, organisationNumber: norm },
      });
      const refLen = refStatementCount > 0 ? refStatementCount : refJsonLen;
      if (refLen === 0) {
        return {
          data: [] as CompanyEntity[],
          total: 0,
          anchorOrganisationNumber: norm,
          strategy: 'no_financial_reports' as const,
          companyForm: ref.companyForm ?? null,
          mode,
          anchorFinancialReportsCount: 0,
        };
      }
      const bucketRows = await this.financialStatementRepo
        .createQueryBuilder('fs')
        .select('fs.organisationNumber', 'org')
        .addSelect('COUNT(1)', 'cnt')
        .where('fs.tenantId = :tenantId', { tenantId: ctx.tenantId })
        .andWhere('fs.organisationNumber != :norm', { norm })
        .groupBy('fs.organisationNumber')
        .getRawMany<{ org: string; cnt: string }>();
      if (bucketRows.length === 0) {
        return {
          data: [] as CompanyEntity[],
          total: 0,
          anchorOrganisationNumber: norm,
          strategy: 'no_financial_reports' as const,
          companyForm: ref.companyForm ?? null,
          mode,
          anchorFinancialReportsCount: refLen,
        };
      }
      const rankedOrgs = bucketRows
        .map((r) => ({ org: r.org, cnt: Number(r.cnt) || 0 }))
        .sort((a, b) => Math.abs(a.cnt - refLen) - Math.abs(b.cnt - refLen) || b.cnt - a.cnt)
        .map((r) => r.org);
      const topOrgs = rankedOrgs.slice(0, take);
      const total = rankedOrgs.length;
      const dataRows = await this.companyRepo.find({
        where: { tenantId: ctx.tenantId, organisationNumber: In(topOrgs) },
        select: [
          'id',
          'organisationNumber',
          'legalName',
          'status',
          'companyForm',
          'createdAt',
          'updatedAt',
        ],
      });
      const rowByOrg = new Map(dataRows.map((r) => [r.organisationNumber, r]));
      const data = topOrgs.map((org) => rowByOrg.get(org)).filter(Boolean) as CompanyEntity[];
      await this.auditService.log({
        tenantId: ctx.tenantId,
        actorId: ctx.actorId ?? null,
        action: 'company.similar',
        resourceType: 'company',
        resourceId: norm,
        metadata: {
          strategy: 'financial_report_count_proximity',
          limit: take,
          total,
          mode,
          anchorFinancialReportsCount: refLen,
        },
      });
      return {
        data,
        total,
        anchorOrganisationNumber: norm,
        strategy: 'financial_report_count_proximity' as const,
        companyForm: ref.companyForm ?? null,
        mode,
        anchorFinancialReportsCount: refLen,
      };
    }

    const refOfficerJsonLen = Array.isArray(ref.officers) ? ref.officers.length : 0;
    const refOwnershipLinks = await this.ownershipLinkRepo.count({
      where: { tenantId: ctx.tenantId, ownedOrganisationNumber: norm, isCurrent: true },
    });
    const oCount = refOwnershipLinks > 0 ? refOwnershipLinks : refOfficerJsonLen;
    if (oCount === 0) {
      return {
        data: [] as CompanyEntity[],
        total: 0,
        anchorOrganisationNumber: norm,
        strategy: 'no_officers' as const,
        companyForm: ref.companyForm ?? null,
        mode,
        anchorOfficersCount: 0,
      };
    }
    const ownershipBuckets = await this.ownershipLinkRepo
      .createQueryBuilder('ol')
      .select('ol.ownedOrganisationNumber', 'org')
      .addSelect('COUNT(1)', 'cnt')
      .where('ol.tenantId = :tenantId', { tenantId: ctx.tenantId })
      .andWhere('ol.ownedOrganisationNumber != :norm', { norm })
      .andWhere('ol.isCurrent = true')
      .groupBy('ol.ownedOrganisationNumber')
      .getRawMany<{ org: string; cnt: string }>();
    if (ownershipBuckets.length === 0) {
      return {
        data: [] as CompanyEntity[],
        total: 0,
        anchorOrganisationNumber: norm,
        strategy: 'no_officers' as const,
        companyForm: ref.companyForm ?? null,
        mode,
        anchorOfficersCount: oCount,
      };
    }
    const rankedOrgs = ownershipBuckets
      .map((r) => ({ org: r.org, cnt: Number(r.cnt) || 0 }))
      .sort((a, b) => Math.abs(a.cnt - oCount) - Math.abs(b.cnt - oCount) || b.cnt - a.cnt)
      .map((r) => r.org);
    const topOrgs = rankedOrgs.slice(0, take);
    const total = rankedOrgs.length;
    const dataRows = await this.companyRepo.find({
      where: { tenantId: ctx.tenantId, organisationNumber: In(topOrgs) },
      select: ['id', 'organisationNumber', 'legalName', 'status', 'companyForm', 'createdAt', 'updatedAt'],
    });
    const rowByOrg = new Map(dataRows.map((r) => [r.organisationNumber, r]));
    const data = topOrgs.map((org) => rowByOrg.get(org)).filter(Boolean) as CompanyEntity[];
    await this.auditService.log({
      tenantId: ctx.tenantId,
      actorId: ctx.actorId ?? null,
      action: 'company.similar',
      resourceType: 'company',
      resourceId: norm,
      metadata: {
        strategy: 'officer_count_proximity',
        limit: take,
        total,
        mode,
        anchorOfficersCount: oCount,
      },
    });
    return {
      data,
      total,
      anchorOrganisationNumber: norm,
      strategy: 'officer_count_proximity' as const,
      companyForm: ref.companyForm ?? null,
      mode,
      anchorOfficersCount: oCount,
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
