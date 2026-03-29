import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NormalizedCompanyEntity } from '../entities/normalized-company.entity';
import { CompanyVersionEntity } from '../entities/company-version.entity';
import { NormalizationService } from './normalization.service';
import { CompanyNormalizer } from '../mappers/company-normalizer';
import { AuditService } from '../../audit/audit.service';

const TENANT_ID = 'tenant-abc';
const TENANT_ID_B = 'tenant-xyz';
const ORG_NR = '5560000001';

const SAMPLE_RAW_CONTENT: Record<string, unknown> = {
  highValueDataset: {
    organisationer: [
      {
        identitetsbeteckning: ORG_NR,
        namn: 'ACME AB',
        organisationsform: 'Aktiebolag',
        organisationsstatusar: [{ status: 'Aktiv' }],
        registreringsdatum: '2000-01-01',
      },
    ],
  },
  organisationInformation: undefined,
};

const SAMPLE_RAW_CONTENT_UPDATED: Record<string, unknown> = {
  highValueDataset: {
    organisationer: [
      {
        identitetsbeteckning: ORG_NR,
        namn: 'ACME AB (Updated)',
        organisationsform: 'Aktiebolag',
        organisationsstatusar: [{ status: 'Aktiv' }],
        registreringsdatum: '2000-01-01',
      },
    ],
  },
  organisationInformation: undefined,
};

