import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BvFetchSnapshotEntity } from '../entities/bv-fetch-snapshot.entity';
import {
  ChangeType,
  CompanyChangeEventEntity,
} from '../entities/company-change-event.entity';
import { AuditService } from '../../audit/audit.service';
import {
  BatchComparisonInput,
  SnapshotComparisonService,
} from './snapshot-comparison.service';

// ── Test fixtures ─────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-t08';
const ORG_NR = '5560000008';

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
  s.correlationId = null;
  s.actorId = null;
  return Object.assign(s, overrides);
}

// ── Describe suite ────────────────────────────────────────────────────────────

describe('SnapshotComparisonService', () => {
  let service: SnapshotComparisonService;
  let snapshotRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    save: jest.Mock;
  };
  let changeEventRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    save: jest.Mock;
  };
  let auditService: { log: jest.Mock };

  beforeEach(async () => {
    idCounter = 0;

    snapshotRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn((entity) => Promise.resolve(entity)),
    };

    changeEventRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn((entities) =>
        Promise.resolve(Array.isArray(entities) ? entities : [entities]),
      ),
    };

    auditService = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SnapshotComparisonService,
        { provide: getRepositoryToken(BvFetchSnapshotEntity), useValue: snapshotRepo },
        { provide: getRepositoryToken(CompanyChangeEventEntity), useValue: changeEventRepo },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<SnapshotComparisonService>(SnapshotComparisonService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── _flattenAttributes ─────────────────────────────────────────────────────

  describe('_flattenAttributes', () => {
    it('flattens a flat object unchanged', () => {
      const result = service._flattenAttributes({ a: 1, b: 'hello' });
      expect(result.get('a')).toBe(1);
      expect(result.get('b')).toBe('hello');
    });

    it('flattens nested objects with dot notation', () => {
      const result = service._flattenAttributes({ address: { city: 'Stockholm', zip: '11111' } });
      expect(result.get('address.city')).toBe('Stockholm');
      expect(result.get('address.zip')).toBe('11111');
    });

    it('flattens deeply nested objects', () => {
      const result = service._flattenAttributes({ a: { b: { c: 42 } } });
      expect(result.get('a.b.c')).toBe(42);
    });

    it('stores arrays as-is (not expanded)', () => {
      const arr = [1, 2, 3];
      const result = service._flattenAttributes({ items: arr });
      expect(result.get('items')).toBe(arr);
    });

    it('stores null values', () => {
      const result = service._flattenAttributes({ name: null });
      expect(result.get('name')).toBeNull();
    });

    it('stores boolean false', () => {
      const result = service._flattenAttributes({ active: false });
      expect(result.get('active')).toBe(false);
    });

    it('returns empty map for empty object', () => {
      expect(service._flattenAttributes({}).size).toBe(0);
    });
  });

  // ── _deepEqual ─────────────────────────────────────────────────────────────

  describe('_deepEqual', () => {
    it('returns true for identical primitives', () => {
      expect(service._deepEqual(1, 1)).toBe(true);
      expect(service._deepEqual('hello', 'hello')).toBe(true);
      expect(service._deepEqual(true, true)).toBe(true);
    });

    it('returns false for different primitives', () => {
      expect(service._deepEqual(1, 2)).toBe(false);
      expect(service._deepEqual('a', 'b')).toBe(false);
    });

    it('returns true for null === null', () => {
      expect(service._deepEqual(null, null)).toBe(true);
    });

    it('returns false when one side is null', () => {
      expect(service._deepEqual(null, 'x')).toBe(false);
      expect(service._deepEqual('x', null)).toBe(false);
    });

    it('returns true for objects with same keys in different order', () => {
      const a = { b: 2, a: 1 };
      const b = { a: 1, b: 2 };
      expect(service._deepEqual(a, b)).toBe(true);
    });

    it('returns false for null vs undefined', () => {
      expect(service._deepEqual(null, undefined)).toBe(false);
    });

    it('returns true for deeply equal objects', () => {
      expect(service._deepEqual({ a: 1 }, { a: 1 })).toBe(true);
    });

    it('returns false for different objects', () => {
      expect(service._deepEqual({ a: 1 }, { a: 2 })).toBe(false);
    });

    it('returns true for equal arrays', () => {
      expect(service._deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    });

    it('returns false for arrays with different contents', () => {
      expect(service._deepEqual([1, 2], [1, 3])).toBe(false);
    });
  });

  // ── _diffAttributes ────────────────────────────────────────────────────────

  describe('_diffAttributes', () => {
    function makeMap(obj: Record<string, unknown>): Map<string, unknown> {
      return new Map(Object.entries(obj));
    }

    it('classifies new key as ADDED', () => {
      const before = makeMap({ a: 1 });
      const after = makeMap({ a: 1, b: 2 });
      const changes = service._diffAttributes(before, after);
      const added = changes.find((c) => c.attributeName === 'b');
      expect(added?.changeType).toBe(ChangeType.ADDED);
      expect(added?.newValue).toBe(2);
      expect(added?.oldValue).toBeUndefined();
    });

    it('classifies removed key as REMOVED', () => {
      const before = makeMap({ a: 1, b: 2 });
      const after = makeMap({ a: 1 });
      const changes = service._diffAttributes(before, after);
      const removed = changes.find((c) => c.attributeName === 'b');
      expect(removed?.changeType).toBe(ChangeType.REMOVED);
      expect(removed?.oldValue).toBe(2);
      expect(removed?.newValue).toBeUndefined();
    });

    it('classifies changed value as MODIFIED', () => {
      const before = makeMap({ a: 'old' });
      const after = makeMap({ a: 'new' });
      const changes = service._diffAttributes(before, after);
      const modified = changes.find((c) => c.attributeName === 'a');
      expect(modified?.changeType).toBe(ChangeType.MODIFIED);
      expect(modified?.oldValue).toBe('old');
      expect(modified?.newValue).toBe('new');
    });

    it('classifies unchanged value as UNCHANGED', () => {
      const before = makeMap({ a: 42 });
      const after = makeMap({ a: 42 });
      const changes = service._diffAttributes(before, after);
      const unchanged = changes.find((c) => c.attributeName === 'a');
      expect(unchanged?.changeType).toBe(ChangeType.UNCHANGED);
    });

    it('handles empty before (all ADDED)', () => {
      const before = makeMap({});
      const after = makeMap({ x: 1, y: 2 });
      const changes = service._diffAttributes(before, after);
      expect(changes.every((c) => c.changeType === ChangeType.ADDED)).toBe(true);
      expect(changes).toHaveLength(2);
    });

    it('handles empty after (all REMOVED)', () => {
      const before = makeMap({ x: 1, y: 2 });
      const after = makeMap({});
      const changes = service._diffAttributes(before, after);
      expect(changes.every((c) => c.changeType === ChangeType.REMOVED)).toBe(true);
      expect(changes).toHaveLength(2);
    });

    it('handles both empty (no changes)', () => {
      expect(service._diffAttributes(new Map(), new Map())).toHaveLength(0);
    });

    it('detects null → value as MODIFIED (not ADDED)', () => {
      const before = makeMap({ a: null });
      const after = makeMap({ a: 'value' });
      const changes = service._diffAttributes(before, after);
      expect(changes[0].changeType).toBe(ChangeType.MODIFIED);
    });

    it('detects value → null as MODIFIED (not REMOVED)', () => {
      const before = makeMap({ a: 'value' });
      const after = makeMap({ a: null });
      const changes = service._diffAttributes(before, after);
      expect(changes[0].changeType).toBe(ChangeType.MODIFIED);
    });
  });

  // ── compareSnapshots ───────────────────────────────────────────────────────

  describe('compareSnapshots', () => {
    it('returns failure result when after-snapshot not found', async () => {
      snapshotRepo.findOne.mockResolvedValue(null);
      const result = await service.compareSnapshots(TENANT_ID, 'snap-missing', null);
      expect(result.success).toBe(false);
      expect(result.errorMessage).toMatch(/not found/i);
    });

    it('returns failure result when before-snapshot not found', async () => {
      const afterSnap = makeSnapshot({ id: 'snap-after' });
      snapshotRepo.findOne
        .mockResolvedValueOnce(afterSnap) // after found
        .mockResolvedValueOnce(null);     // before not found
      const result = await service.compareSnapshots(TENANT_ID, 'snap-after', 'snap-before-missing');
      expect(result.success).toBe(false);
    });

    it('classifies all attributes as ADDED when no before-snapshot', async () => {
      const afterSnap = makeSnapshot({
        id: 'snap-first',
        normalisedSummary: { legalName: 'ACME AB', status: 'active' },
      });
      snapshotRepo.findOne.mockResolvedValue(afterSnap);

      const result = await service.compareSnapshots(TENANT_ID, 'snap-first', null);

      expect(result.success).toBe(true);
      expect(result.changes.every((c) => c.changeType === ChangeType.ADDED)).toBe(true);
      expect(result.changes.map((c) => c.attributeName).sort()).toEqual(['legalName', 'status']);
    });

    it('detects MODIFIED change between two snapshots', async () => {
      const beforeSnap = makeSnapshot({
        id: 'snap-before',
        normalisedSummary: { legalName: 'Old Name AB' },
      });
      const afterSnap = makeSnapshot({
        id: 'snap-after',
        normalisedSummary: { legalName: 'New Name AB' },
      });
      snapshotRepo.findOne
        .mockResolvedValueOnce(afterSnap)
        .mockResolvedValueOnce(beforeSnap);

      const result = await service.compareSnapshots(TENANT_ID, 'snap-after', 'snap-before');

      expect(result.success).toBe(true);
      const change = result.changes.find((c) => c.attributeName === 'legalName');
      expect(change?.changeType).toBe(ChangeType.MODIFIED);
      expect(change?.oldValue).toBe('Old Name AB');
      expect(change?.newValue).toBe('New Name AB');
    });

    it('detects REMOVED attribute', async () => {
      const beforeSnap = makeSnapshot({
        id: 'snap-before',
        normalisedSummary: { legalName: 'ACME', shareCapital: 100000 },
      });
      const afterSnap = makeSnapshot({
        id: 'snap-after',
        normalisedSummary: { legalName: 'ACME' },
      });
      snapshotRepo.findOne
        .mockResolvedValueOnce(afterSnap)
        .mockResolvedValueOnce(beforeSnap);

      const result = await service.compareSnapshots(TENANT_ID, 'snap-after', 'snap-before');

      const removed = result.changes.find((c) => c.attributeName === 'shareCapital');
      expect(removed?.changeType).toBe(ChangeType.REMOVED);
    });

    it('detects UNCHANGED attribute', async () => {
      const snap = makeSnapshot({
        id: 'snap-same',
        normalisedSummary: { legalName: 'SAME NAME' },
      });
      snapshotRepo.findOne
        .mockResolvedValueOnce(snap)  // after
        .mockResolvedValueOnce(makeSnapshot({
          id: 'snap-prev',
          normalisedSummary: { legalName: 'SAME NAME' },
        })); // before

      const result = await service.compareSnapshots(TENANT_ID, 'snap-same', 'snap-prev');
      const unchanged = result.changes.find((c) => c.attributeName === 'legalName');
      expect(unchanged?.changeType).toBe(ChangeType.UNCHANGED);
    });

    it('persists change events to the repository', async () => {
      const beforeSnap = makeSnapshot({
        id: 'snap-b',
        normalisedSummary: { a: 1 },
      });
      const afterSnap = makeSnapshot({
        id: 'snap-a',
        normalisedSummary: { a: 2 },
      });
      snapshotRepo.findOne
        .mockResolvedValueOnce(afterSnap)
        .mockResolvedValueOnce(beforeSnap);

      await service.compareSnapshots(TENANT_ID, 'snap-a', 'snap-b');

      expect(changeEventRepo.save).toHaveBeenCalledTimes(1);
      const savedEvents = changeEventRepo.save.mock.calls[0][0] as CompanyChangeEventEntity[];
      expect(savedEvents).toHaveLength(1);
      expect(savedEvents[0].changeType).toBe(ChangeType.MODIFIED);
      expect(savedEvents[0].oldValue).toBe(JSON.stringify(1));
      expect(savedEvents[0].newValue).toBe(JSON.stringify(2));
    });

    it('does not persist events when there are no attributes', async () => {
      const snap = makeSnapshot({ id: 'snap-empty', normalisedSummary: {} });
      snapshotRepo.findOne.mockResolvedValue(snap);

      await service.compareSnapshots(TENANT_ID, 'snap-empty', null);

      expect(changeEventRepo.save).not.toHaveBeenCalled();
    });

    it('emits a snapshot.comparison_completed audit event', async () => {
      const afterSnap = makeSnapshot({
        id: 'snap-audit',
        normalisedSummary: { x: 1 },
      });
      snapshotRepo.findOne.mockResolvedValue(afterSnap);

      await service.compareSnapshots(TENANT_ID, 'snap-audit', null);

      await Promise.resolve();
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'snapshot.comparison_completed' }),
      );
    });

    it('sets snapshotIdBefore=null in events when no before-snapshot provided', async () => {
      const afterSnap = makeSnapshot({
        id: 'snap-new',
        normalisedSummary: { name: 'ACME' },
      });
      snapshotRepo.findOne.mockResolvedValue(afterSnap);

      await service.compareSnapshots(TENANT_ID, 'snap-new', null);

      const savedEvents = changeEventRepo.save.mock.calls[0][0] as CompanyChangeEventEntity[];
      expect(savedEvents[0].snapshotIdBefore).toBeNull();
      expect(savedEvents[0].snapshotIdAfter).toBe('snap-new');
    });

    it('stores correlation_id and actor_id from the after-snapshot', async () => {
      const afterSnap = makeSnapshot({
        id: 'snap-ctx',
        normalisedSummary: { val: 1 },
        correlationId: 'corr-abc',
        actorId: 'actor-uuid',
      });
      snapshotRepo.findOne.mockResolvedValue(afterSnap);

      await service.compareSnapshots(TENANT_ID, 'snap-ctx', null);

      const savedEvents = changeEventRepo.save.mock.calls[0][0] as CompanyChangeEventEntity[];
      expect(savedEvents[0].correlationId).toBe('corr-abc');
      expect(savedEvents[0].actorId).toBe('actor-uuid');
    });

    it('handles comparison failure gracefully (persists UNKNOWN event)', async () => {
      // Simulate a DB error on the first findOne call inside _doCompare,
      // then a null result for the fallback findOne in _persistUnknownFailureEvent.
      snapshotRepo.findOne
        .mockRejectedValueOnce(new Error('DB connection lost'))
        .mockResolvedValueOnce(null);

      const result = await service.compareSnapshots(TENANT_ID, 'snap-fail', null);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toMatch(/DB connection/);
    });
  });

  // ── compareBatch ───────────────────────────────────────────────────────────

  describe('compareBatch', () => {
    it('returns results in input order', async () => {
      const snap1 = makeSnapshot({ id: 'snap-b1', normalisedSummary: { x: 1 } });
      const snap2 = makeSnapshot({ id: 'snap-b2', normalisedSummary: { x: 2 } });

      // Each compareSnapshots call makes findOne calls for after (and possibly before)
      snapshotRepo.findOne
        .mockResolvedValueOnce(snap1)
        .mockResolvedValueOnce(snap2);

      const inputs: BatchComparisonInput[] = [
        { tenantId: TENANT_ID, snapshotIdAfter: 'snap-b1' },
        { tenantId: TENANT_ID, snapshotIdAfter: 'snap-b2' },
      ];

      const results = await service.compareBatch(inputs);

      expect(results).toHaveLength(2);
      expect(results[0].snapshotIdAfter).toBe('snap-b1');
      expect(results[1].snapshotIdAfter).toBe('snap-b2');
    });

    it('continues processing remaining inputs after a failure', async () => {
      const snap = makeSnapshot({ id: 'snap-ok', normalisedSummary: {} });

      // First call throws, second call succeeds
      snapshotRepo.findOne
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce(null) // for _persistUnknownFailureEvent inside failure handler
        .mockResolvedValueOnce(snap);

      const inputs: BatchComparisonInput[] = [
        { tenantId: TENANT_ID, snapshotIdAfter: 'snap-fail' },
        { tenantId: TENANT_ID, snapshotIdAfter: 'snap-ok' },
      ];

      const results = await service.compareBatch(inputs);

      expect(results[0].success).toBe(false);
      expect(results[1].success).toBe(true);
    });

    it('returns empty array for empty input', async () => {
      const results = await service.compareBatch([]);
      expect(results).toHaveLength(0);
    });
  });
});
