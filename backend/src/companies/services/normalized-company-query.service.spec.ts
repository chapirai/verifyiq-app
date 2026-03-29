import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ILike } from 'typeorm';
import { NormalizedCompanyEntity } from '../entities/normalized-company.entity';
import { CompanyVersionEntity } from '../entities/company-version.entity';
import { NormalizedCompanyQueryService } from './normalized-company-query.service';

const TENANT_ID = 'tenant-abc';
const TENANT_ID_B = 'tenant-xyz';
const ORG_NR = '5560000001';

function makeNormalized(
  overrides: Partial<NormalizedCompanyEntity> = {},
): NormalizedCompanyEntity {
  const e = new NormalizedCompanyEntity();
  e.id = 'nc-1';
  e.tenantId = TENANT_ID;
  e.orgNumber = ORG_NR;
  e.legalName = 'ACME AB';
  e.companyForm = 'Aktiebolag';
  e.status = 'Aktiv';
  e.countryCode = 'SE';
  e.registeredAt = new Date('2000-01-01');
  e.address = {};
  e.businessDescription = null;
  e.signatoryText = null;
  e.officers = [];
  e.shareInformation = {};
  e.financialReports = [];
  e.version = 1;
  e.schemaVersion = '1';
  e.freshnessStatus = 'fresh';
  e.lastNormalizedAt = new Date();
  e.lastSnapshotId = null;
  e.lastRawPayloadId = null;
  e.createdAt = new Date();
  e.updatedAt = new Date();
  return Object.assign(e, overrides);
}

function makeVersion(overrides: Partial<CompanyVersionEntity> = {}): CompanyVersionEntity {
  const v = new CompanyVersionEntity();
  v.id = 'cv-1';
  v.tenantId = TENANT_ID;
  v.orgNumber = ORG_NR;
  v.normalizedCompanyId = 'nc-1';
  v.version = 1;
  v.attributes = { legalName: 'ACME AB' };
  v.changedFields = [];
  v.schemaVersion = '1';
  v.snapshotId = null;
  v.rawPayloadId = null;
  v.createdAt = new Date();
  return Object.assign(v, overrides);
}