function makeNormalizedCompany(
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

function makeVersionEntity(
  overrides: Partial<CompanyVersionEntity> = {},
): CompanyVersionEntity {
  const v = new CompanyVersionEntity();
  v.id = 'cv-1';
  v.tenantId = TENANT_ID;
  v.orgNumber = ORG_NR;
  v.normalizedCompanyId = 'nc-1';
  v.version = 1;
  v.attributes = {};
  v.changedFields = [];
  v.schemaVersion = '1';
  v.snapshotId = null;
  v.rawPayloadId = null;
  v.createdAt = new Date();
  return Object.assign(v, overrides);
}

describe('NormalizationService', () => {
  let service: NormalizationService;
  let normalizedRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let versionRepo: {
    create: jest.Mock;
    save: jest.Mock;
  };
  let auditService: { log: jest.Mock };

  beforeEach(async () => {
    normalizedRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    versionRepo = {
      create: jest.fn(),
      save: jest.fn(),
    };
    auditService = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NormalizationService,
        CompanyNormalizer,
        {
          provide: getRepositoryToken(NormalizedCompanyEntity),
          useValue: normalizedRepo,
        },
        {
          provide: getRepositoryToken(CompanyVersionEntity),
          useValue: versionRepo,
        },
        {
          provide: AuditService,
          useValue: auditService,
        },
      ],
    }).compile();

    service = module.get<NormalizationService>(NormalizationService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── upsertNormalizedCompany – new record ──────────────────────────────────

  describe('upsertNormalizedCompany – new record', () => {
    it('creates a new NormalizedCompanyEntity when none exists', async () => {
      normalizedRepo.findOne.mockResolvedValue(null);
      const saved = makeNormalizedCompany();
      normalizedRepo.create.mockReturnValue(saved);
      normalizedRepo.save.mockResolvedValue(saved);
      const versionSaved = makeVersionEntity();
      versionRepo.create.mockReturnValue(versionSaved);
      versionRepo.save.mockResolvedValue(versionSaved);

      const result = await service.upsertNormalizedCompany({
        tenantId: TENANT_ID,
        orgNumber: ORG_NR,
        rawPayloadContent: SAMPLE_RAW_CONTENT,
      });

      expect(normalizedRepo.create).toHaveBeenCalled();
      expect(normalizedRepo.save).toHaveBeenCalled();
      expect(result.isNew).toBe(true);
      expect(result.isUpdated).toBe(false);
      expect(result.changedFields).toEqual([]);
    });

    it('creates a version 1 CompanyVersionEntity for a new record', async () => {
      normalizedRepo.findOne.mockResolvedValue(null);
      const saved = makeNormalizedCompany();
      normalizedRepo.create.mockReturnValue(saved);
      normalizedRepo.save.mockResolvedValue(saved);
      const versionSaved = makeVersionEntity();
      versionRepo.create.mockReturnValue(versionSaved);
      versionRepo.save.mockResolvedValue(versionSaved);

      await service.upsertNormalizedCompany({
        tenantId: TENANT_ID,
        orgNumber: ORG_NR,
        rawPayloadContent: SAMPLE_RAW_CONTENT,
      });

      const versionCreateArg = versionRepo.create.mock.calls[0][0];
      expect(versionCreateArg.version).toBe(1);
      expect(versionCreateArg.changedFields).toEqual([]);
    });

    it('emits normalized_company.created audit event for a new record', async () => {
      normalizedRepo.findOne.mockResolvedValue(null);
      const saved = makeNormalizedCompany();
      normalizedRepo.create.mockReturnValue(saved);
      normalizedRepo.save.mockResolvedValue(saved);
      const versionSaved = makeVersionEntity();
      versionRepo.create.mockReturnValue(versionSaved);
      versionRepo.save.mockResolvedValue(versionSaved);

      await service.upsertNormalizedCompany({
        tenantId: TENANT_ID,
        orgNumber: ORG_NR,
        rawPayloadContent: SAMPLE_RAW_CONTENT,
        snapshotId: 'snap-1',
        actorId: 'user-1',
        correlationId: 'corr-1',
      });

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'normalized_company.created',
          tenantId: TENANT_ID,
          actorId: 'user-1',
          resourceType: 'normalized_company',
        }),
      );
    });

    it('stores snapshotId and rawPayloadId on new record', async () => {
      normalizedRepo.findOne.mockResolvedValue(null);
      const saved = makeNormalizedCompany({ lastSnapshotId: 'snap-42', lastRawPayloadId: 'rp-99' });
      normalizedRepo.create.mockReturnValue(saved);
      normalizedRepo.save.mockResolvedValue(saved);
      const versionSaved = makeVersionEntity({ snapshotId: 'snap-42', rawPayloadId: 'rp-99' });
      versionRepo.create.mockReturnValue(versionSaved);
      versionRepo.save.mockResolvedValue(versionSaved);

      await service.upsertNormalizedCompany({
        tenantId: TENANT_ID,
        orgNumber: ORG_NR,
        rawPayloadContent: SAMPLE_RAW_CONTENT,
        snapshotId: 'snap-42',
        rawPayloadId: 'rp-99',
      });

      const createArg = normalizedRepo.create.mock.calls[0][0];
      expect(createArg.lastSnapshotId).toBe('snap-42');
      expect(createArg.lastRawPayloadId).toBe('rp-99');
    });

    it('sets freshnessStatus on new record (defaults to fresh)', async () => {
      normalizedRepo.findOne.mockResolvedValue(null);
      const saved = makeNormalizedCompany({ freshnessStatus: 'fresh' });
      normalizedRepo.create.mockReturnValue(saved);
      normalizedRepo.save.mockResolvedValue(saved);
      const versionSaved = makeVersionEntity();
      versionRepo.create.mockReturnValue(versionSaved);
      versionRepo.save.mockResolvedValue(versionSaved);

      await service.upsertNormalizedCompany({
        tenantId: TENANT_ID,
        orgNumber: ORG_NR,
        rawPayloadContent: SAMPLE_RAW_CONTENT,
      });

      const createArg = normalizedRepo.create.mock.calls[0][0];
      expect(createArg.freshnessStatus).toBe('fresh');
    });
  });

  // ── upsertNormalizedCompany – update existing ─────────────────────────────

  describe('upsertNormalizedCompany – update existing', () => {
    it('detects changed fields and increments version', async () => {
      const existing = makeNormalizedCompany({ legalName: 'ACME AB', version: 1 });
      normalizedRepo.findOne.mockResolvedValue(existing);
      const saved = makeNormalizedCompany({ legalName: 'ACME AB (Updated)', version: 2 });
      normalizedRepo.save.mockResolvedValue(saved);
      const versionSaved = makeVersionEntity({ version: 2, changedFields: ['legalName'] });
      versionRepo.create.mockReturnValue(versionSaved);
      versionRepo.save.mockResolvedValue(versionSaved);

      const result = await service.upsertNormalizedCompany({
        tenantId: TENANT_ID,
        orgNumber: ORG_NR,
        rawPayloadContent: SAMPLE_RAW_CONTENT_UPDATED,
      });

      expect(result.isNew).toBe(false);
      expect(result.isUpdated).toBe(true);
      expect(result.changedFields).toContain('legalName');
    });

    it('creates a version record when attributes change', async () => {
      const existing = makeNormalizedCompany({ legalName: 'ACME AB', version: 1 });
      normalizedRepo.findOne.mockResolvedValue(existing);
      const saved = makeNormalizedCompany({ legalName: 'ACME AB (Updated)', version: 2 });
      normalizedRepo.save.mockResolvedValue(saved);
      const versionSaved = makeVersionEntity({ version: 2 });
      versionRepo.create.mockReturnValue(versionSaved);
      versionRepo.save.mockResolvedValue(versionSaved);

      const result = await service.upsertNormalizedCompany({
        tenantId: TENANT_ID,
        orgNumber: ORG_NR,
        rawPayloadContent: SAMPLE_RAW_CONTENT_UPDATED,
        snapshotId: 'snap-5',
      });

      expect(versionRepo.create).toHaveBeenCalled();
      expect(versionRepo.save).toHaveBeenCalled();
      expect(result.version).not.toBeNull();
    });

    it('emits normalized_company.updated audit event when attributes change', async () => {
      const existing = makeNormalizedCompany({ legalName: 'ACME AB', version: 1 });
      normalizedRepo.findOne.mockResolvedValue(existing);
      const saved = makeNormalizedCompany({ legalName: 'ACME AB (Updated)', version: 2 });
      normalizedRepo.save.mockResolvedValue(saved);
      const versionSaved = makeVersionEntity({ version: 2 });
      versionRepo.create.mockReturnValue(versionSaved);
      versionRepo.save.mockResolvedValue(versionSaved);

      await service.upsertNormalizedCompany({
        tenantId: TENANT_ID,
        orgNumber: ORG_NR,
        rawPayloadContent: SAMPLE_RAW_CONTENT_UPDATED,
      });

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'normalized_company.updated' }),
      );
    });

    it('emits normalized_company.refreshed and does NOT create a version row when no attrs change', async () => {
      const existing = makeNormalizedCompany({ legalName: 'ACME AB', version: 1 });
      normalizedRepo.findOne.mockResolvedValue(existing);
      // Same content → no change
      normalizedRepo.save.mockResolvedValue(existing);

      const result = await service.upsertNormalizedCompany({
        tenantId: TENANT_ID,
        orgNumber: ORG_NR,
        rawPayloadContent: SAMPLE_RAW_CONTENT,
      });

      expect(result.isUpdated).toBe(false);
      expect(result.changedFields).toEqual([]);
      expect(result.version).toBeNull();
      expect(versionRepo.create).not.toHaveBeenCalled();
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'normalized_company.refreshed' }),
      );
    });

    it('updates freshness metadata on every upsert (not just when attrs change)', async () => {
      const existing = makeNormalizedCompany({ legalName: 'ACME AB', freshnessStatus: 'stale' });
      normalizedRepo.findOne.mockResolvedValue(existing);
      normalizedRepo.save.mockImplementation((e) => Promise.resolve(e));

      await service.upsertNormalizedCompany({
        tenantId: TENANT_ID,
        orgNumber: ORG_NR,
        rawPayloadContent: SAMPLE_RAW_CONTENT,
        freshnessStatus: 'fresh',
        snapshotId: 'snap-new',
      });

      const savedEntity = normalizedRepo.save.mock.calls[0][0] as NormalizedCompanyEntity;
      expect(savedEntity.freshnessStatus).toBe('fresh');
      expect(savedEntity.lastSnapshotId).toBe('snap-new');
    });
  });

  // ── upsertNormalizedCompany – tenant isolation ────────────────────────────

  describe('upsertNormalizedCompany – tenant isolation', () => {
    it('queries by tenantId for the existing record lookup', async () => {
      normalizedRepo.findOne.mockResolvedValue(null);
      const saved = makeNormalizedCompany({ tenantId: TENANT_ID_B });
      normalizedRepo.create.mockReturnValue(saved);
      normalizedRepo.save.mockResolvedValue(saved);
      const versionSaved = makeVersionEntity({ tenantId: TENANT_ID_B });
      versionRepo.create.mockReturnValue(versionSaved);
      versionRepo.save.mockResolvedValue(versionSaved);

      await service.upsertNormalizedCompany({
        tenantId: TENANT_ID_B,
        orgNumber: ORG_NR,
        rawPayloadContent: SAMPLE_RAW_CONTENT,
      });

      expect(normalizedRepo.findOne).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID_B, orgNumber: ORG_NR },
      });
    });

    it('does not mix records from different tenants', async () => {
      const tenantARecord = makeNormalizedCompany({ tenantId: TENANT_ID });
      normalizedRepo.findOne.mockImplementation(({ where }) => {
        if (where.tenantId === TENANT_ID) return Promise.resolve(tenantARecord);
        return Promise.resolve(null);
      });
      const savedB = makeNormalizedCompany({ tenantId: TENANT_ID_B });
      normalizedRepo.create.mockReturnValue(savedB);
      normalizedRepo.save.mockResolvedValue(savedB);
      const versionSaved = makeVersionEntity({ tenantId: TENANT_ID_B });
      versionRepo.create.mockReturnValue(versionSaved);
      versionRepo.save.mockResolvedValue(versionSaved);

      const result = await service.upsertNormalizedCompany({
        tenantId: TENANT_ID_B,
        orgNumber: ORG_NR,
        rawPayloadContent: SAMPLE_RAW_CONTENT,
      });

      expect(result.isNew).toBe(true);
    });
  });

  // ── markStaleFallback ─────────────────────────────────────────────────────

  describe('markStaleFallback', () => {
    it('sets freshnessStatus to degraded on existing record', async () => {
      const existing = makeNormalizedCompany({ freshnessStatus: 'fresh' });
      normalizedRepo.findOne.mockResolvedValue(existing);
      normalizedRepo.save.mockImplementation((e) => Promise.resolve(e));

      const result = await service.markStaleFallback({
        tenantId: TENANT_ID,
        orgNumber: ORG_NR,
        reason: 'Provider unavailable',
        snapshotId: 'snap-fail',
      });

      expect(result).not.toBeNull();
      const saved = normalizedRepo.save.mock.calls[0][0] as NormalizedCompanyEntity;
      expect(saved.freshnessStatus).toBe('degraded');
    });

    it('emits normalized_company.stale_fallback audit event', async () => {
      const existing = makeNormalizedCompany();
      normalizedRepo.findOne.mockResolvedValue(existing);
      normalizedRepo.save.mockImplementation((e) => Promise.resolve(e));

      await service.markStaleFallback({
        tenantId: TENANT_ID,
        orgNumber: ORG_NR,
        reason: 'API timeout',
      });

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'normalized_company.stale_fallback' }),
      );
    });

    it('returns null when no existing record found (no-op)', async () => {
      normalizedRepo.findOne.mockResolvedValue(null);

      const result = await service.markStaleFallback({
        tenantId: TENANT_ID,
        orgNumber: 'nonexistent',
        reason: 'Test',
      });

      expect(result).toBeNull();
      expect(normalizedRepo.save).not.toHaveBeenCalled();
    });

    it('preserves all attribute fields when marking stale', async () => {
      const original = makeNormalizedCompany({
        legalName: 'Preserved Name AB',
        status: 'Aktiv',
        freshnessStatus: 'fresh',
      });
      normalizedRepo.findOne.mockResolvedValue(original);
      normalizedRepo.save.mockImplementation((e) => Promise.resolve(e));

      await service.markStaleFallback({
        tenantId: TENANT_ID,
        orgNumber: ORG_NR,
        reason: 'Failure',
      });

      const saved = normalizedRepo.save.mock.calls[0][0] as NormalizedCompanyEntity;
      expect(saved.legalName).toBe('Preserved Name AB');
      expect(saved.status).toBe('Aktiv');
      expect(saved.freshnessStatus).toBe('degraded');
    });
  });

  // ── Error handling ────────────────────────────────────────────────────────

  describe('error handling', () => {
    it('throws when orgNumber is empty and raw payload produces no organisationNumber', async () => {
      await expect(
        service.upsertNormalizedCompany({
          tenantId: TENANT_ID,
          orgNumber: '',
          rawPayloadContent: { highValueDataset: null, organisationInformation: null },
        }),
      ).rejects.toThrow();
    });
  });
});
