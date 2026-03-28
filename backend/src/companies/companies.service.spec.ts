import { GatewayTimeoutException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditService } from '../audit/audit.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { CompaniesService } from './companies.service';
import { ListCompaniesDto } from './dto/list-companies.dto';
import { LookupCompanyDto } from './dto/lookup-company.dto';
import { BvFetchSnapshotEntity } from './entities/bv-fetch-snapshot.entity';
import { CompanyEntity } from './entities/company.entity';
import { BolagsverketService } from './services/bolagsverket.service';
import { CACHE_TTL_DAYS } from './services/bv-cache.service';

const TENANT_ID = 'tenant-abc';
const ORG_NR = '5560000001';

const ctx: TenantContext = { tenantId: TENANT_ID, actorId: 'user-1' };

function makeSnapshot(daysOld: number): BvFetchSnapshotEntity {
  const snapshot = new BvFetchSnapshotEntity();
  snapshot.id = 'snap-id';
  snapshot.tenantId = TENANT_ID;
  snapshot.organisationsnummer = ORG_NR;
  snapshot.fetchStatus = 'success';
  snapshot.isFromCache = false;
  const date = new Date();
  date.setDate(date.getDate() - daysOld);
  snapshot.fetchedAt = date;
  return snapshot;
}

function makeEnrichResult(isFromCache: boolean, ageInDays: number | null) {
  const snapshot = makeSnapshot(ageInDays ?? 0);
  return {
    result: {
      normalisedData: {
        organisationNumber: ORG_NR,
        legalName: 'Test AB',
        companyForm: null,
        status: null,
        registeredAt: null,
        countryCode: 'SE',
        businessDescription: null,
        signatoryText: null,
        officers: [],
        shareInformation: {},
        financialReports: [],
        addresses: [],
        allNames: [],
        permits: [],
        financialYear: null,
        industryCode: null,
        deregisteredAt: null,
        sourcePayloadSummary: {},
      },
      highValueDataset: null,
      organisationInformation: [],
      documents: null,
      retrievedAt: new Date().toISOString(),
    },
    snapshot,
    isFromCache,
    ageInDays,
  };
}

