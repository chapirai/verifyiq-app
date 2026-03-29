import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../../audit/audit.service';
import {
  CachePolicyEvaluationService,
  PolicyEvaluationResult,
} from './cache-policy-evaluation.service';
import {
  BatchRefreshDecisionResult,
  QuotaHook,
  QuotaHookResult,
  RefreshDecision,
  RefreshDecisionParams,
  RefreshDecisionService,
} from './refresh-decision.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-abc';
const ORG_NR = '5560000001';

function makePolicyResult(
  overrides: Partial<PolicyEvaluationResult> = {},
): PolicyEvaluationResult {
  return {
    decision: 'fresh',
    isFresh: true,
    isStale: false,
    isExpired: false,
    shouldTriggerRefresh: false,
    staleFallbackAllowed: true,
    costFlags: {},
    policyId: 'policy-1',
    usedSystemDefault: false,
    dataAgeHours: 0,
    ...overrides,
  };
}

function makeParams(overrides: Partial<RefreshDecisionParams> = {}): RefreshDecisionParams {
  return {
    tenantId: TENANT_ID,
    dataAgeHours: 0,
    entityId: ORG_NR,
    entityType: 'company',
    correlationId: 'corr-123',
    actorId: 'user-1',
    ...overrides,
  };
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('RefreshDecisionService', () => {
  let service: RefreshDecisionService;
  let cachePolicyEvaluationService: jest.Mocked<CachePolicyEvaluationService>;
  let auditService: jest.Mocked<AuditService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshDecisionService,
        {
          provide: CachePolicyEvaluationService,
          useValue: {
            evaluate: jest.fn(),
          },
        },
        {
          provide: AuditService,
          useValue: { log: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<RefreshDecisionService>(RefreshDecisionService);
    cachePolicyEvaluationService = module.get(CachePolicyEvaluationService);
    auditService = module.get(AuditService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── decide() – policy-based paths ───────────────────────────────────────────

  describe('decide() – policy-based decisions', () => {
    it('returns serve_from=db when policy says fresh', async () => {
      cachePolicyEvaluationService.evaluate.mockResolvedValue(
        makePolicyResult({ decision: 'fresh', isFresh: true }),
      );

      const decision = await service.decide(makeParams({ dataAgeHours: 1 }));

      expect(decision.serve_from).toBe<RefreshDecision['serve_from']>('db');
      expect(decision.reason).toBe('policy_fresh');
      expect(decision.force_refresh).toBe(false);
    });

    it('returns serve_from=stale_db when policy says stale_serve', async () => {
      cachePolicyEvaluationService.evaluate.mockResolvedValue(
        makePolicyResult({ decision: 'stale_serve', isFresh: false, isStale: true }),
      );

      const decision = await service.decide(makeParams({ dataAgeHours: 800 }));

      expect(decision.serve_from).toBe('stale_db');
      expect(decision.reason).toBe('policy_stale_serve');
      expect(decision.force_refresh).toBe(false);
    });

    it('returns serve_from=api when policy says provider_call', async () => {
      cachePolicyEvaluationService.evaluate.mockResolvedValue(
        makePolicyResult({ decision: 'provider_call', isExpired: true }),
      );

      const decision = await service.decide(makeParams({ dataAgeHours: 3000 }));

      expect(decision.serve_from).toBe('api');
      expect(decision.reason).toBe('policy_provider_call');
    });

    it('returns serve_from=api when policy says refresh_required and stale not allowed', async () => {
      cachePolicyEvaluationService.evaluate.mockResolvedValue(
        makePolicyResult({
          decision: 'refresh_required',
          staleFallbackAllowed: false,
          isStale: true,
        }),
      );

      const decision = await service.decide(makeParams({ dataAgeHours: 1500 }));

      expect(decision.serve_from).toBe('api');
      expect(decision.reason).toBe('policy_refresh_required');
    });

    it('returns serve_from=stale_db when policy says refresh_required but stale allowed', async () => {
      cachePolicyEvaluationService.evaluate.mockResolvedValue(
        makePolicyResult({
          decision: 'refresh_required',
          staleFallbackAllowed: true,
          isStale: true,
        }),
      );

      const decision = await service.decide(makeParams({ dataAgeHours: 1500 }));

      expect(decision.serve_from).toBe('stale_db');
      expect(decision.reason).toBe('policy_refresh_required_stale_fallback');
    });

    it('merges policy costFlags into the decision cost_flags', async () => {
      cachePolicyEvaluationService.evaluate.mockResolvedValue(
        makePolicyResult({
          decision: 'fresh',
          costFlags: { apiCallCharged: true, quotaUnit: 'hvd' },
        }),
      );

      const decision = await service.decide(makeParams());

      expect(decision.cost_flags).toMatchObject({ apiCallCharged: true, quotaUnit: 'hvd' });
    });
  });

  // ── decide() – force-refresh override ───────────────────────────────────────

  describe('decide() – force-refresh override', () => {
    it('returns serve_from=api when force_refresh=true regardless of policy', async () => {
      cachePolicyEvaluationService.evaluate.mockResolvedValue(
        makePolicyResult({ decision: 'fresh', isFresh: true }),
      );

      const decision = await service.decide(makeParams({ forceRefresh: true }));

      expect(decision.serve_from).toBe('api');
      expect(decision.reason).toBe('force_refresh_override');
      expect(decision.force_refresh).toBe(true);
    });

    it('does NOT call cachePolicyEvaluationService when force_refresh=true', async () => {
      await service.decide(makeParams({ forceRefresh: true }));

      expect(cachePolicyEvaluationService.evaluate).not.toHaveBeenCalled();
    });

    it('sets cost_flags.force_refresh=true on force-refresh decision', async () => {
      const decision = await service.decide(makeParams({ forceRefresh: true }));

      expect(decision.cost_flags.force_refresh).toBe(true);
    });
  });

  // ── decide() – quota hook points ────────────────────────────────────────────

  describe('decide() – quota hook points', () => {
    it('allows decision unchanged when quota hook returns allow=true without modification', async () => {
      cachePolicyEvaluationService.evaluate.mockResolvedValue(
        makePolicyResult({ decision: 'fresh' }),
      );
      const hook: QuotaHook = jest.fn().mockResolvedValue({ allow: true } as QuotaHookResult);

      const decision = await service.decide(makeParams({ quotaHooks: [hook] }));

      expect(hook).toHaveBeenCalledTimes(1);
      expect(decision.serve_from).toBe('db');
    });

    it('vetoes decision and downgrades to stale_db when quota hook returns allow=false', async () => {
      cachePolicyEvaluationService.evaluate.mockResolvedValue(
        makePolicyResult({ decision: 'fresh' }),
      );
      const hook: QuotaHook = jest.fn().mockResolvedValue({ allow: false } as QuotaHookResult);

      const decision = await service.decide(makeParams({ quotaHooks: [hook] }));

      expect(decision.serve_from).toBe('stale_db');
      expect(decision.cost_flags.quota_exceeded).toBe(true);
      expect(decision.reason).toContain('quota_veto');
    });

    it('applies modifications from quota hook when allow=true with modified fields', async () => {
      cachePolicyEvaluationService.evaluate.mockResolvedValue(
        makePolicyResult({ decision: 'fresh' }),
      );
      const hook: QuotaHook = jest.fn().mockResolvedValue({
        allow: true,
        modified: {
          cost_flags: { high_frequency: true },
          reason: 'hook_modified',
        },
      } as QuotaHookResult);

      const decision = await service.decide(makeParams({ quotaHooks: [hook] }));

      expect(decision.cost_flags.high_frequency).toBe(true);
      expect(decision.reason).toBe('hook_modified');
    });

    it('falls back to stale_db when a quota hook throws', async () => {
      cachePolicyEvaluationService.evaluate.mockResolvedValue(
        makePolicyResult({ decision: 'fresh' }),
      );
      const failingHook: QuotaHook = jest.fn().mockRejectedValue(new Error('quota service down'));

      const decision = await service.decide(makeParams({ quotaHooks: [failingHook] }));

      expect(decision.serve_from).toBe('stale_db');
      expect(decision.reason).toContain('quota_hook_error_fallback');
    });

    it('chains multiple quota hooks in sequence', async () => {
      cachePolicyEvaluationService.evaluate.mockResolvedValue(
        makePolicyResult({ decision: 'fresh' }),
      );
      const order: number[] = [];
      const hook1: QuotaHook = jest.fn().mockImplementation(async () => {
        order.push(1);
        return { allow: true, modified: { cost_flags: { flag1: true } } };
      });
      const hook2: QuotaHook = jest.fn().mockImplementation(async () => {
        order.push(2);
        return { allow: true, modified: { cost_flags: { flag2: true } } };
      });

      const decision = await service.decide(makeParams({ quotaHooks: [hook1, hook2] }));

      expect(order).toEqual([1, 2]);
      expect(decision.cost_flags.flag1).toBe(true);
      expect(decision.cost_flags.flag2).toBe(true);
    });
  });

  // ── decide() – stale fallback (API unavailable) ───────────────────────────

  describe('decide() – stale fallback when API unavailable', () => {
    it('downgrades serve_from=api to stale_db when isApiAvailable=false', async () => {
      cachePolicyEvaluationService.evaluate.mockResolvedValue(
        makePolicyResult({ decision: 'provider_call', isExpired: true }),
      );

      const decision = await service.decide(
        makeParams({ dataAgeHours: 3000, isApiAvailable: false }),
      );

      expect(decision.serve_from).toBe('stale_db');
      expect(decision.reason).toContain('api_unavailable_stale_fallback');
    });

    it('keeps serve_from=api when isApiAvailable=true (default)', async () => {
      cachePolicyEvaluationService.evaluate.mockResolvedValue(
        makePolicyResult({ decision: 'provider_call', isExpired: true }),
      );

      const decision = await service.decide(makeParams({ dataAgeHours: 3000 }));

      expect(decision.serve_from).toBe('api');
    });

    it('does not downgrade db decision when API unavailable', async () => {
      cachePolicyEvaluationService.evaluate.mockResolvedValue(
        makePolicyResult({ decision: 'fresh', isFresh: true }),
      );

      const decision = await service.decide(
        makeParams({ isApiAvailable: false }),
      );

      // serve_from='db' should not be touched by the API-unavailable check
      expect(decision.serve_from).toBe('db');
    });

    it('downgrades force-refresh to stale_db when API unavailable', async () => {
      const decision = await service.decide(
        makeParams({ forceRefresh: true, isApiAvailable: false }),
      );

      expect(decision.serve_from).toBe('stale_db');
      expect(decision.reason).toContain('api_unavailable_stale_fallback');
    });
  });

  // ── decide() – cost flags ────────────────────────────────────────────────────

  describe('decide() – cost flag marking', () => {
    it('sets cost_flags.force_refresh=true for force-refresh decisions', async () => {
      const decision = await service.decide(makeParams({ forceRefresh: true }));
      expect(decision.cost_flags.force_refresh).toBe(true);
    });

    it('sets cost_flags.quota_exceeded=true after quota veto', async () => {
      cachePolicyEvaluationService.evaluate.mockResolvedValue(
        makePolicyResult({ decision: 'fresh' }),
      );
      const vetoHook: QuotaHook = jest.fn().mockResolvedValue({ allow: false });
      const decision = await service.decide(makeParams({ quotaHooks: [vetoHook] }));
      expect(decision.cost_flags.quota_exceeded).toBe(true);
    });

    it('allows hook to mark cost_flags.high_frequency', async () => {
      cachePolicyEvaluationService.evaluate.mockResolvedValue(
        makePolicyResult({ decision: 'fresh' }),
      );
      const hook: QuotaHook = jest.fn().mockResolvedValue({
        allow: true,
        modified: { cost_flags: { high_frequency: true } },
      });
      const decision = await service.decide(makeParams({ quotaHooks: [hook] }));
      expect(decision.cost_flags.high_frequency).toBe(true);
    });
  });

  // ── decide() – audit event emission ──────────────────────────────────────────

  describe('decide() – audit event emission', () => {
    it('emits an audit event on every decision', async () => {
      cachePolicyEvaluationService.evaluate.mockResolvedValue(makePolicyResult());

      await service.decide(makeParams());

      // Allow the fire-and-forget audit to complete
      await Promise.resolve();

      expect(auditService.log).toHaveBeenCalledTimes(1);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          action: 'refresh_decision.made',
        }),
      );
    });

    it('emits audit with correct serve_from, reason, and cost_flags metadata', async () => {
      cachePolicyEvaluationService.evaluate.mockResolvedValue(
        makePolicyResult({ decision: 'fresh' }),
      );

      await service.decide(makeParams());
      await Promise.resolve();

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            serve_from: 'db',
            reason: 'policy_fresh',
            force_refresh: false,
          }),
        }),
      );
    });

    it('includes correlationId and entityId in audit metadata', async () => {
      cachePolicyEvaluationService.evaluate.mockResolvedValue(makePolicyResult());

      await service.decide(
        makeParams({ correlationId: 'corr-xyz', entityId: '5560000001' }),
      );
      await Promise.resolve();

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            correlationId: 'corr-xyz',
            entityId: '5560000001',
          }),
        }),
      );
    });

    it('does NOT throw when audit log fails', async () => {
      cachePolicyEvaluationService.evaluate.mockResolvedValue(makePolicyResult());
      auditService.log.mockRejectedValue(new Error('audit service down'));

      await expect(service.decide(makeParams())).resolves.toBeDefined();
    });
  });

  // ── decide() – policy evaluation failure handling ────────────────────────────

  describe('decide() – policy evaluation failure handling', () => {
    it('returns stale_db safe fallback when policy evaluation throws and cache data exists', async () => {
      cachePolicyEvaluationService.evaluate.mockRejectedValue(new Error('DB error'));

      const decision = await service.decide(makeParams({ dataAgeHours: 500 }));

      expect(decision.serve_from).toBe('stale_db');
      expect(decision.reason).toBe('policy_evaluation_error_safe_fallback');
    });

    it('returns api safe fallback when policy evaluation throws and no cache data exists', async () => {
      cachePolicyEvaluationService.evaluate.mockRejectedValue(new Error('DB error'));

      const decision = await service.decide(makeParams({ dataAgeHours: 0 }));

      expect(decision.serve_from).toBe('api');
      expect(decision.reason).toBe('policy_evaluation_error_safe_fallback');
    });
  });

  // ── decideBatch() ────────────────────────────────────────────────────────────

  describe('decideBatch()', () => {
    it('returns a decision for each input item', async () => {
      cachePolicyEvaluationService.evaluate.mockResolvedValue(
        makePolicyResult({ decision: 'fresh' }),
      );

      const items = [
        makeParams({ entityId: '111', dataAgeHours: 1 }),
        makeParams({ entityId: '222', dataAgeHours: 2 }),
        makeParams({ entityId: '333', dataAgeHours: 3 }),
      ];

      const result: BatchRefreshDecisionResult = await service.decideBatch(items);

      expect(result.decisions).toHaveLength(3);
      expect(result.decisions[0].params.entityId).toBe('111');
      expect(result.decisions[1].params.entityId).toBe('222');
      expect(result.decisions[2].params.entityId).toBe('333');
    });

    it('counts apiCallCount, dbHitCount, staleFallbackCount correctly', async () => {
      cachePolicyEvaluationService.evaluate
        .mockResolvedValueOnce(makePolicyResult({ decision: 'fresh' })) // → db
        .mockResolvedValueOnce(makePolicyResult({ decision: 'stale_serve' })) // → stale_db
        .mockResolvedValueOnce(makePolicyResult({ decision: 'provider_call' })); // → api

      const result = await service.decideBatch([
        makeParams({ entityId: 'a' }),
        makeParams({ entityId: 'b' }),
        makeParams({ entityId: 'c' }),
      ]);

      expect(result.dbHitCount).toBe(1);
      expect(result.staleFallbackCount).toBe(1);
      expect(result.apiCallCount).toBe(1);
    });

    it('returns safe fallback for failed items without aborting the batch', async () => {
      cachePolicyEvaluationService.evaluate
        .mockResolvedValueOnce(makePolicyResult({ decision: 'fresh' }))
        .mockRejectedValueOnce(new Error('transient failure'));

      const result = await service.decideBatch([
        makeParams({ entityId: 'ok' }),
        makeParams({ entityId: 'fail' }),
      ]);

      expect(result.decisions).toHaveLength(2);
      // First item should succeed
      expect(result.decisions[0].decision.serve_from).toBe('db');
      // Second item has a safe fallback; it returned stale_db from the error path
      expect(['stale_db', 'api']).toContain(result.decisions[1].decision.serve_from);
    });

    it('supports force-refresh items in batch', async () => {
      const result = await service.decideBatch([
        makeParams({ entityId: 'force', forceRefresh: true }),
      ]);

      expect(cachePolicyEvaluationService.evaluate).not.toHaveBeenCalled();
      expect(result.decisions[0].decision.serve_from).toBe('api');
      expect(result.decisions[0].decision.force_refresh).toBe(true);
    });
  });

  // ── Tenant isolation ─────────────────────────────────────────────────────────

  describe('tenant isolation', () => {
    it('passes tenantId to cachePolicyEvaluationService on every call', async () => {
      cachePolicyEvaluationService.evaluate.mockResolvedValue(makePolicyResult());

      await service.decide(makeParams({ tenantId: 'tenant-x' }));

      expect(cachePolicyEvaluationService.evaluate).toHaveBeenCalledWith(
        'tenant-x',
        expect.any(Number),
        expect.any(Object),
      );
    });

    it('includes tenantId in the emitted audit event', async () => {
      cachePolicyEvaluationService.evaluate.mockResolvedValue(makePolicyResult());

      await service.decide(makeParams({ tenantId: 'tenant-y' }));
      await Promise.resolve();

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-y' }),
      );
    });
  });
});
