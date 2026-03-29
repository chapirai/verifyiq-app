import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BvFetchSnapshotEntity } from '../entities/bv-fetch-snapshot.entity';
import { SnapshotQueryService } from './snapshot-query.service';

const TENANT_ID = 'tenant-abc';
const ORG_NR = '5560000001';

function makeSnapshot(
  overrides: Partial<BvFetchSnapshotEntity> = {},
): BvFetchSnapshotEntity {
  const s = new BvFetchSnapshotEntity();
  s.id = 'snap-1';
  s.tenantId = TENANT_ID;
  s.organisationsnummer = ORG_NR;
  s.fetchStatus = 'success';
  s.isFromCache = false;
  s.policyDecision = 'fresh_fetch';
  s.costImpactFlags = {};
  s.isStaleFallback = false;
  s.fetchedAt = new Date();
  s.apiCallCount = 3;
  s.rawPayloadSummary = {};
  s.normalisedSummary = {};
  s.identifierUsed = ORG_NR;
  s.identifierType = 'organisationsnummer';
  s.sourceName = 'bolagsverket';
  return Object.assign(s, overrides);
}

function makeDaysOldSnapshot(daysOld: number, overrides: Partial<BvFetchSnapshotEntity> = {}) {
  const date = new Date();
  date.setDate(date.getDate() - daysOld);
  return makeSnapshot({ fetchedAt: date, ...overrides });
}

