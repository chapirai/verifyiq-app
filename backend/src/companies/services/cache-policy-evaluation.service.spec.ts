import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CachePolicyEvaluationService,
  PolicyDecision,
  SAFE_DEFAULT_POLICY,
} from './cache-policy-evaluation.service';
import { CachePolicyEntity } from '../entities/cache-policy.entity';
import { AuditService } from '../../audit/audit.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-abc';
const ORG_NR = '5560000001';

function makePolicy(overrides: Partial<CachePolicyEntity> = {}): CachePolicyEntity {
  const p = new CachePolicyEntity();
  p.id = 'policy-1';
  p.tenantId = TENANT_ID;
  p.entityType = null;
  p.entityId = null;
  p.policyName = 'Test Policy';
  p.freshnessWindowHours = 720;  // 30 days
  p.maxAgeHours = 2160;          // 90 days
  p.refreshTriggerHours = 1440;  // 60 days
  p.staleFallbackAllowed = true;
  p.forceRefreshCostFlags = {};
  p.isSystemDefault = false;
  p.isActive = true;
  p.createdAt = new Date();
  p.updatedAt = new Date();
  return Object.assign(p, overrides);
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('CachePolicyEvaluationService', () => {
  let service: CachePolicyEvaluationService;
  let policyRepo: jest.Mocked<Repository<CachePolicyEntity>>;
  let auditService: jest.Mocked<AuditService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CachePolicyEvaluationService,
        {
          provide: getRepositoryToken(CachePolicyEntity),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: AuditService,
          useValue: { log: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<CachePolicyEvaluationService>(CachePolicyEvaluationService);
    policyRepo = module.get(getRepositoryToken(CachePolicyEntity));
    auditService = module.get(AuditService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── evaluate() ──────────────────────────────────────────────────────────────

  describe('evaluate() – fresh data path', () => {
    it('returns decision=fresh when data age is within freshness window', async () => {
      policyRepo.findOne.mockResolvedValue(makePolicy()); // 720h window
      const result = await service.evaluate(TENANT_ID, 100); // 100 hours old
      expect(result.decision).toBe<PolicyDecision>('fresh');
      expect(result.isFresh).toBe(true);
      expect(result.isStale).toBe(false);
      expect(result.isExpired).toBe(false);
    });

    it('returns isFresh=false when data age equals freshness window (boundary)', async () => {
      policyRepo.findOne.mockResolvedValue(makePolicy()); // 720h window
      const result = await service.evaluate(TENANT_ID, 720);
      expect(result.isFresh).toBe(false);
    });

    it('returns isFresh=true for data just under the freshness window', async () => {
      policyRepo.findOne.mockResolvedValue(makePolicy()); // 720h window
      const result = await service.evaluate(TENANT_ID, 719.9);
      expect(result.isFresh).toBe(true);
    });
  });

  describe('evaluate() – stale data path', () => {
    it('returns decision=stale_serve when data is stale and staleFallbackAllowed=true', async () => {
      policyRepo.findOne.mockResolvedValue(makePolicy({ staleFallbackAllowed: true }));
      // 721h: past freshness (720h) but not yet refresh trigger (1440h)
      const result = await service.evaluate(TENANT_ID, 721);
      expect(result.decision).toBe<PolicyDecision>('stale_serve');
      expect(result.isStale).toBe(true);
      expect(result.isFresh).toBe(false);
      expect(result.staleFallbackAllowed).toBe(true);
    });

    it('returns decision=refresh_required when staleFallbackAllowed=false and data is stale', async () => {
      policyRepo.findOne.mockResolvedValue(makePolicy({ staleFallbackAllowed: false }));
      const result = await service.evaluate(TENANT_ID, 721);
      expect(result.decision).toBe<PolicyDecision>('refresh_required');
      expect(result.staleFallbackAllowed).toBe(false);
    });
  });

  describe('evaluate() – refresh_required path', () => {
    it('returns decision=refresh_required when age exceeds refresh_trigger_hours', async () => {
      policyRepo.findOne.mockResolvedValue(makePolicy()); // refreshTrigger=1440h
      // 1441h: past refresh trigger but not yet max_age (2160h)
      const result = await service.evaluate(TENANT_ID, 1441);
      expect(result.decision).toBe<PolicyDecision>('refresh_required');
      expect(result.shouldTriggerRefresh).toBe(true);
      expect(result.isExpired).toBe(false);
    });

    it('shouldTriggerRefresh=true at exactly refresh_trigger_hours boundary', async () => {
      policyRepo.findOne.mockResolvedValue(makePolicy()); // refreshTrigger=1440h
      const result = await service.evaluate(TENANT_ID, 1440);
      expect(result.shouldTriggerRefresh).toBe(true);
      expect(result.decision).toBe<PolicyDecision>('refresh_required');
    });

    it('shouldTriggerRefresh=false just under refresh_trigger_hours', async () => {
      policyRepo.findOne.mockResolvedValue(makePolicy());
      const result = await service.evaluate(TENANT_ID, 1439);
      expect(result.shouldTriggerRefresh).toBe(false);
    });
  });

  describe('evaluate() – provider_call (expired) path', () => {
    it('returns decision=provider_call when age exceeds max_age_hours', async () => {
      policyRepo.findOne.mockResolvedValue(makePolicy()); // max_age=2160h
      const result = await service.evaluate(TENANT_ID, 2161);
      expect(result.decision).toBe<PolicyDecision>('provider_call');
      expect(result.isExpired).toBe(true);
    });

    it('returns decision=provider_call at exactly max_age_hours boundary', async () => {
      policyRepo.findOne.mockResolvedValue(makePolicy()); // max_age=2160h
      const result = await service.evaluate(TENANT_ID, 2160);
      expect(result.decision).toBe<PolicyDecision>('provider_call');
      expect(result.isExpired).toBe(true);
    });

    it('returns isExpired=false just under max_age_hours', async () => {
      policyRepo.findOne.mockResolvedValue(makePolicy());
      const result = await service.evaluate(TENANT_ID, 2159);
      expect(result.isExpired).toBe(false);
    });
  });

  // ── Tenant-specific policy override ─────────────────────────────────────────

  describe('tenant-specific policy override', () => {
    it('uses tenant policy over system default', async () => {
      const tenantPolicy = makePolicy({
        tenantId: TENANT_ID,
        freshnessWindowHours: 24, // very short TTL
        maxAgeHours: 48,
        refreshTriggerHours: 36,
        isSystemDefault: false,
      });
      // findOne returns tenant policy first
      policyRepo.findOne
        .mockResolvedValueOnce(null)       // entity-level → not found
        .mockResolvedValueOnce(tenantPolicy); // tenant-level → found

      // 25 hours old: fresh under default (720h), but stale under tenant policy (24h)
      const result = await service.evaluate(TENANT_ID, 25);
      expect(result.isFresh).toBe(false);
      expect(result.policyId).toBe('policy-1');
      expect(result.usedSystemDefault).toBe(false);
    });

    it('usedSystemDefault=true when only system default is found', async () => {
      const systemDefault = makePolicy({ tenantId: null, isSystemDefault: true });
      policyRepo.findOne
        .mockResolvedValueOnce(null)         // entity-level → not found
        .mockResolvedValueOnce(null)         // tenant-level → not found
        .mockResolvedValueOnce(systemDefault); // system default → found

      const result = await service.evaluate(TENANT_ID, 100);
      expect(result.usedSystemDefault).toBe(true);
    });
  });

  // ── Cost-aware flags ──────────────────────────────────────────────────────────

  describe('cost-aware flags', () => {
    it('propagates forceRefreshCostFlags to result.costFlags', async () => {
      const policy = makePolicy({
        forceRefreshCostFlags: { apiCallCharged: true, quotaUnit: 'hvd' },
      });
      policyRepo.findOne.mockResolvedValue(policy);
      const result = await service.evaluate(TENANT_ID, 100);
      expect(result.costFlags).toEqual({ apiCallCharged: true, quotaUnit: 'hvd' });
    });

    it('costFlags is an empty object when policy has no cost flags', async () => {
      const policy = makePolicy({ forceRefreshCostFlags: {} });
      policyRepo.findOne.mockResolvedValue(policy);
      const result = await service.evaluate(TENANT_ID, 100);
      expect(result.costFlags).toEqual({});
    });
  });

  // ── Graceful failure handling ────────────────────────────────────────────────

  describe('policy evaluation failure handling', () => {
    it('falls back to safe defaults when repository throws', async () => {
      policyRepo.findOne.mockRejectedValue(new Error('DB connection failed'));
      // Should not throw; safe defaults applied
      const result = await service.evaluate(TENANT_ID, 100);
      expect(result.decision).toBe<PolicyDecision>('fresh');
      expect(result.policyId).toBe(SAFE_DEFAULT_POLICY.id);
      expect(result.usedSystemDefault).toBe(true);
    });

    it('safe default policy treats data as fresh within 720h', async () => {
      policyRepo.findOne.mockRejectedValue(new Error('DB error'));
      const result = await service.evaluate(TENANT_ID, 719);
      expect(result.isFresh).toBe(true);
    });

    it('safe default policy treats data as expired beyond 2160h', async () => {
      policyRepo.findOne.mockRejectedValue(new Error('DB error'));
      const result = await service.evaluate(TENANT_ID, 2200);
      expect(result.decision).toBe<PolicyDecision>('provider_call');
      expect(result.isExpired).toBe(true);
    });
  });

  // ── Audit event emission ──────────────────────────────────────────────────────

  describe('audit event emission', () => {
    it('emits cache_policy.evaluated audit event after evaluation', async () => {
      policyRepo.findOne.mockResolvedValue(makePolicy());
      await service.evaluate(TENANT_ID, 100, {
        correlationId: 'corr-1',
        actorId: 'user-1',
        orgNumber: ORG_NR,
      });
      // Audit is best-effort async — allow microtask queue to drain
      await new Promise(resolve => setImmediate(resolve));
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          action: 'cache_policy.evaluated',
          resourceType: 'cache_policy',
          metadata: expect.objectContaining({
            decision: 'fresh',
            correlationId: 'corr-1',
            orgNumber: ORG_NR,
          }),
        }),
      );
    });

    it('does not throw when audit service fails', async () => {
      policyRepo.findOne.mockResolvedValue(makePolicy());
      auditService.log.mockRejectedValue(new Error('Audit DB down'));
      // evaluate() must not propagate the audit error
      await expect(service.evaluate(TENANT_ID, 100)).resolves.toBeDefined();
    });
  });

  // ── listPolicies / getPolicyById ─────────────────────────────────────────────

  describe('listPolicies', () => {
    it('returns active policies ordered by created_at', async () => {
      const policies = [makePolicy({ id: 'p1' }), makePolicy({ id: 'p2' })];
      policyRepo.find.mockResolvedValue(policies);
      const result = await service.listPolicies();
      expect(result).toHaveLength(2);
      expect(policyRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
    });
  });

  describe('getPolicyById', () => {
    it('returns policy when found', async () => {
      const policy = makePolicy({ id: 'p1' });
      policyRepo.findOne.mockResolvedValue(policy);
      const result = await service.getPolicyById('p1');
      expect(result).toBe(policy);
    });

    it('returns null when policy not found', async () => {
      policyRepo.findOne.mockResolvedValue(null);
      const result = await service.getPolicyById('nonexistent');
      expect(result).toBeNull();
    });
  });

  // ── getPolicyForTenant ─────────────────────────────────────────────────────

  describe('getPolicyForTenant', () => {
    it('returns the tenant-level policy when available', async () => {
      const tenantPolicy = makePolicy();
      policyRepo.findOne
        .mockResolvedValueOnce(null)        // entity-level not found
        .mockResolvedValueOnce(tenantPolicy); // tenant-level found
      const result = await service.getPolicyForTenant(TENANT_ID);
      expect(result).toBe(tenantPolicy);
    });

    it('returns null when no policy found and DB errors', async () => {
      policyRepo.findOne.mockRejectedValue(new Error('DB error'));
      const result = await service.getPolicyForTenant(TENANT_ID);
      expect(result).toBeNull();
    });
  });

  // ── Boundary conditions ───────────────────────────────────────────────────────

  describe('freshness window boundary conditions', () => {
    it('data age 0 is always fresh', async () => {
      policyRepo.findOne.mockResolvedValue(makePolicy());
      const result = await service.evaluate(TENANT_ID, 0);
      expect(result.isFresh).toBe(true);
      expect(result.decision).toBe<PolicyDecision>('fresh');
    });

    it('data age way past max_age is expired', async () => {
      policyRepo.findOne.mockResolvedValue(makePolicy());
      // 1 year in hours
      const result = await service.evaluate(TENANT_ID, 8760);
      expect(result.isExpired).toBe(true);
      expect(result.decision).toBe<PolicyDecision>('provider_call');
    });

    it('custom short policy with 1h freshness window', async () => {
      const shortPolicy = makePolicy({ freshnessWindowHours: 1, maxAgeHours: 4, refreshTriggerHours: 2 });
      policyRepo.findOne.mockResolvedValue(shortPolicy);

      const freshResult = await service.evaluate(TENANT_ID, 0.5);
      expect(freshResult.isFresh).toBe(true);

      const staleResult = await service.evaluate(TENANT_ID, 1.5);
      expect(staleResult.isStale).toBe(true);

      const refreshResult = await service.evaluate(TENANT_ID, 2.5);
      expect(refreshResult.decision).toBe<PolicyDecision>('refresh_required');

      const expiredResult = await service.evaluate(TENANT_ID, 5);
      expect(expiredResult.isExpired).toBe(true);
    });
  });

  // ── dataAgeHours in result ───────────────────────────────────────────────────

  describe('dataAgeHours in result', () => {
    it('result.dataAgeHours matches the input age', async () => {
      policyRepo.findOne.mockResolvedValue(makePolicy());
      const result = await service.evaluate(TENANT_ID, 42.5);
      expect(result.dataAgeHours).toBe(42.5);
    });
  });
});