describe('NormalizedCompanyQueryService', () => {
  let service: NormalizedCompanyQueryService;
  let normalizedRepo: { findOne: jest.Mock; find: jest.Mock };
  let versionRepo: { findOne: jest.Mock; find: jest.Mock };

  beforeEach(async () => {
    normalizedRepo = { findOne: jest.fn(), find: jest.fn() };
    versionRepo = { findOne: jest.fn(), find: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NormalizedCompanyQueryService,
        { provide: getRepositoryToken(NormalizedCompanyEntity), useValue: normalizedRepo },
        { provide: getRepositoryToken(CompanyVersionEntity), useValue: versionRepo },
      ],
    }).compile();

    service = module.get<NormalizedCompanyQueryService>(NormalizedCompanyQueryService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getByOrgNumber', () => {
    it('returns a profile when the record exists', async () => {
      normalizedRepo.findOne.mockResolvedValue(makeNormalized());
      const result = await service.getByOrgNumber(TENANT_ID, ORG_NR);
      expect(normalizedRepo.findOne).toHaveBeenCalledWith({ where: { tenantId: TENANT_ID, orgNumber: ORG_NR } });
      expect(result).not.toBeNull();
      expect(result!.orgNumber).toBe(ORG_NR);
    });

    it('returns null when no record exists', async () => {
      normalizedRepo.findOne.mockResolvedValue(null);
      expect(await service.getByOrgNumber(TENANT_ID, 'unknown')).toBeNull();
    });

    it('scopes query to the given tenantId', async () => {
      normalizedRepo.findOne.mockResolvedValue(null);
      await service.getByOrgNumber(TENANT_ID_B, ORG_NR);
      expect(normalizedRepo.findOne).toHaveBeenCalledWith({ where: { tenantId: TENANT_ID_B, orgNumber: ORG_NR } });
    });

    it('does not include lastRawPayloadId in the response', async () => {
      normalizedRepo.findOne.mockResolvedValue(makeNormalized());
      const profile = await service.getByOrgNumber(TENANT_ID, ORG_NR);
      expect(Object.keys(profile!)).not.toContain('lastRawPayloadId');
    });
  });

  describe('listByTenant', () => {
    it('returns profiles ordered by updatedAt DESC', async () => {
      normalizedRepo.find.mockResolvedValue([makeNormalized(), makeNormalized({ id: 'nc-2' })]);
      const result = await service.listByTenant(TENANT_ID);
      expect(normalizedRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: TENANT_ID }, order: { updatedAt: 'DESC' }, take: 50, skip: 0 }),
      );
      expect(result).toHaveLength(2);
    });

    it('respects custom limit and offset', async () => {
      normalizedRepo.find.mockResolvedValue([]);
      await service.listByTenant(TENANT_ID, { limit: 10, offset: 20 });
      expect(normalizedRepo.find).toHaveBeenCalledWith(expect.objectContaining({ take: 10, skip: 20 }));
    });

    it('applies freshnessStatus filter when provided', async () => {
      normalizedRepo.find.mockResolvedValue([]);
      await service.listByTenant(TENANT_ID, { freshnessStatus: 'stale' });
      expect(normalizedRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: TENANT_ID, freshnessStatus: 'stale' } }),
      );
    });

    it('returns empty array when no records exist', async () => {
      normalizedRepo.find.mockResolvedValue([]);
      expect(await service.listByTenant(TENANT_ID)).toEqual([]);
    });
  });

  describe('listRecent', () => {
    it('returns the N most recently updated companies', async () => {
      normalizedRepo.find.mockResolvedValue([makeNormalized()]);
      await service.listRecent(TENANT_ID, 5);
      expect(normalizedRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: TENANT_ID }, order: { updatedAt: 'DESC' }, take: 5 }),
      );
    });

    it('defaults to limit 20', async () => {
      normalizedRepo.find.mockResolvedValue([]);
      await service.listRecent(TENANT_ID);
      expect(normalizedRepo.find).toHaveBeenCalledWith(expect.objectContaining({ take: 20 }));
    });
  });

  describe('searchByName', () => {
    it('performs a case-insensitive substring search', async () => {
      normalizedRepo.find.mockResolvedValue([makeNormalized()]);
      await service.searchByName(TENANT_ID, 'ACME');
      expect(normalizedRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: TENANT_ID, legalName: ILike('%ACME%') } }),
      );
    });

    it('returns empty array when no match found', async () => {
      normalizedRepo.find.mockResolvedValue([]);
      expect(await service.searchByName(TENANT_ID, 'NoSuch')).toEqual([]);
    });

    it('respects custom limit', async () => {
      normalizedRepo.find.mockResolvedValue([]);
      await service.searchByName(TENANT_ID, 'test', 5);
      expect(normalizedRepo.find).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }));
    });
  });

  describe('getVersionHistory', () => {
    it('returns versions ordered by version DESC', async () => {
      const versions = [makeVersion({ version: 3 }), makeVersion({ id: 'cv-2', version: 1 })];
      versionRepo.find.mockResolvedValue(versions);
      const result = await service.getVersionHistory(TENANT_ID, ORG_NR);
      expect(versionRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: TENANT_ID, orgNumber: ORG_NR }, order: { version: 'DESC' }, take: 20 }),
      );
      expect(result).toBe(versions);
    });

    it('respects custom limit', async () => {
      versionRepo.find.mockResolvedValue([]);
      await service.getVersionHistory(TENANT_ID, ORG_NR, 5);
      expect(versionRepo.find).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }));
    });
  });

  describe('getVersionByNumber', () => {
    it('returns the version record when found', async () => {
      const v = makeVersion({ version: 2 });
      versionRepo.findOne.mockResolvedValue(v);
      const result = await service.getVersionByNumber(TENANT_ID, ORG_NR, 2);
      expect(versionRepo.findOne).toHaveBeenCalledWith({ where: { tenantId: TENANT_ID, orgNumber: ORG_NR, version: 2 } });
      expect(result).toBe(v);
    });

    it('returns null when version not found', async () => {
      versionRepo.findOne.mockResolvedValue(null);
      expect(await service.getVersionByNumber(TENANT_ID, ORG_NR, 999)).toBeNull();
    });
  });

  describe('profile shape', () => {
    it('includes freshness metadata in the profile', async () => {
      normalizedRepo.findOne.mockResolvedValue(
        makeNormalized({ freshnessStatus: 'stale', lastNormalizedAt: new Date('2024-01-01'), lastSnapshotId: 'snap-100' }),
      );
      const profile = await service.getByOrgNumber(TENANT_ID, ORG_NR);
      expect(profile!.freshnessStatus).toBe('stale');
      expect(profile!.lastSnapshotId).toBe('snap-100');
    });

    it('includes version metadata in the profile', async () => {
      normalizedRepo.findOne.mockResolvedValue(makeNormalized({ version: 5, schemaVersion: '2' }));
      const profile = await service.getByOrgNumber(TENANT_ID, ORG_NR);
      expect(profile!.version).toBe(5);
      expect(profile!.schemaVersion).toBe('2');
    });
  });
});
