import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BvFetchSnapshotEntity,
  generateReplayId,
} from '../entities/bv-fetch-snapshot.entity';
import { AuditService } from '../../audit/audit.service';
import { SnapshotChainService } from './snapshot-chain.service';

// ── Test fixtures ─────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-t07';
const ORG_NR = '5560000007';

let idCounter = 0;
function makeSnapshot(
  overrides: Partial<BvFetchSnapshotEntity> = {},
): BvFetchSnapshotEntity {
  idCounter++;
  const s = new BvFetchSnapshotEntity();
  s.id = `snap-${idCounter}`;
  s.tenantId = TENANT_ID;
  s.organisationsnummer = ORG_NR;
  s.fetchStatus = 'success';
  s.isFromCache = false;
  s.policyDecision = 'fresh_fetch';
  s.costImpactFlags = {};
  s.isStaleFallback = false;
  s.fetchedAt = new Date();
  s.apiCallCount = 0;
  s.rawPayloadSummary = {};
  s.normalisedSummary = {};
  s.identifierUsed = ORG_NR;
  s.identifierType = 'organisationsnummer';
  s.sourceName = 'bolagsverket';
  s.versionNumber = 1;
  s.sequenceNumber = 1;
  s.chainBroken = false;
  s.previousSnapshotId = null;
  s.replayId = null;
  s.payloadHash = null;
  return Object.assign(s, overrides);
}

function makeDated(daysAgo: number, overrides: Partial<BvFetchSnapshotEntity> = {}) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return makeSnapshot({ fetchedAt: d, ...overrides });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeQbMock(result: BvFetchSnapshotEntity | null) {
  const qb: Record<string, jest.Mock> = {};
  const chain = () => qb;
  qb.where = jest.fn(chain);
  qb.andWhere = jest.fn(chain);
  qb.orderBy = jest.fn(chain);
  qb.limit = jest.fn(chain);
  qb.getOne = jest.fn().mockResolvedValue(result);
  return qb;
}

// ── Describe suite ────────────────────────────────────────────────────────────