describe('SnapshotQueryService', () => {
  let service: SnapshotQueryService;
  let snapshotRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    createQueryBuilder: jest.Mock;
  };

  // Chainable QueryBuilder mock
  function makeQbMock(results: BvFetchSnapshotEntity[]) {
    const qb: Record<string, jest.Mock> = {};
    const chain = () => qb;
    qb.where = jest.fn(chain);
    qb.andWhere = jest.fn(chain);
    qb.orderBy = jest.fn(chain);
    qb.take = jest.fn(chain);
    qb.getMany = jest.fn().mockResolvedValue(results);
    return qb;
  }

  beforeEach(async () => {
    snapshotRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SnapshotQueryService,
        {
          provide: getRepositoryToken(BvFetchSnapshotEntity),
          useValue: snapshotRepo,
        },
      ],
    }).compile();

    service = module.get<SnapshotQueryService>(SnapshotQueryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── getSnapshotHistory ────────────────────────────────────────────────────

  describe('getSnapshotHistory', () => {
    it('returns snapshots ordered by fetchedAt DESC', async () => {
      const snapshots = [makeDaysOldSnapshot(1), makeDaysOldSnapshot(5)];
      snapshotRepo.find.mockResolvedValue(snapshots);

      const result = await service.getSnapshotHistory(TENANT_ID, ORG_NR);

      expect(snapshotRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT_ID, organisationsnummer: ORG_NR },
          order: { fetchedAt: 'DESC' },
          take: 20,
        }),
      );
      expect(result).toBe(snapshots);
    });

    it('respects custom limit', async () => {
      snapshotRepo.find.mockResolvedValue([]);
      await service.getSnapshotHistory(TENANT_ID, ORG_NR, 5);
      expect(snapshotRepo.find).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }));
    });

    it('returns empty array when no snapshots exist', async () => {
      snapshotRepo.find.mockResolvedValue([]);
      const result = await service.getSnapshotHistory(TENANT_ID, ORG_NR);
      expect(result).toEqual([]);
    });
  });

  // ── getSnapshotById ───────────────────────────────────────────────────────

  describe('getSnapshotById', () => {
    it('returns snapshot when found for matching tenant', async () => {
      const snap = makeSnapshot({ id: 'snap-abc' });
      snapshotRepo.findOne.mockResolvedValue(snap);

      const result = await service.getSnapshotById(TENANT_ID, 'snap-abc');

      expect(snapshotRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'snap-abc', tenantId: TENANT_ID },
      });
      expect(result).toBe(snap);
    });

    it('returns null when snapshot not found', async () => {
      snapshotRepo.findOne.mockResolvedValue(null);
      const result = await service.getSnapshotById(TENANT_ID, 'nonexistent');
      expect(result).toBeNull();
    });
  });

  // ── getFetchStats ─────────────────────────────────────────────────────────

  describe('getFetchStats', () => {
    it('returns zero stats and null fields when no snapshots exist', async () => {
      snapshotRepo.find.mockResolvedValue([]);
      const stats = await service.getFetchStats(TENANT_ID, ORG_NR);

      expect(stats.totalFetches).toBe(0);
      expect(stats.successRate).toBeNull();
      expect(stats.lastFetchedAt).toBeNull();
      expect(stats.lastSuccessAgeInDays).toBeNull();
    });

    it('computes successRate correctly for mixed results', async () => {
      const snapshots = [
        makeDaysOldSnapshot(1, { fetchStatus: 'success', policyDecision: 'fresh_fetch' }),
        makeDaysOldSnapshot(2, { fetchStatus: 'error', policyDecision: 'fresh_fetch' }),
        makeDaysOldSnapshot(3, { fetchStatus: 'success', policyDecision: 'cache_hit' }),
        makeDaysOldSnapshot(4, { fetchStatus: 'error', policyDecision: 'fresh_fetch' }),
      ];
      snapshotRepo.find.mockResolvedValue(snapshots);

      const stats = await service.getFetchStats(TENANT_ID, ORG_NR);

      expect(stats.totalFetches).toBe(4);
      expect(stats.successCount).toBe(2);
      expect(stats.errorCount).toBe(2);
      expect(stats.successRate).toBeCloseTo(0.5);
    });

    it('returns successRate=1 when all fetches succeed', async () => {
      const snapshots = [
        makeDaysOldSnapshot(1, { fetchStatus: 'success' }),
        makeDaysOldSnapshot(2, { fetchStatus: 'success' }),
      ];
      snapshotRepo.find.mockResolvedValue(snapshots);

      const stats = await service.getFetchStats(TENANT_ID, ORG_NR);
      expect(stats.successRate).toBe(1);
    });

    it('counts cache hits correctly', async () => {
      const snapshots = [
        makeDaysOldSnapshot(1, { policyDecision: 'cache_hit' }),
        makeDaysOldSnapshot(2, { policyDecision: 'fresh_fetch' }),
        makeDaysOldSnapshot(3, { policyDecision: 'cache_hit' }),
        makeDaysOldSnapshot(4, { policyDecision: 'force_refresh' }),
      ];
      snapshotRepo.find.mockResolvedValue(snapshots);

      const stats = await service.getFetchStats(TENANT_ID, ORG_NR);
      expect(stats.cacheHits).toBe(2);
      expect(stats.forceRefreshCount).toBe(1);
    });

    it('sets lastFetchedAt to the most recent snapshot ISO string', async () => {
      const recentDate = new Date();
      const olderDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      const snapshots = [
        makeSnapshot({ fetchedAt: recentDate }),
        makeSnapshot({ id: 'snap-2', fetchedAt: olderDate }),
      ];
      snapshotRepo.find.mockResolvedValue(snapshots);

      const stats = await service.getFetchStats(TENANT_ID, ORG_NR);
      expect(stats.lastFetchedAt).toBe(recentDate.toISOString());
    });

    it('sets lastSuccessAgeInDays to null when no successful fetch exists', async () => {
      const snapshots = [
        makeDaysOldSnapshot(1, { fetchStatus: 'error' }),
        makeDaysOldSnapshot(2, { fetchStatus: 'error' }),
      ];
      snapshotRepo.find.mockResolvedValue(snapshots);

      const stats = await service.getFetchStats(TENANT_ID, ORG_NR);
      expect(stats.lastSuccessAgeInDays).toBeNull();
    });

    it('reports lastSuccessAgeInDays ≈ 5 when most recent success is 5 days old', async () => {
      const snapshots = [
        makeDaysOldSnapshot(5, { fetchStatus: 'success' }),
        makeDaysOldSnapshot(10, { fetchStatus: 'error' }),
      ];
      snapshotRepo.find.mockResolvedValue(snapshots);

      const stats = await service.getFetchStats(TENANT_ID, ORG_NR);
      expect(stats.lastSuccessAgeInDays).toBeGreaterThanOrEqual(4);
      expect(stats.lastSuccessAgeInDays).toBeLessThanOrEqual(6);
    });
  });

  // ── listForAudit ──────────────────────────────────────────────────────────

  describe('listForAudit', () => {
    it('queries all snapshots for tenant when no filters provided', async () => {
      const qb = makeQbMock([]);
      snapshotRepo.createQueryBuilder.mockReturnValue(qb);

      await service.listForAudit(TENANT_ID);

      expect(qb.where).toHaveBeenCalledWith('s.tenantId = :tenantId', { tenantId: TENANT_ID });
      expect(qb.andWhere).not.toHaveBeenCalled();
    });

    it('applies correlationId filter when provided', async () => {
      const qb = makeQbMock([]);
      snapshotRepo.createQueryBuilder.mockReturnValue(qb);

      await service.listForAudit(TENANT_ID, { correlationId: 'corr-123' });

      expect(qb.andWhere).toHaveBeenCalledWith(
        's.correlationId = :correlationId',
        { correlationId: 'corr-123' },
      );
    });

    it('applies actorId filter when provided', async () => {
      const qb = makeQbMock([]);
      snapshotRepo.createQueryBuilder.mockReturnValue(qb);

      await service.listForAudit(TENANT_ID, { actorId: 'user-xyz' });

      expect(qb.andWhere).toHaveBeenCalledWith('s.actorId = :actorId', { actorId: 'user-xyz' });
    });

    it('applies policyDecision filter when provided', async () => {
      const qb = makeQbMock([]);
      snapshotRepo.createQueryBuilder.mockReturnValue(qb);

      await service.listForAudit(TENANT_ID, { policyDecision: 'force_refresh' });

      expect(qb.andWhere).toHaveBeenCalledWith(
        's.policyDecision = :policyDecision',
        { policyDecision: 'force_refresh' },
      );
    });

    it('applies staleFallbackOnly filter when true', async () => {
      const qb = makeQbMock([]);
      snapshotRepo.createQueryBuilder.mockReturnValue(qb);

      await service.listForAudit(TENANT_ID, { staleFallbackOnly: true });

      expect(qb.andWhere).toHaveBeenCalledWith('s.isStaleFallback = TRUE');
    });

    it('does NOT apply staleFallbackOnly filter when false', async () => {
      const qb = makeQbMock([]);
      snapshotRepo.createQueryBuilder.mockReturnValue(qb);

      await service.listForAudit(TENANT_ID, { staleFallbackOnly: false });

      const calls = qb.andWhere.mock.calls.map((c: unknown[]) => c[0] as string);
      expect(calls.some((c) => c.includes('isStaleFallback'))).toBe(false);
    });

    it('respects custom limit', async () => {
      const qb = makeQbMock([]);
      snapshotRepo.createQueryBuilder.mockReturnValue(qb);

      await service.listForAudit(TENANT_ID, { limit: 10 });

      expect(qb.take).toHaveBeenCalledWith(10);
    });
  });

  // ── findByCorrelationId ───────────────────────────────────────────────────

  describe('findByCorrelationId', () => {
    it('finds snapshots by tenantId and correlationId', async () => {
      const snapshots = [makeSnapshot({ correlationId: 'corr-abc' })];
      snapshotRepo.find.mockResolvedValue(snapshots);

      const result = await service.findByCorrelationId(TENANT_ID, 'corr-abc');

      expect(snapshotRepo.find).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID, correlationId: 'corr-abc' },
        order: { fetchedAt: 'DESC' },
      });
      expect(result).toBe(snapshots);
    });

    it('returns empty array when no matching snapshot exists', async () => {
      snapshotRepo.find.mockResolvedValue([]);
      const result = await service.findByCorrelationId(TENANT_ID, 'nonexistent-corr');
      expect(result).toEqual([]);
    });
  });
});
