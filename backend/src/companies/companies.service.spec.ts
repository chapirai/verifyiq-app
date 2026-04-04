import { GatewayTimeoutException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditEventType } from '../audit/audit-event.entity';
import { AuditService } from '../audit/audit.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { CompaniesService } from './companies.service';
import { ListCompaniesDto } from './dto/list-companies.dto';
import { LookupCompanyDto } from './dto/lookup-company.dto';
import { BvFetchSnapshotEntity } from './entities/bv-fetch-snapshot.entity';
import { CompanyEntity } from './entities/company.entity';
import { BolagsverketService } from './services/bolagsverket.service';
import { CACHE_TTL_DAYS } from './services/bv-cache.service';
import { CachePolicyEvaluationService } from './services/cache-policy-evaluation.service';
import { FailureStateService } from './services/failure-state.service';
import { BvCacheService } from './services/bv-cache.service';
import { LineageMetadataCaptureService } from './services/lineage-metadata-capture.service';
import { RefreshDecisionService } from './services/refresh-decision.service';

const TENANT_ID = 'tenant-abc';
const ORG_NR = '5560000001';

const ctx: TenantContext = { tenantId: TENANT_ID, actorId: 'user-1' };

function makeSnapshot(daysOld: number): BvFetchSnapshotEntity {
  const snapshot = new BvFetchSnapshotEntity();
  snapshot.id = 'snap-id';
  snapshot.tenantId = TENANT_ID;
  snapshot.organisationsnummer = ORG_NR;
  snapshot.fetchStatus = 'success';
  snapshot.isFromCache = false;
  snapshot.policyDecision = 'fresh_fetch';
  snapshot.costImpactFlags = {};
  snapshot.isStaleFallback = false;
  snapshot.normalisedSummary = {
    organisationNumber: ORG_NR,
    legalName: 'Test AB',
    countryCode: 'SE',
    sourcePayloadSummary: {},
  };
  const date = new Date();
  date.setDate(date.getDate() - daysOld);
  snapshot.fetchedAt = date;
  return snapshot;
}

function makeEnrichResult(isFromCache: boolean, ageInDays: number | null) {
  const snapshot = makeSnapshot(ageInDays ?? 0);
  return {
    result: {
      normalisedData: {
        organisationNumber: ORG_NR,
        legalName: 'Test AB',
        companyForm: null,
        status: null,
        registeredAt: null,
        countryCode: 'SE',
        businessDescription: null,
        signatoryText: null,
        officers: [],
        shareInformation: {},
        financialReports: [],
        addresses: [],
        allNames: [],
        permits: [],
        financialYear: null,
        industryCode: null,
        deregisteredAt: null,
        sourcePayloadSummary: {},
        fieldErrors: [],
      },
      highValueDataset: null,
      organisationInformation: [],
      documents: null,
      retrievedAt: new Date().toISOString(),
    },
    snapshot,
    isFromCache,
    ageInDays,
  };
}

