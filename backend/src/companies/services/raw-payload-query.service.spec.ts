import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BvRawPayloadEntity } from '../entities/bv-raw-payload.entity';
import { RawPayloadQueryService } from './raw-payload-query.service';
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

describe('RawPayloadQueryService', () => {
  let service: RawPayloadQueryService;
  let rawPayloadRepo: { findOne: jest.Mock; find: jest.Mock };
  let auditService: { log: jest.Mock };

  beforeEach(async () => {
    rawPayloadRepo = { findOne: jest.fn(), find: jest.fn() };
    auditService = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RawPayloadQueryService,
        { provide: getRepositoryToken(BvRawPayloadEntity), useValue: rawPayloadRepo },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<RawPayloadQueryService>(RawPayloadQueryService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── getById ───────────────────────────────────────────────────────────────

  describe('getById', () => {
    it('returns the record when found for the correct tenant', async () => {
      const rp = makeRawPayload({ id: 'rp-abc' });
      rawPayloadRepo.findOne.mockResolvedValue(rp);

      const result = await service.getById(TENANT_ID, 'rp-abc');
      expect(rawPayloadRepo.findOne).toHaveBeenCalledWith({ where: { id: 'rp-abc', tenantId: TENANT_ID } });
      expect(result).toBe(rp);
    });

    it('returns null when record not found', async () => {
      rawPayloadRepo.findOne.mockResolvedValue(null);
      const result = await service.getById(TENANT_ID, 'nonexistent');
      expect(result).toBeNull();
    });

    it('emits a retrieval audit event when found', async () => {
      const rp = makeRawPayload({ id: 'rp-abc' });
      rawPayloadRepo.findOne.mockResolvedValue(rp);

      await service.getById(TENANT_ID, 'rp-abc', 'actor-1');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'raw_payload.retrieved',
          actorId: 'actor-1',
          resourceId: 'rp-abc',
        }),
      );
    });

    it('does not emit audit event when not found', async () => {
      rawPayloadRepo.findOne.mockResolvedValue(null);
      await service.getById(TENANT_ID, 'nonexistent');
      expect(auditService.log).not.toHaveBeenCalled();
    });
  });

  // ── getBySnapshotId ───────────────────────────────────────────────────────

  describe('getBySnapshotId', () => {
    it('returns the raw payload linked to a snapshot', async () => {
      const rp = makeRawPayload({ snapshotId: 'snap-99' });
      rawPayloadRepo.findOne.mockResolvedValue(rp);

      const result = await service.getBySnapshotId(TENANT_ID, 'snap-99');
      expect(rawPayloadRepo.findOne).toHaveBeenCalledWith({
        where: { snapshotId: 'snap-99', tenantId: TENANT_ID },
      });
      expect(result).toBe(rp);
    });

    it('returns null when no payload linked to snapshot', async () => {
      rawPayloadRepo.findOne.mockResolvedValue(null);
      expect(await service.getBySnapshotId(TENANT_ID, 'snap-x')).toBeNull();
    });

    it('emits retrieval audit event with snapshotId in metadata', async () => {
      const rp = makeRawPayload({ snapshotId: 'snap-99' });
      rawPayloadRepo.findOne.mockResolvedValue(rp);

      await service.getBySnapshotId(TENANT_ID, 'snap-99', 'actor-2');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'raw_payload.retrieved',
          actorId: 'actor-2',
          metadata: expect.objectContaining({ snapshotId: 'snap-99' }),
        }),
      );
    });
  });

  // ── getByChecksum ─────────────────────────────────────────────────────────

  describe('getByChecksum', () => {
    it('returns all records matching checksum within tenant', async () => {
      const records = [makeRawPayload({ checksum: 'deadbeef' })];
      rawPayloadRepo.find.mockResolvedValue(records);

      const result = await service.getByChecksum(TENANT_ID, 'deadbeef');
      expect(rawPayloadRepo.find).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID, checksum: 'deadbeef' },
        order: { createdAt: 'DESC' },
      });
      expect(result).toBe(records);
    });

    it('returns empty array when no match found', async () => {
      rawPayloadRepo.find.mockResolvedValue([]);
      expect(await service.getByChecksum(TENANT_ID, 'unknown')).toEqual([]);
    });
  });

  // ── listByProviderSource ──────────────────────────────────────────────────

  describe('listByProviderSource', () => {
    it('queries by tenantId and providerSource with default limit', async () => {
      rawPayloadRepo.find.mockResolvedValue([]);
      await service.listByProviderSource(TENANT_ID, 'bolagsverket');
      expect(rawPayloadRepo.find).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID, providerSource: 'bolagsverket' },
        order: { createdAt: 'DESC' },
        take: 50,
      });
    });

    it('respects custom limit', async () => {
      rawPayloadRepo.find.mockResolvedValue([]);
      await service.listByProviderSource(TENANT_ID, 'bolagsverket', 10);
      expect(rawPayloadRepo.find).toHaveBeenCalledWith(expect.objectContaining({ take: 10 }));
    });
  });

  // ── listByOrganisationsnummer ─────────────────────────────────────────────

  describe('listByOrganisationsnummer', () => {
    it('queries by tenantId and organisationsnummer with default limit', async () => {
      rawPayloadRepo.find.mockResolvedValue([]);
      await service.listByOrganisationsnummer(TENANT_ID, ORG_NR);
      expect(rawPayloadRepo.find).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID, organisationsnummer: ORG_NR },
        order: { createdAt: 'DESC' },
        take: 50,
      });
    });

    it('respects custom limit', async () => {
      rawPayloadRepo.find.mockResolvedValue([]);
      await service.listByOrganisationsnummer(TENANT_ID, ORG_NR, 5);
      expect(rawPayloadRepo.find).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }));
    });
  });
});