describe('CompaniesService – orchestrateLookup', () => {
  let service: CompaniesService;
  let bolagsverketService: jest.Mocked<BolagsverketService>;
  let auditService: jest.Mocked<AuditService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompaniesService,
        {
          provide: BolagsverketService,
          useValue: { enrichAndSave: jest.fn() },
        },
        {
          provide: AuditService,
          useValue: { log: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: getRepositoryToken(CompanyEntity),
          useValue: { createQueryBuilder: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<CompaniesService>(CompaniesService);
    bolagsverketService = module.get(BolagsverketService);
    auditService = module.get(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('cache hit (source=DB)', () => {
    it('returns source=DB and freshness=fresh when snapshot is 5 days old', async () => {
      bolagsverketService.enrichAndSave.mockResolvedValue(makeEnrichResult(true, 5));

      const dto: LookupCompanyDto = { orgNumber: ORG_NR };
      const response = await service.orchestrateLookup(ctx, dto);

      expect(response.metadata.source).toBe('DB');
      expect(response.metadata.freshness).toBe('fresh');
      expect(response.metadata.age_days).toBe(5);
      expect(response.metadata.cache_ttl_days).toBe(CACHE_TTL_DAYS);
      expect(response.company).toBeDefined();
    });
  });

  describe('API call (source=API)', () => {
    it('returns source=API and freshness=fresh when data is newly fetched', async () => {
      bolagsverketService.enrichAndSave.mockResolvedValue(makeEnrichResult(false, null));

      const dto: LookupCompanyDto = { orgNumber: ORG_NR };
      const response = await service.orchestrateLookup(ctx, dto);

      expect(response.metadata.source).toBe('API');
      expect(response.metadata.freshness).toBe('fresh');
      expect(response.metadata.age_days).toBe(0);
    });

    it('passes force_refresh=true to bolagsverketService.enrichAndSave', async () => {
      bolagsverketService.enrichAndSave.mockResolvedValue(makeEnrichResult(false, null));

      const dto: LookupCompanyDto = { orgNumber: ORG_NR, force_refresh: true };
      await service.orchestrateLookup(ctx, dto);

      expect(bolagsverketService.enrichAndSave).toHaveBeenCalledWith(TENANT_ID, ORG_NR, true);
    });
  });

  describe('freshness computation', () => {
    it('returns freshness=stale when age is 35 days (between 30 and 60)', async () => {
      bolagsverketService.enrichAndSave.mockResolvedValue(makeEnrichResult(true, 35));

      const response = await service.orchestrateLookup(ctx, { orgNumber: ORG_NR });
      expect(response.metadata.freshness).toBe('stale');
    });

    it('returns freshness=expired when age is 65 days (>= 60)', async () => {
      bolagsverketService.enrichAndSave.mockResolvedValue(makeEnrichResult(true, 65));

      const response = await service.orchestrateLookup(ctx, { orgNumber: ORG_NR });
      expect(response.metadata.freshness).toBe('expired');
    });
  });

  describe('request deduplication', () => {
    it('reuses the in-flight promise for concurrent requests to the same org', async () => {
      bolagsverketService.enrichAndSave.mockResolvedValue(makeEnrichResult(false, null));

      const dto: LookupCompanyDto = { orgNumber: ORG_NR };
      // Fire two concurrent requests
      const [r1, r2] = await Promise.all([
        service.orchestrateLookup(ctx, dto),
        service.orchestrateLookup(ctx, dto),
      ]);

      // Only one API call should have been made
      expect(bolagsverketService.enrichAndSave).toHaveBeenCalledTimes(1);
      expect(r1).toEqual(r2);
    });

    it('does NOT deduplicate when force_refresh=true', async () => {
      bolagsverketService.enrichAndSave.mockResolvedValue(makeEnrichResult(false, null));

      const dto: LookupCompanyDto = { orgNumber: ORG_NR, force_refresh: true };
      await Promise.all([
        service.orchestrateLookup(ctx, dto),
        service.orchestrateLookup(ctx, dto),
      ]);

      // Both requests should call the service independently
      expect(bolagsverketService.enrichAndSave).toHaveBeenCalledTimes(2);
    });
  });

  describe('audit logging', () => {
    it('logs an audit entry for every lookup', async () => {
      bolagsverketService.enrichAndSave.mockResolvedValue(makeEnrichResult(true, 5));

      await service.orchestrateLookup(ctx, { orgNumber: ORG_NR });

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          actorId: 'user-1',
          action: 'company.lookup',
          resourceType: 'company',
          resourceId: ORG_NR,
        }),
      );
    });
  });

  describe('error handling', () => {
    it('propagates GatewayTimeoutException when API times out', async () => {
      // enrichAndSave never resolves; the internal 10 s timer fires immediately via mock
      bolagsverketService.enrichAndSave.mockImplementation(
        () => new Promise(() => {}),
      );

      jest
        .spyOn(global, 'setTimeout')
        .mockImplementationOnce((fn: (...args: any[]) => void) => {
          fn();
          return 0 as unknown as ReturnType<typeof setTimeout>;
        });

      await expect(
        service.orchestrateLookup(ctx, { orgNumber: ORG_NR }),
      ).rejects.toBeInstanceOf(GatewayTimeoutException);
    });

    it('propagates errors thrown by bolagsverketService', async () => {
      bolagsverketService.enrichAndSave.mockRejectedValue(new Error('API failure'));

      await expect(
        service.orchestrateLookup(ctx, { orgNumber: ORG_NR }),
      ).rejects.toThrow('API failure');
    });
  });
});

// ---------------------------------------------------------------------------
// Helper: build a chainable QueryBuilder mock
// ---------------------------------------------------------------------------
function makeQbMock(data: Partial<CompanyEntity>[], total: number) {
  const qb: Record<string, jest.Mock> = {};
  const chain = () => qb;
  qb.select = jest.fn(chain);
  qb.where = jest.fn(chain);
  qb.andWhere = jest.fn(chain);
  qb.skip = jest.fn(chain);
  qb.take = jest.fn(chain);
  qb.getManyAndCount = jest.fn().mockResolvedValue([data, total]);
  return qb;
}

describe('CompaniesService – findAll', () => {
  let service: CompaniesService;
  let companyRepo: { createQueryBuilder: jest.Mock };

  beforeEach(async () => {
    companyRepo = { createQueryBuilder: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompaniesService,
        {
          provide: BolagsverketService,
          useValue: { enrichAndSave: jest.fn() },
        },
        {
          provide: AuditService,
          useValue: { log: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: getRepositoryToken(CompanyEntity),
          useValue: companyRepo,
        },
      ],
    }).compile();

    service = module.get<CompaniesService>(CompaniesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty data array with has_next=false when no results', async () => {
    const qb = makeQbMock([], 0);
    companyRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await service.findAll(ctx, {});
    expect(result).toEqual({ data: [], total: 0, page: 1, limit: 10, has_next: false });
  });

  it('applies tenant isolation via WHERE tenantId = :tenantId', async () => {
    const qb = makeQbMock([], 0);
    companyRepo.createQueryBuilder.mockReturnValue(qb);

    await service.findAll(ctx, {});

    expect(qb.where).toHaveBeenCalledWith('c.tenantId = :tenantId', { tenantId: TENANT_ID });
  });

  it('applies q filter as ILIKE when q is provided', async () => {
    const qb = makeQbMock([], 0);
    companyRepo.createQueryBuilder.mockReturnValue(qb);

    await service.findAll(ctx, { q: 'nordic' } as ListCompaniesDto);

    expect(qb.andWhere).toHaveBeenCalledWith('c.legalName ILIKE :q', { q: '%nordic%' });
  });

  it('does NOT apply q filter when q is absent', async () => {
    const qb = makeQbMock([], 0);
    companyRepo.createQueryBuilder.mockReturnValue(qb);

    await service.findAll(ctx, {});

    const calls = qb.andWhere.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(calls.some((c) => c.includes('legalName'))).toBe(false);
  });

  it('applies org_number exact filter when org_number is provided', async () => {
    const qb = makeQbMock([], 0);
    companyRepo.createQueryBuilder.mockReturnValue(qb);

    await service.findAll(ctx, { org_number: ORG_NR } as ListCompaniesDto);

    expect(qb.andWhere).toHaveBeenCalledWith('c.organisationNumber = :orgNumber', { orgNumber: ORG_NR });
  });

  it('applies status filter when status is provided', async () => {
    const qb = makeQbMock([], 0);
    companyRepo.createQueryBuilder.mockReturnValue(qb);

    await service.findAll(ctx, { status: 'ACTIVE' } as ListCompaniesDto);

    expect(qb.andWhere).toHaveBeenCalledWith('c.status = :status', { status: 'ACTIVE' });
  });

  it('uses default page=1 and limit=10 when not provided', async () => {
    const qb = makeQbMock([], 0);
    companyRepo.createQueryBuilder.mockReturnValue(qb);

    await service.findAll(ctx, {});

    expect(qb.skip).toHaveBeenCalledWith(0); // offset = (1-1)*10 = 0
    expect(qb.take).toHaveBeenCalledWith(10);
  });

  it('calculates correct offset for page 2 with limit 10', async () => {
    const qb = makeQbMock([], 0);
    companyRepo.createQueryBuilder.mockReturnValue(qb);

    await service.findAll(ctx, { page: 2, limit: 10 } as ListCompaniesDto);

    expect(qb.skip).toHaveBeenCalledWith(10);
    expect(qb.take).toHaveBeenCalledWith(10);
  });

  it('sets has_next=true when more results exist beyond current page', async () => {
    const items = [{ id: '1' }, { id: '2' }] as CompanyEntity[];
    const qb = makeQbMock(items, 25);
    companyRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await service.findAll(ctx, { page: 1, limit: 10 } as ListCompaniesDto);

    expect(result.has_next).toBe(true);
    expect(result.total).toBe(25);
  });

  it('sets has_next=false on the last page', async () => {
    const items = [{ id: '1' }, { id: '2' }] as CompanyEntity[];
    const qb = makeQbMock(items, 12);
    companyRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await service.findAll(ctx, { page: 2, limit: 10 } as ListCompaniesDto);

    // page 2: offset=10, data.length=2, total=12 → 10+2=12 === 12 → no next
    expect(result.has_next).toBe(false);
  });

  it('returns empty data and has_next=false for an out-of-range page', async () => {
    const qb = makeQbMock([], 5);
    companyRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await service.findAll(ctx, { page: 999, limit: 10 } as ListCompaniesDto);

    expect(result.data).toEqual([]);
    expect(result.has_next).toBe(false);
    expect(result.total).toBe(5);
  });

  it('combines multiple filters in a single query', async () => {
    const qb = makeQbMock([], 0);
    companyRepo.createQueryBuilder.mockReturnValue(qb);

    await service.findAll(ctx, { q: 'nordic', status: 'ACTIVE' } as ListCompaniesDto);

    expect(qb.andWhere).toHaveBeenCalledWith('c.legalName ILIKE :q', { q: '%nordic%' });
    expect(qb.andWhere).toHaveBeenCalledWith('c.status = :status', { status: 'ACTIVE' });
  });

  it('includes correct page and limit in the response', async () => {
    const qb = makeQbMock([], 0);
    companyRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await service.findAll(ctx, { page: 3, limit: 20 } as ListCompaniesDto);

    expect(result.page).toBe(3);
    expect(result.limit).toBe(20);
  });

  describe('audit logging', () => {
    let auditService: jest.Mocked<AuditService>;

    beforeEach(async () => {
      companyRepo = { createQueryBuilder: jest.fn() };
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CompaniesService,
          {
            provide: BolagsverketService,
            useValue: { enrichAndSave: jest.fn() },
          },
          {
            provide: AuditService,
            useValue: { log: jest.fn().mockResolvedValue(undefined) },
          },
          {
            provide: getRepositoryToken(CompanyEntity),
            useValue: companyRepo,
          },
        ],
      }).compile();

      service = module.get<CompaniesService>(CompaniesService);
      auditService = module.get(AuditService);
    });

    it('emits a company.search audit event for every findAll call', async () => {
      const qb = makeQbMock([], 0);
      companyRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(ctx, {});

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          actorId: 'user-1',
          action: 'company.search',
          resourceType: 'company',
        }),
      );
    });

    it('includes query parameters in the audit metadata', async () => {
      const qb = makeQbMock([], 0);
      companyRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(ctx, { q: 'nordic', status: 'ACTIVE' } as ListCompaniesDto);

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            q: 'nordic',
            status: 'ACTIVE',
          }),
        }),
      );
    });

    it('uses org_number as resourceId when q is absent and org_number is provided', async () => {
      const qb = makeQbMock([], 0);
      companyRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(ctx, { org_number: ORG_NR } as ListCompaniesDto);

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceId: ORG_NR,
        }),
      );
    });

    it('uses q as resourceId when q is provided', async () => {
      const qb = makeQbMock([], 0);
      companyRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(ctx, { q: 'nordic' } as ListCompaniesDto);

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceId: 'nordic',
        }),
      );
    });

    it('uses "*" as resourceId when neither q nor org_number is provided', async () => {
      const qb = makeQbMock([], 0);
      companyRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(ctx, {});

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceId: '*',
        }),
      );
    });
  });
});