describe('CompaniesService – orchestrateLookup', () => {
  let service: CompaniesService;
  let bolagsverketService: jest.Mocked<BolagsverketService>;
  let auditService: jest.Mocked<AuditService>;
  let failureStateService: jest.Mocked<FailureStateService>;
  let bvCacheService: jest.Mocked<BvCacheService>;
  let cachePolicyEvaluationService: jest.Mocked<CachePolicyEvaluationService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompaniesService,
        {
          provide: BolagsverketService,
          useValue: { enrichAndSave: jest.fn() },
        },
        {
          provide: AuditService,
          useValue: {
            log: jest.fn().mockResolvedValue(undefined),
            emitAuditEvent: jest.fn().mockResolvedValue(null),
            emitUsageEvent: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: CachePolicyEvaluationService,
          useValue: {
            evaluate: jest.fn().mockResolvedValue({ decision: 'fresh', isFresh: true, isStale: false, isExpired: false, shouldTriggerRefresh: false, staleFallbackAllowed: true, costFlags: {}, policyId: 'default', usedSystemDefault: true, dataAgeHours: 0 }),
            getPolicyForTenant: jest.fn().mockResolvedValue(null),
            listPolicies: jest.fn().mockResolvedValue([]),
            getPolicyById: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: RefreshDecisionService,
          useValue: {
            decide: jest.fn().mockResolvedValue({ serve_from: 'db', reason: 'policy_fresh', cost_flags: {}, force_refresh: false }),
          },
        },
        {
          provide: FailureStateService,
          useValue: {
            getRecoveryStatusForEntity: jest.fn().mockResolvedValue({
              state: 'SUCCESS',
              isRecoverable: true,
              retryCount: 0,
              lastAttempted: null,
              nextRetryAt: null,
              canRetry: true,
              failureReason: null,
              fallbackUsed: false,
            }),
            recordSuccess: jest.fn().mockResolvedValue(null),
            recordFailure: jest.fn().mockResolvedValue(null),
            classifyFailure: jest.fn().mockReturnValue({
              failureState: 'PROVIDER_ERROR',
              failureReason: 'provider_error',
              isRecoverable: true,
              isPermissionFailure: false,
              isQuotaFailure: false,
            }),
          },
        },
        {
          provide: BvCacheService,
          useValue: {
            checkFreshness: jest.fn(),
          },
        },
        {
          provide: LineageMetadataCaptureService,
          useValue: { capture: jest.fn().mockResolvedValue(null) },
        },
        {
          provide: getRepositoryToken(CompanyEntity),
          useValue: { createQueryBuilder: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<CompaniesService>(CompaniesService);
    bolagsverketService = module.get(BolagsverketService);
    auditService = module.get(AuditService);
    failureStateService = module.get(FailureStateService);
    bvCacheService = module.get(BvCacheService);
    cachePolicyEvaluationService = module.get(CachePolicyEvaluationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('cache hit (source=DB)', () => {
    it('returns source=DB and freshness=fresh when snapshot is 5 days old', async () => {
      bolagsverketService.enrichAndSave.mockResolvedValue(makeEnrichResult(true, 5));

      const dto: LookupCompanyDto = { orgNumber: ORG_NR };
      const response = await service.orchestrateLookup(ctx, dto);

      expect(response.metadata.source).toBe('DB');
      expect(response.metadata.freshness).toBe('fresh');
      expect(response.metadata.age_days).toBe(5);
      expect(response.metadata.cache_ttl_days).toBe(CACHE_TTL_DAYS);
      expect(response.metadata.degraded).toBe(false);
      expect(response.company).toBeDefined();
    });
  });

  describe('snapshot lineage metadata (P02-T01)', () => {
    it('includes snapshot_id in the response metadata', async () => {
      bolagsverketService.enrichAndSave.mockResolvedValue(makeEnrichResult(false, null));

      const response = await service.orchestrateLookup(ctx, { orgNumber: ORG_NR });

      expect(response.metadata.snapshot_id).toBe('snap-id');
    });

    it('includes a non-empty correlation_id in the response metadata', async () => {
      bolagsverketService.enrichAndSave.mockResolvedValue(makeEnrichResult(false, null));

      const response = await service.orchestrateLookup(ctx, { orgNumber: ORG_NR });

      expect(typeof response.metadata.correlation_id).toBe('string');
      expect(response.metadata.correlation_id.length).toBeGreaterThan(0);
    });

    it('includes policy_decision in the response metadata', async () => {
      bolagsverketService.enrichAndSave.mockResolvedValue(makeEnrichResult(false, null));

      const response = await service.orchestrateLookup(ctx, { orgNumber: ORG_NR });

      expect(typeof response.metadata.policy_decision).toBe('string');
    });

    it('passes correlationId and actorId to enrichAndSave', async () => {
      bolagsverketService.enrichAndSave.mockResolvedValue(makeEnrichResult(false, null));

      await service.orchestrateLookup(ctx, { orgNumber: ORG_NR });

      const [, , , correlationId, actorId] = bolagsverketService.enrichAndSave.mock.calls[0];
      expect(typeof correlationId).toBe('string');
      expect((correlationId as string).length).toBeGreaterThan(0);
      expect(actorId).toBe('user-1');
    });
  });

  describe('API call (source=API)', () => {
    it('returns source=API and freshness=fresh when data is newly fetched', async () => {
      bolagsverketService.enrichAndSave.mockResolvedValue(makeEnrichResult(false, null));

      const dto: LookupCompanyDto = { orgNumber: ORG_NR };
      const response = await service.orchestrateLookup(ctx, dto);

      expect(response.metadata.source).toBe('API');
      expect(response.metadata.freshness).toBe('fresh');
      expect(response.metadata.age_days).toBe(0);
      expect(response.metadata.degraded).toBe(false);
    });

    it('passes force_refresh=true to bolagsverketService.enrichAndSave', async () => {
      bolagsverketService.enrichAndSave.mockResolvedValue(makeEnrichResult(false, null));

      const dto: LookupCompanyDto = { orgNumber: ORG_NR, force_refresh: true };
      await service.orchestrateLookup(ctx, dto);

      expect(bolagsverketService.enrichAndSave).toHaveBeenCalledWith(
        TENANT_ID,
        ORG_NR,
        true,
        expect.any(String),
        'user-1',
      );
    });
  });

  describe('freshness computation', () => {
    it('returns freshness=stale when age is 35 days (between 30 and 60)', async () => {
      bolagsverketService.enrichAndSave.mockResolvedValue(makeEnrichResult(true, 35));

      const response = await service.orchestrateLookup(ctx, { orgNumber: ORG_NR });
      expect(response.metadata.freshness).toBe('stale');
    });

    it('returns freshness=expired when age is 65 days (>= 60)', async () => {
      bolagsverketService.enrichAndSave.mockResolvedValue(makeEnrichResult(true, 65));

      const response = await service.orchestrateLookup(ctx, { orgNumber: ORG_NR });
      expect(response.metadata.freshness).toBe('expired');
    });
  });

  describe('request deduplication', () => {
    it('reuses the in-flight promise for concurrent requests to the same org', async () => {
      bolagsverketService.enrichAndSave.mockResolvedValue(makeEnrichResult(false, null));

      const dto: LookupCompanyDto = { orgNumber: ORG_NR };
      // Fire two concurrent requests
      const [r1, r2] = await Promise.all([
        service.orchestrateLookup(ctx, dto),
        service.orchestrateLookup(ctx, dto),
      ]);

      // Only one API call should have been made
      expect(bolagsverketService.enrichAndSave).toHaveBeenCalledTimes(1);
      expect(r1).toEqual(r2);
    });

    it('does NOT deduplicate when force_refresh=true', async () => {
      bolagsverketService.enrichAndSave.mockResolvedValue(makeEnrichResult(false, null));

      const dto: LookupCompanyDto = { orgNumber: ORG_NR, force_refresh: true };
      await Promise.all([
        service.orchestrateLookup(ctx, dto),
        service.orchestrateLookup(ctx, dto),
      ]);

      // Both requests should call the service independently
      expect(bolagsverketService.enrichAndSave).toHaveBeenCalledTimes(2);
    });
  });

  describe('stale fallback on provider failure (P02-T10)', () => {
    it('serves stale cache data when provider fails and fallback is allowed', async () => {
      bolagsverketService.enrichAndSave.mockRejectedValue(new Error('provider down'));
      bvCacheService.checkFreshness.mockResolvedValue({
        isFresh: false,
        snapshot: makeSnapshot(40),
        ageInDays: 40,
      });

      const response = await service.orchestrateLookup(ctx, { orgNumber: ORG_NR });

      expect(response.metadata.source).toBe('DB');
      expect(response.metadata.policy_decision).toBe('stale_fallback');
      expect(response.metadata.degraded).toBe(true);
      expect(response.metadata.failure_state).toBe('DEGRADED');
      expect(response.metadata.freshness).toBe('stale');
      expect(response.company.organisationNumber).toBe(ORG_NR);
      expect(failureStateService.recordFailure).toHaveBeenCalled();
    });

    it('throws when provider fails and no cached data exists', async () => {
      bolagsverketService.enrichAndSave.mockRejectedValue(new Error('API failure'));
      bvCacheService.checkFreshness.mockResolvedValue({
        isFresh: false,
        snapshot: null,
        ageInDays: null,
      });

      await expect(
        service.orchestrateLookup(ctx, { orgNumber: ORG_NR }),
      ).rejects.toThrow('API failure');
    });

    it('throws when policy disallows stale fallback', async () => {
      bolagsverketService.enrichAndSave.mockRejectedValue(new Error('API failure'));
      bvCacheService.checkFreshness.mockResolvedValue({
        isFresh: false,
        snapshot: makeSnapshot(40),
        ageInDays: 40,
      });
      cachePolicyEvaluationService.evaluate = jest.fn().mockResolvedValue({
        decision: 'provider_call',
        isFresh: false,
        isStale: false,
        isExpired: true,
        shouldTriggerRefresh: false,
        staleFallbackAllowed: false,
        costFlags: {},
        policyId: 'default',
        usedSystemDefault: true,
        dataAgeHours: 999,
      });

      await expect(
        service.orchestrateLookup(ctx, { orgNumber: ORG_NR }),
      ).rejects.toThrow('API failure');
    });
  });

  describe('audit logging', () => {
    it('logs an audit entry for every lookup', async () => {
      bolagsverketService.enrichAndSave.mockResolvedValue(makeEnrichResult(true, 5));

      await service.orchestrateLookup(ctx, { orgNumber: ORG_NR });

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          actorId: 'user-1',
          action: 'company.lookup',
          resourceType: 'company',
          resourceId: ORG_NR,
        }),
      );
      expect(auditService.emitAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: AuditEventType.LOOKUP_INITIATED,
          status: 'initiated',
          resourceId: ORG_NR,
        }),
      );
      expect(auditService.emitAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: AuditEventType.LOOKUP_COMPLETED,
          status: 'success',
          resourceId: ORG_NR,
        }),
      );
      expect(auditService.emitUsageEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: AuditEventType.LOOKUP_COMPLETED,
          status: 'success',
          resourceId: ORG_NR,
        }),
      );
    });
  });

  describe('error handling', () => {
    it('propagates GatewayTimeoutException when API times out', async () => {
      // enrichAndSave never resolves; the internal 10 s timer fires immediately via mock
      bolagsverketService.enrichAndSave.mockImplementation(
        () => new Promise(() => {}),
      );

      jest
        .spyOn(global, 'setTimeout')
        .mockImplementationOnce((fn: (...args: any[]) => void) => {
          fn();
          return 0 as unknown as ReturnType<typeof setTimeout>;
        });

      await expect(
        service.orchestrateLookup(ctx, { orgNumber: ORG_NR }),
      ).rejects.toBeInstanceOf(GatewayTimeoutException);
    });

    it('propagates errors thrown by bolagsverketService', async () => {
      bolagsverketService.enrichAndSave.mockRejectedValue(new Error('API failure'));

      await expect(
        service.orchestrateLookup(ctx, { orgNumber: ORG_NR }),
      ).rejects.toThrow('API failure');
    });
  });
});