describe('SnapshotChainService', () => {
  let service: SnapshotChainService;
  let snapshotRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let auditService: { log: jest.Mock };

  beforeEach(async () => {
    idCounter = 0;

    snapshotRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn((entity: BvFetchSnapshotEntity) => Promise.resolve(entity)),
      createQueryBuilder: jest.fn(),
    };

    auditService = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SnapshotChainService,
        { provide: getRepositoryToken(BvFetchSnapshotEntity), useValue: snapshotRepo },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<SnapshotChainService>(SnapshotChainService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── generateReplayId (pure helper) ─────────────────────────────────────────

  describe('generateReplayId', () => {
    it('returns a string prefixed with "rp-"', () => {
      const id = generateReplayId(TENANT_ID, ORG_NR, 'snap-1', 'hash-abc');
      expect(id).toMatch(/^rp-[0-9a-f]{48}$/);
    });

    it('is deterministic: same inputs produce same ID', () => {
      const a = generateReplayId(TENANT_ID, ORG_NR, 'snap-1', 'hash-abc');
      const b = generateReplayId(TENANT_ID, ORG_NR, 'snap-1', 'hash-abc');
      expect(a).toBe(b);
    });

    it('differs when snapshotId changes', () => {
      const a = generateReplayId(TENANT_ID, ORG_NR, 'snap-1', 'hash-abc');
      const b = generateReplayId(TENANT_ID, ORG_NR, 'snap-2', 'hash-abc');
      expect(a).not.toBe(b);
    });

    it('differs when tenantId changes', () => {
      const a = generateReplayId('tenant-A', ORG_NR, 'snap-1', 'hash-abc');
      const b = generateReplayId('tenant-B', ORG_NR, 'snap-1', 'hash-abc');
      expect(a).not.toBe(b);
    });

    it('handles null payloadHash without throwing', () => {
      expect(() => generateReplayId(TENANT_ID, ORG_NR, 'snap-1', null)).not.toThrow();
    });

    it('produces same ID for null and undefined payloadHash', () => {
      const a = generateReplayId(TENANT_ID, ORG_NR, 'snap-1', null);
      const b = generateReplayId(TENANT_ID, ORG_NR, 'snap-1', undefined);
      expect(a).toBe(b);
    });
  });

  // ── linkSnapshot ────────────────────────────────────────────────────────────

  describe('linkSnapshot', () => {
    it('throws when snapshot not found', async () => {
      snapshotRepo.findOne.mockResolvedValue(null);

      await expect(
        service.linkSnapshot(TENANT_ID, 'nonexistent', ORG_NR),
      ).rejects.toThrow(/Cannot link snapshot/);
    });

    it('sets versionNumber=1 and previousSnapshotId=null for the first snapshot', async () => {
      const newSnap = makeSnapshot({ id: 'snap-first' });

      // findOne for the new snapshot itself
      snapshotRepo.findOne.mockResolvedValueOnce(newSnap);
      // findOne for predecessor query (none exists → same id returned, treated as null)
      snapshotRepo.findOne.mockResolvedValueOnce(newSnap);

      const result = await service.linkSnapshot(TENANT_ID, 'snap-first', ORG_NR);

      expect(result.versionNumber).toBe(1);
      expect(result.previousSnapshotId).toBeNull();
      expect(result.replayId).toMatch(/^rp-/);
      expect(result.chainBroken).toBe(false);
    });

    it('links new snapshot to predecessor and increments versionNumber', async () => {
      const predecessor = makeSnapshot({ id: 'snap-prev', versionNumber: 3 });
      const newSnap = makeSnapshot({ id: 'snap-new' });

      snapshotRepo.findOne
        .mockResolvedValueOnce(newSnap)      // load new snapshot
        .mockResolvedValueOnce(predecessor); // find predecessor

      const result = await service.linkSnapshot(TENANT_ID, 'snap-new', ORG_NR);

      expect(result.previousSnapshotId).toBe('snap-prev');
      expect(result.versionNumber).toBe(4);
      expect(result.sequenceNumber).toBe(4);
    });

    it('persists the snapshot and emits audit event', async () => {
      const snap = makeSnapshot({ id: 'snap-x' });
      snapshotRepo.findOne
        .mockResolvedValueOnce(snap)
        .mockResolvedValueOnce(null); // no predecessor

      await service.linkSnapshot(TENANT_ID, 'snap-x', ORG_NR);

      expect(snapshotRepo.save).toHaveBeenCalledTimes(1);
      // Audit is best-effort / async — give it a tick to fire
      await Promise.resolve();
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'snapshot_chain.link_created' }),
      );
    });
  });

  // ── getVersionChain ─────────────────────────────────────────────────────────

  describe('getVersionChain', () => {
    it('returns snapshots ordered by sequenceNumber DESC', async () => {
      const snaps = [makeDated(1), makeDated(5)];
      snapshotRepo.find.mockResolvedValue(snaps);

      const result = await service.getVersionChain(TENANT_ID, ORG_NR);

      expect(snapshotRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT_ID, organisationsnummer: ORG_NR },
          order: { sequenceNumber: 'DESC' },
        }),
      );
      expect(result).toBe(snaps);
    });

    it('caps limit at 200', async () => {
      snapshotRepo.find.mockResolvedValue([]);
      await service.getVersionChain(TENANT_ID, ORG_NR, 999);
      expect(snapshotRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 200 }),
      );
    });

    it('returns empty array when no snapshots', async () => {
      snapshotRepo.find.mockResolvedValue([]);
      expect(await service.getVersionChain(TENANT_ID, ORG_NR)).toEqual([]);
    });
  });

  // ── walkChain ───────────────────────────────────────────────────────────────

  describe('walkChain', () => {
    it('returns a single snapshot when there is no predecessor', async () => {
      const snap = makeSnapshot({ id: 'snap-root', previousSnapshotId: null });
      snapshotRepo.findOne.mockResolvedValue(snap);

      const chain = await service.walkChain(TENANT_ID, 'snap-root');

      expect(chain).toHaveLength(1);
      expect(chain[0].id).toBe('snap-root');
    });

    it('walks backwards through the chain', async () => {
      const root = makeSnapshot({ id: 'snap-1', previousSnapshotId: null, versionNumber: 1 });
      const middle = makeSnapshot({ id: 'snap-2', previousSnapshotId: 'snap-1', versionNumber: 2 });
      const latest = makeSnapshot({ id: 'snap-3', previousSnapshotId: 'snap-2', versionNumber: 3 });

      snapshotRepo.findOne
        .mockResolvedValueOnce(latest)
        .mockResolvedValueOnce(middle)
        .mockResolvedValueOnce(root);

      const chain = await service.walkChain(TENANT_ID, 'snap-3');

      expect(chain.map((s) => s.id)).toEqual(['snap-3', 'snap-2', 'snap-1']);
    });

    it('stops and marks broken link when predecessor is missing', async () => {
      const snap = makeSnapshot({
        id: 'snap-orphan',
        previousSnapshotId: 'snap-missing',
        chainBroken: false,
      });

      snapshotRepo.findOne
        .mockResolvedValueOnce(snap) // snap-orphan found
        .mockResolvedValueOnce(null); // snap-missing not found

      const chain = await service.walkChain(TENANT_ID, 'snap-orphan');

      expect(chain).toHaveLength(1);
      // chainBroken should be set and saved
      expect(snapshotRepo.save).toHaveBeenCalledWith(expect.objectContaining({ chainBroken: true }));
      await Promise.resolve();
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'snapshot_chain.broken_link_detected' }),
      );
    });

    it('detects and stops on cycles', async () => {
      const snap1 = makeSnapshot({ id: 'snap-A', previousSnapshotId: 'snap-B' });
      const snap2 = makeSnapshot({ id: 'snap-B', previousSnapshotId: 'snap-A' }); // cycle

      snapshotRepo.findOne
        .mockResolvedValueOnce(snap1) // snap-A
        .mockResolvedValueOnce(snap2) // snap-B
        // next would be snap-A again → cycle detected before findOne called
        ;

      const chain = await service.walkChain(TENANT_ID, 'snap-A', 10);

      // Should stop without infinite loop
      expect(chain.length).toBeLessThanOrEqual(2);
    });

    it('respects maxSteps limit', async () => {
      // Build a chain of 5 but only walk 2 steps
      const snaps = Array.from({ length: 5 }, (_, i) =>
        makeSnapshot({
          id: `chain-${i}`,
          previousSnapshotId: i > 0 ? `chain-${i - 1}` : null,
        }),
      );
      snapshotRepo.findOne.mockImplementation(({ where }: { where: { id: string } }) =>
        Promise.resolve(snaps.find((s) => s.id === where.id) ?? null),
      );

      const chain = await service.walkChain(TENANT_ID, 'chain-4', 2);
      expect(chain).toHaveLength(2);
    });
  });

  // ── findSnapshotAtTimestamp ─────────────────────────────────────────────────

  describe('findSnapshotAtTimestamp', () => {
    it('returns snapshot at or before the given timestamp', async () => {
      const targetDate = new Date('2024-06-15T12:00:00Z');
      const snap = makeDated(0);
      const qb = makeQbMock(snap);
      snapshotRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findSnapshotAtTimestamp(TENANT_ID, ORG_NR, targetDate);

      expect(result).toBe(snap);
      expect(qb.andWhere).toHaveBeenCalledWith(
        's.fetchedAt <= :timestamp',
        { timestamp: targetDate },
      );
    });

    it('returns null when no snapshot predates the timestamp', async () => {
      const qb = makeQbMock(null);
      snapshotRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findSnapshotAtTimestamp(
        TENANT_ID,
        ORG_NR,
        new Date('2000-01-01'),
      );
      expect(result).toBeNull();
    });
  });

  // ── validateChain ───────────────────────────────────────────────────────────

  describe('validateChain', () => {
    it('returns valid=true for an empty chain', async () => {
      snapshotRepo.find.mockResolvedValue([]);
      const res = await service.validateChain(TENANT_ID, ORG_NR);
      expect(res.valid).toBe(true);
      expect(res.snapshotCount).toBe(0);
    });

    it('returns valid=true for a well-formed 3-snapshot chain', async () => {
      const s1 = makeSnapshot({ id: 'v1', versionNumber: 1, sequenceNumber: 1, previousSnapshotId: null });
      const s2 = makeSnapshot({ id: 'v2', versionNumber: 2, sequenceNumber: 2, previousSnapshotId: 'v1' });
      const s3 = makeSnapshot({ id: 'v3', versionNumber: 3, sequenceNumber: 3, previousSnapshotId: 'v2' });
      snapshotRepo.find.mockResolvedValue([s1, s2, s3]);

      const res = await service.validateChain(TENANT_ID, ORG_NR);
      expect(res.valid).toBe(true);
      expect(res.issues).toHaveLength(0);
    });

    it('detects flagged broken links', async () => {
      const s1 = makeSnapshot({ id: 'v1', versionNumber: 1, sequenceNumber: 1, chainBroken: true });
      snapshotRepo.find.mockResolvedValue([s1]);

      const res = await service.validateChain(TENANT_ID, ORG_NR);
      expect(res.valid).toBe(false);
      expect(res.brokenLinkCount).toBe(1);
      expect(res.issues.some((i) => i.includes('chain_broken'))).toBe(true);
    });

    it('detects sequence gaps', async () => {
      const s1 = makeSnapshot({ id: 'v1', versionNumber: 1, sequenceNumber: 1 });
      const s2 = makeSnapshot({ id: 'v2', versionNumber: 3, sequenceNumber: 3, previousSnapshotId: 'v1' });
      snapshotRepo.find.mockResolvedValue([s1, s2]);

      const res = await service.validateChain(TENANT_ID, ORG_NR);
      expect(res.valid).toBe(false);
      expect(res.issues.some((i) => i.includes('Sequence gap'))).toBe(true);
    });

    it('detects broken previousSnapshotId reference', async () => {
      const s1 = makeSnapshot({
        id: 'v2',
        versionNumber: 2,
        sequenceNumber: 2,
        previousSnapshotId: 'v1-missing',
      });
      snapshotRepo.find.mockResolvedValue([s1]);

      const res = await service.validateChain(TENANT_ID, ORG_NR);
      expect(res.valid).toBe(false);
      expect(res.brokenLinkCount).toBeGreaterThan(0);
    });

    it('detects cycles', async () => {
      const s1 = makeSnapshot({ id: 'v1', versionNumber: 1, sequenceNumber: 1, previousSnapshotId: 'v2' });
      const s2 = makeSnapshot({ id: 'v2', versionNumber: 2, sequenceNumber: 2, previousSnapshotId: 'v1' });
      snapshotRepo.find.mockResolvedValue([s1, s2]);

      const res = await service.validateChain(TENANT_ID, ORG_NR);
      expect(res.valid).toBe(false);
      expect(res.issues.some((i) => i.toLowerCase().includes('cycle'))).toBe(true);
    });
  });

  // ── reconstructChain ────────────────────────────────────────────────────────

  describe('reconstructChain', () => {
    it('returns relinkedCount=0 and fullyReconstructed=true for empty chain', async () => {
      snapshotRepo.find.mockResolvedValue([]);
      const res = await service.reconstructChain(TENANT_ID, ORG_NR);
      expect(res).toEqual({ relinkedCount: 0, fullyReconstructed: true });
    });

    it('re-links snapshots in chronological order', async () => {
      const older = makeDated(5, { id: 'old', previousSnapshotId: null, versionNumber: 1 });
      const newer = makeDated(1, {
        id: 'new',
        previousSnapshotId: null, // broken
        versionNumber: 1,         // wrong
        chainBroken: true,
      });
      // find returns sorted ASC by fetchedAt (older first)
      snapshotRepo.find.mockResolvedValue([older, newer]);

      const res = await service.reconstructChain(TENANT_ID, ORG_NR);

      expect(res.relinkedCount).toBeGreaterThan(0);
      expect(snapshotRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'new', previousSnapshotId: 'old', versionNumber: 2 }),
      );
      await Promise.resolve();
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'snapshot_chain.reconstruction_attempted' }),
      );
    });

    it('sets fullyReconstructed=true', async () => {
      const s = makeDated(3, { id: 's1', versionNumber: 99, chainBroken: true });
      snapshotRepo.find.mockResolvedValue([s]);

      const res = await service.reconstructChain(TENANT_ID, ORG_NR);
      expect(res.fullyReconstructed).toBe(true);
    });

    it('regenerates replayId during reconstruction', async () => {
      const s = makeDated(3, { id: 's1', replayId: 'old-replay-id', versionNumber: 99, chainBroken: true });
      snapshotRepo.find.mockResolvedValue([s]);

      await service.reconstructChain(TENANT_ID, ORG_NR);

      const savedCall = snapshotRepo.save.mock.calls[0][0] as BvFetchSnapshotEntity;
      expect(savedCall.replayId).toMatch(/^rp-/);
      expect(savedCall.replayId).not.toBe('old-replay-id');
    });
  });

  // ── findByReplayId ──────────────────────────────────────────────────────────

  describe('findByReplayId', () => {
    it('delegates to repository with tenantId and replayId', async () => {
      const snap = makeSnapshot({ replayId: 'rp-abc123' });
      snapshotRepo.findOne.mockResolvedValue(snap);

      const result = await service.findByReplayId(TENANT_ID, 'rp-abc123');

      expect(snapshotRepo.findOne).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID, replayId: 'rp-abc123' },
      });
      expect(result).toBe(snap);
    });

    it('returns null when not found', async () => {
      snapshotRepo.findOne.mockResolvedValue(null);
      expect(await service.findByReplayId(TENANT_ID, 'rp-nope')).toBeNull();
    });
  });

  // ── computeReplayId ─────────────────────────────────────────────────────────

  describe('computeReplayId', () => {
    it('returns a deterministic rp- prefixed string', () => {
      const snap = makeSnapshot({ id: 'snap-compute', payloadHash: 'ph-xyz' });
      const id1 = service.computeReplayId(snap);
      const id2 = service.computeReplayId(snap);
      expect(id1).toMatch(/^rp-/);
      expect(id1).toBe(id2);
    });

    it('matches generateReplayId helper output', () => {
      const snap = makeSnapshot({ id: 'snap-match', payloadHash: 'ph-abc' });
      const expected = generateReplayId(TENANT_ID, ORG_NR, 'snap-match', 'ph-abc');
      expect(service.computeReplayId(snap)).toBe(expected);
    });
  });
});
