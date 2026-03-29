import { Test, TestingModule } from '@nestjs/testing';
import { SnapshotPolicyDecision, BvFetchSnapshotEntity } from '../entities/bv-fetch-snapshot.entity';
import { CachePolicyEvaluationService } from './cache-policy-evaluation.service';
import { CompanyMetadataService } from './company-metadata.service';
import { SnapshotQueryService } from './snapshot-query.service';

const TENANT_ID = 'tenant-xyz';
const ORG_NR = '5566000001';

function makeSnapshot(overrides: Partial<BvFetchSnapshotEntity> = {}): BvFetchSnapshotEntity {
  const snapshot = new BvFetchSnapshotEntity();
  snapshot.id = 'snap-1';
  snapshot.tenantId = TENANT_ID;
  snapshot.organisationsnummer = ORG_NR;
  snapshot.fetchStatus = 'success';
  snapshot.isFromCache = false;
  snapshot.policyDecision = 'fresh_fetch';
  snapshot.isStaleFallback = false;
  snapshot.apiCallCount = 1;
  snapshot.sourceName = 'bolagsverket';
  snapshot.fetchedAt = new Date();
  snapshot.versionNumber = 2;
  snapshot.correlationId = 'corr-123';
  snapshot.costImpactFlags = {};
  snapshot.rawPayloadSummary = {};
  snapshot.normalisedSummary = {};
  snapshot.identifierUsed = ORG_NR;
  snapshot.identifierType = 'organisationsnummer';
  return Object.assign(snapshot, overrides);
}

describe('CompanyMetadataService', () => {
  let service: CompanyMetadataService;
  let snapshotQueryService: { getSnapshotHistory: jest.Mock };
  let cachePolicyService: { getPolicyForTenant: jest.Mock };

  beforeEach(async () => {
    snapshotQueryService = { getSnapshotHistory: jest.fn() };
    cachePolicyService = { getPolicyForTenant: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompanyMetadataService,
        { provide: SnapshotQueryService, useValue: snapshotQueryService },
        { provide: CachePolicyEvaluationService, useValue: cachePolicyService },
      ],
    }).compile();

    service = module.get<CompanyMetadataService>(CompanyMetadataService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty freshness metadata when no snapshots exist', async () => {
    snapshotQueryService.getSnapshotHistory.mockResolvedValue([]);
    cachePolicyService.getPolicyForTenant.mockResolvedValue(null);

    const result = await service.getFreshnessMetadata(TENANT_ID, ORG_NR);

    expect(result.has_data).toBe(false);
    expect(result.last_fetched_timestamp).toBeNull();
    expect(result.provider_name).toBeNull();
    expect(result.cache_decision).toBe('unknown');
  });

  it('computes freshness and cache decision for fresh provider fetches', async () => {
    const fetchedAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const snapshot = makeSnapshot({ fetchedAt });
    snapshotQueryService.getSnapshotHistory.mockResolvedValue([snapshot]);
    cachePolicyService.getPolicyForTenant.mockResolvedValue({
      freshnessWindowHours: 24,
      maxAgeHours: 72,
      refreshTriggerHours: 48,
    });

    const result = await service.getFreshnessMetadata(TENANT_ID, ORG_NR);

    expect(result.has_data).toBe(true);
    expect(result.freshness_status).toBe('fresh');
    expect(result.cache_decision).toBe('fetched_from_provider');
    expect(result.endpoint_used).toBe('/bolagsverket/enrich');
    expect(result.policy_decision).toBe('fresh_fetch' as SnapshotPolicyDecision);
  });

  it('flags degraded freshness when stale fallback is used', async () => {
    const snapshot = makeSnapshot({
      policyDecision: 'stale_fallback',
      isFromCache: true,
      isStaleFallback: true,
    });
    snapshotQueryService.getSnapshotHistory.mockResolvedValue([snapshot]);
    cachePolicyService.getPolicyForTenant.mockResolvedValue(null);

    const result = await service.getFreshnessMetadata(TENANT_ID, ORG_NR);

    expect(result.freshness_status).toBe('degraded');
    expect(result.cache_decision).toBe('served_stale');
    expect(result.endpoint_used).toBe('cache');
  });

  it('maps snapshot history to UI-friendly fields', async () => {
    const snapshot = makeSnapshot({ policyDecision: 'force_refresh' });
    snapshotQueryService.getSnapshotHistory.mockResolvedValue([snapshot]);

    const history = await service.getSnapshotHistory(TENANT_ID, ORG_NR, 10);

    expect(history).toHaveLength(1);
    expect(history[0]).toEqual(
      expect.objectContaining({
        id: snapshot.id,
        fetch_status: snapshot.fetchStatus,
        policy_decision: 'force_refresh',
        trigger_type: 'FORCE_REFRESH',
        api_call_count: 1,
      }),
    );
  });
});