// ---------------------------------------------------------------------------
// Helper: build a chainable QueryBuilder mock
// ---------------------------------------------------------------------------
function makeQbMock(data: Partial<CompanyEntity>[], total: number) {
  const qb: Record<string, jest.Mock> = {};
  const chain = () => qb;
  qb.select = jest.fn(chain);
  qb.where = jest.fn(chain);
  qb.andWhere = jest.fn(chain);
  qb.skip = jest.fn(chain);
  qb.take = jest.fn(chain);
  qb.getManyAndCount = jest.fn().mockResolvedValue([data, total]);
  return qb;
}

describe('CompaniesService – findAll', () => {
  let service: CompaniesService;
  let companyRepo: { createQueryBuilder: jest.Mock };

  beforeEach(async () => {
    companyRepo = { createQueryBuilder: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompaniesService,
        {
          provide: BolagsverketService,
          useValue: { enrichAndSave: jest.fn() },
        },
        {
          provide: AuditService,
          useValue: { log: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: CachePolicyEvaluationService,
          useValue: {
            evaluate: jest.fn().mockResolvedValue({ decision: 'fresh', isFresh: true, isStale: false, isExpired: false, shouldTriggerRefresh: false, staleFallbackAllowed: true, costFlags: {}, policyId: 'default', usedSystemDefault: true, dataAgeHours: 0 }),
            getPolicyForTenant: jest.fn().mockResolvedValue(null),
            listPolicies: jest.fn().mockResolvedValue([]),
            getPolicyById: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: RefreshDecisionService,
          useValue: {
            decide: jest.fn().mockResolvedValue({ serve_from: 'db', reason: 'policy_fresh', cost_flags: {}, force_refresh: false }),
          },
        },
        {
          provide: FailureStateService,
          useValue: {
            getRecoveryStatusForEntity: jest.fn().mockResolvedValue({
              state: 'SUCCESS',
              isRecoverable: true,
              retryCount: 0,
              lastAttempted: null,
              nextRetryAt: null,
              canRetry: true,
              failureReason: null,
              fallbackUsed: false,
            }),
            recordSuccess: jest.fn().mockResolvedValue(null),
            recordFailure: jest.fn().mockResolvedValue(null),
            classifyFailure: jest.fn().mockReturnValue({
              failureState: 'PROVIDER_ERROR',
              failureReason: 'provider_error',
              isRecoverable: true,
              isPermissionFailure: false,
              isQuotaFailure: false,
            }),
          },
        },
        {
          provide: BvCacheService,
          useValue: {
            checkFreshness: jest.fn(),
          },
        },
        {
          provide: LineageMetadataCaptureService,
          useValue: { capture: jest.fn().mockResolvedValue(null) },
        },
        {
          provide: getRepositoryToken(CompanyEntity),
          useValue: companyRepo,
        },
      ],
    }).compile();

    service = module.get<CompaniesService>(CompaniesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty data array with has_next=false when no results', async () => {
    const qb = makeQbMock([], 0);
    companyRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await service.findAll(ctx, {});
    expect(result).toEqual({ data: [], total: 0, page: 1, limit: 10, has_next: false });
  });

  it('applies tenant isolation via WHERE tenantId = :tenantId', async () => {
    const qb = makeQbMock([], 0);
    companyRepo.createQueryBuilder.mockReturnValue(qb);

    await service.findAll(ctx, {});

    expect(qb.where).toHaveBeenCalledWith('c.tenantId = :tenantId', { tenantId: TENANT_ID });
  });

  it('applies q filter as ILIKE when q is provided', async () => {
    const qb = makeQbMock([], 0);
    companyRepo.createQueryBuilder.mockReturnValue(qb);

    await service.findAll(ctx, { q: 'nordic' } as ListCompaniesDto);

    expect(qb.andWhere).toHaveBeenCalledWith('c.legalName ILIKE :q', { q: '%nordic%' });
  });

  it('does NOT apply q filter when q is absent', async () => {
    const qb = makeQbMock([], 0);
    companyRepo.createQueryBuilder.mockReturnValue(qb);

    await service.findAll(ctx, {});

    const calls = qb.andWhere.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(calls.some((c) => c.includes('legalName'))).toBe(false);
  });

  it('applies org_number exact filter when org_number is provided', async () => {
    const qb = makeQbMock([], 0);
    companyRepo.createQueryBuilder.mockReturnValue(qb);

    await service.findAll(ctx, { org_number: ORG_NR } as ListCompaniesDto);

    expect(qb.andWhere).toHaveBeenCalledWith('c.organisationNumber = :orgNumber', { orgNumber: ORG_NR });
  });

  it('applies status filter when status is provided', async () => {
    const qb = makeQbMock([], 0);
    companyRepo.createQueryBuilder.mockReturnValue(qb);

    await service.findAll(ctx, { status: 'ACTIVE' } as ListCompaniesDto);

    expect(qb.andWhere).toHaveBeenCalledWith('c.status = :status', { status: 'ACTIVE' });
  });

  it('uses default page=1 and limit=10 when not provided', async () => {
    const qb = makeQbMock([], 0);
    companyRepo.createQueryBuilder.mockReturnValue(qb);

    await service.findAll(ctx, {});

    expect(qb.skip).toHaveBeenCalledWith(0); // offset = (1-1)*10 = 0
    expect(qb.take).toHaveBeenCalledWith(10);
  });

  it('calculates correct offset for page 2 with limit 10', async () => {
    const qb = makeQbMock([], 0);
    companyRepo.createQueryBuilder.mockReturnValue(qb);

    await service.findAll(ctx, { page: 2, limit: 10 } as ListCompaniesDto);

    expect(qb.skip).toHaveBeenCalledWith(10);
    expect(qb.take).toHaveBeenCalledWith(10);
  });

  it('sets has_next=true when more results exist beyond current page', async () => {
    const items = [{ id: '1' }, { id: '2' }] as CompanyEntity[];
    const qb = makeQbMock(items, 25);
    companyRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await service.findAll(ctx, { page: 1, limit: 10 } as ListCompaniesDto);

    expect(result.has_next).toBe(true);
    expect(result.total).toBe(25);
  });

  it('sets has_next=false on the last page', async () => {
    const items = [{ id: '1' }, { id: '2' }] as CompanyEntity[];
    const qb = makeQbMock(items, 12);
    companyRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await service.findAll(ctx, { page: 2, limit: 10 } as ListCompaniesDto);

    // page 2: offset=10, data.length=2, total=12 → 10+2=12 === 12 → no next
    expect(result.has_next).toBe(false);
  });

  it('returns empty data and has_next=false for an out-of-range page', async () => {
    const qb = makeQbMock([], 5);
    companyRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await service.findAll(ctx, { page: 999, limit: 10 } as ListCompaniesDto);

    expect(result.data).toEqual([]);
    expect(result.has_next).toBe(false);
    expect(result.total).toBe(5);
  });

  it('combines multiple filters in a single query', async () => {
    const qb = makeQbMock([], 0);
    companyRepo.createQueryBuilder.mockReturnValue(qb);

    await service.findAll(ctx, { q: 'nordic', status: 'ACTIVE' } as ListCompaniesDto);

    expect(qb.andWhere).toHaveBeenCalledWith('c.legalName ILIKE :q', { q: '%nordic%' });
    expect(qb.andWhere).toHaveBeenCalledWith('c.status = :status', { status: 'ACTIVE' });
  });

  it('includes correct page and limit in the response', async () => {
    const qb = makeQbMock([], 0);
    companyRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await service.findAll(ctx, { page: 3, limit: 20 } as ListCompaniesDto);

    expect(result.page).toBe(3);
    expect(result.limit).toBe(20);
  });

  describe('audit logging', () => {
    let auditService: jest.Mocked<AuditService>;

    beforeEach(async () => {
      companyRepo = { createQueryBuilder: jest.fn() };
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CompaniesService,
          {
            provide: BolagsverketService,
            useValue: { enrichAndSave: jest.fn() },
          },
          {
            provide: AuditService,
            useValue: { log: jest.fn().mockResolvedValue(undefined) },
          },
          {
            provide: CachePolicyEvaluationService,
            useValue: {
              evaluate: jest.fn().mockResolvedValue({ decision: 'fresh', isFresh: true, isStale: false, isExpired: false, shouldTriggerRefresh: false, staleFallbackAllowed: true, costFlags: {}, policyId: 'default', usedSystemDefault: true, dataAgeHours: 0 }),
              getPolicyForTenant: jest.fn().mockResolvedValue(null),
              listPolicies: jest.fn().mockResolvedValue([]),
              getPolicyById: jest.fn().mockResolvedValue(null),
            },
          },
          {
            provide: RefreshDecisionService,
            useValue: {
              decide: jest.fn().mockResolvedValue({ serve_from: 'db', reason: 'policy_fresh', cost_flags: {}, force_refresh: false }),
            },
          },
          {
            provide: FailureStateService,
            useValue: {
              getRecoveryStatusForEntity: jest.fn().mockResolvedValue({
                state: 'SUCCESS',
                isRecoverable: true,
                retryCount: 0,
                lastAttempted: null,
                nextRetryAt: null,
                canRetry: true,
                failureReason: null,
                fallbackUsed: false,
              }),
              recordSuccess: jest.fn().mockResolvedValue(null),
              recordFailure: jest.fn().mockResolvedValue(null),
              classifyFailure: jest.fn().mockReturnValue({
                failureState: 'PROVIDER_ERROR',
                failureReason: 'provider_error',
                isRecoverable: true,
                isPermissionFailure: false,
                isQuotaFailure: false,
              }),
            },
          },
          {
            provide: BvCacheService,
            useValue: {
              checkFreshness: jest.fn(),
            },
          },
          {
            provide: LineageMetadataCaptureService,
            useValue: { capture: jest.fn().mockResolvedValue(null) },
          },
          {
            provide: getRepositoryToken(CompanyEntity),
            useValue: companyRepo,
          },
        ],
      }).compile();

      service = module.get<CompaniesService>(CompaniesService);
      auditService = module.get(AuditService);
    });

    it('emits a company.search audit event for every findAll call', async () => {
      const qb = makeQbMock([], 0);
      companyRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(ctx, {});

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          actorId: 'user-1',
          action: 'company.search',
          resourceType: 'company',
        }),
      );
    });

    it('includes query parameters in the audit metadata', async () => {
      const qb = makeQbMock([], 0);
      companyRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(ctx, { q: 'nordic', status: 'ACTIVE' } as ListCompaniesDto);

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            q: 'nordic',
            status: 'ACTIVE',
          }),
        }),
      );
    });

    it('uses org_number as resourceId when q is absent and org_number is provided', async () => {
      const qb = makeQbMock([], 0);
      companyRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(ctx, { org_number: ORG_NR } as ListCompaniesDto);

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceId: ORG_NR,
        }),
      );
    });

    it('uses q as resourceId when q is provided', async () => {
      const qb = makeQbMock([], 0);
      companyRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(ctx, { q: 'nordic' } as ListCompaniesDto);

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceId: 'nordic',
        }),
      );
    });

    it('uses "*" as resourceId when neither q nor org_number is provided', async () => {
      const qb = makeQbMock([], 0);
      companyRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(ctx, {});

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceId: '*',
        }),
      );
    });
  });
});
