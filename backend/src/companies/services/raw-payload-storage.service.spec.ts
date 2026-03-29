import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BvRawPayloadEntity } from '../entities/bv-raw-payload.entity';
import { RawPayloadStorageService } from './raw-payload-storage.service';
import { AuditService } from '../../audit/audit.service';

const TENANT_ID = 'tenant-abc';
const ORG_NR = '5560000001';

function makeRawPayload(overrides: Partial<BvRawPayloadEntity> = {}): BvRawPayloadEntity {
  const e = new BvRawPayloadEntity();
  e.id = 'rp-1';
  e.tenantId = TENANT_ID;
  e.checksum = 'abc123';
  e.providerSource = 'bolagsverket';
  e.organisationsnummer = ORG_NR;
  e.content = { foo: 'bar' };
  e.metadata = {};
  e.payloadVersion = '1';
  e.payloadSizeBytes = 13;
  e.isDuplicate = false;
  e.createdAt = new Date();
  return Object.assign(e, overrides);
}

describe('RawPayloadStorageService', () => {
  let service: RawPayloadStorageService;
  let rawPayloadRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let auditService: { log: jest.Mock };

  beforeEach(async () => {
    rawPayloadRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    auditService = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RawPayloadStorageService,
        {
          provide: getRepositoryToken(BvRawPayloadEntity),
          useValue: rawPayloadRepo,
        },
        {
          provide: AuditService,
          useValue: auditService,
        },
      ],
    }).compile();

    service = module.get<RawPayloadStorageService>(RawPayloadStorageService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── computeChecksum ────────────────────────────────────────────────────────

  describe('computeChecksum', () => {
    it('returns a 64-character hex SHA-256 digest', () => {
      const checksum = service.computeChecksum({ a: 1 });
      expect(checksum).toHaveLength(64);
      expect(/^[0-9a-f]+$/.test(checksum)).toBe(true);
    });

    it('is deterministic: same content → same checksum', () => {
      const content = { z: 3, a: 1, m: 2 };
      expect(service.computeChecksum(content)).toBe(service.computeChecksum(content));
    });

    it('is key-order-independent: {a,b} and {b,a} → same checksum', () => {
      const c1 = service.computeChecksum({ a: 1, b: 2 });
      const c2 = service.computeChecksum({ b: 2, a: 1 });
      expect(c1).toBe(c2);
    });

    it('produces different checksums for different content', () => {
      const c1 = service.computeChecksum({ a: 1 });
      const c2 = service.computeChecksum({ a: 2 });
      expect(c1).not.toBe(c2);
    });

    it('handles nested objects deterministically', () => {
      const c1 = service.computeChecksum({ outer: { z: 99, a: 1 } });
      const c2 = service.computeChecksum({ outer: { a: 1, z: 99 } });
      expect(c1).toBe(c2);
    });

    it('treats arrays as ordered (different order → different checksum)', () => {
      const c1 = service.computeChecksum({ list: [1, 2, 3] });
      const c2 = service.computeChecksum({ list: [3, 2, 1] });
      expect(c1).not.toBe(c2);
    });
  });

  // ── storeRawPayload – fresh store ─────────────────────────────────────────

  describe('storeRawPayload – new record', () => {
    it('creates and saves a new entity when no duplicate exists', async () => {
      rawPayloadRepo.findOne.mockResolvedValue(null);
      const saved = makeRawPayload();
      rawPayloadRepo.create.mockReturnValue(saved);
      rawPayloadRepo.save.mockResolvedValue(saved);

      const result = await service.storeRawPayload({
        tenantId: TENANT_ID,
        providerSource: 'bolagsverket',
        organisationsnummer: ORG_NR,
        content: { foo: 'bar' },
      });

      expect(rawPayloadRepo.create).toHaveBeenCalled();
      expect(rawPayloadRepo.save).toHaveBeenCalled();
      expect(result.isDeduplicated).toBe(false);
      expect(result.rawPayload).toBe(saved);
    });

    it('emits a raw_payload.stored audit event', async () => {
      rawPayloadRepo.findOne.mockResolvedValue(null);
      const saved = makeRawPayload();
      rawPayloadRepo.create.mockReturnValue(saved);
      rawPayloadRepo.save.mockResolvedValue(saved);

      await service.storeRawPayload({
        tenantId: TENANT_ID,
        providerSource: 'bolagsverket',
        organisationsnummer: ORG_NR,
        content: { foo: 'bar' },
      });

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'raw_payload.stored' }),
      );
    });

    it('stores the correct checksum on the entity', async () => {
      const content = { x: 1, y: 2 };
      const expectedChecksum = service.computeChecksum(content);

      rawPayloadRepo.findOne.mockResolvedValue(null);
      const saved = makeRawPayload({ checksum: expectedChecksum });
      rawPayloadRepo.create.mockImplementation((data) => ({ ...saved, ...data }));
      rawPayloadRepo.save.mockImplementation((e) => Promise.resolve(e));

      await service.storeRawPayload({
        tenantId: TENANT_ID,
        providerSource: 'bolagsverket',
        organisationsnummer: ORG_NR,
        content,
      });

      const createArg = rawPayloadRepo.create.mock.calls[0][0];
      expect(createArg.checksum).toBe(expectedChecksum);
    });

    it('computes payload size in bytes', async () => {
      const content = { hello: 'world' };
      rawPayloadRepo.findOne.mockResolvedValue(null);
      const saved = makeRawPayload();
      rawPayloadRepo.create.mockImplementation((data) => ({ ...saved, ...data }));
      rawPayloadRepo.save.mockImplementation((e) => Promise.resolve(e));

      await service.storeRawPayload({
        tenantId: TENANT_ID,
        providerSource: 'bolagsverket',
        organisationsnummer: ORG_NR,
        content,
      });

      const createArg = rawPayloadRepo.create.mock.calls[0][0];
      expect(createArg.payloadSizeBytes).toBeGreaterThan(0);
    });

    it('passes snapshotId to the created entity', async () => {
      rawPayloadRepo.findOne.mockResolvedValue(null);
      const saved = makeRawPayload({ snapshotId: 'snap-42' });
      rawPayloadRepo.create.mockImplementation((data) => ({ ...saved, ...data }));
      rawPayloadRepo.save.mockImplementation((e) => Promise.resolve(e));

      await service.storeRawPayload({
        tenantId: TENANT_ID,
        providerSource: 'bolagsverket',
        organisationsnummer: ORG_NR,
        content: { a: 1 },
        snapshotId: 'snap-42',
      });

      const createArg = rawPayloadRepo.create.mock.calls[0][0];
      expect(createArg.snapshotId).toBe('snap-42');
    });
  });

  // ── storeRawPayload – deduplication ───────────────────────────────────────

  describe('storeRawPayload – deduplication', () => {
    it('returns existing record when checksum matches', async () => {
      const existing = makeRawPayload({ id: 'rp-existing' });
      rawPayloadRepo.findOne.mockResolvedValue(existing);

      const result = await service.storeRawPayload({
        tenantId: TENANT_ID,
        providerSource: 'bolagsverket',
        organisationsnummer: ORG_NR,
        content: { foo: 'bar' },
      });

      expect(rawPayloadRepo.create).not.toHaveBeenCalled();
      expect(rawPayloadRepo.save).not.toHaveBeenCalled();
      expect(result.isDeduplicated).toBe(true);
      expect(result.rawPayload).toBe(existing);
    });

    it('emits a raw_payload.deduplication_hit audit event on duplicate', async () => {
      const existing = makeRawPayload({ id: 'rp-existing' });
      rawPayloadRepo.findOne.mockResolvedValue(existing);

      await service.storeRawPayload({
        tenantId: TENANT_ID,
        providerSource: 'bolagsverket',
        organisationsnummer: ORG_NR,
        content: { foo: 'bar' },
      });

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'raw_payload.deduplication_hit' }),
      );
    });

    it('does not emit stored event when deduplication occurs', async () => {
      const existing = makeRawPayload({ id: 'rp-existing' });
      rawPayloadRepo.findOne.mockResolvedValue(existing);

      await service.storeRawPayload({
        tenantId: TENANT_ID,
        providerSource: 'bolagsverket',
        organisationsnummer: ORG_NR,
        content: { foo: 'bar' },
      });

      const auditActions: string[] = auditService.log.mock.calls.map(
        (call: unknown[]) => (call[0] as { action: string }).action,
      );
      expect(auditActions).not.toContain('raw_payload.stored');
    });

    it('queries by tenantId + checksum for deduplication', async () => {
      rawPayloadRepo.findOne.mockResolvedValue(null);
      const saved = makeRawPayload();
      rawPayloadRepo.create.mockReturnValue(saved);
      rawPayloadRepo.save.mockResolvedValue(saved);

      const content = { lookup: 'test' };
      const expectedChecksum = service.computeChecksum(content);

      await service.storeRawPayload({
        tenantId: TENANT_ID,
        providerSource: 'bolagsverket',
        organisationsnummer: ORG_NR,
        content,
      });

      expect(rawPayloadRepo.findOne).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID, checksum: expectedChecksum },
      });
    });
  });
});
