import { GatewayTimeoutException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../../audit/audit.service';
import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { CompaniesService } from '../companies.service';
import { LookupCompanyDto } from '../dto/lookup-company.dto';
import { BvFetchSnapshotEntity } from '../entities/bv-fetch-snapshot.entity';
import { BolagsverketService } from '../services/bolagsverket.service';
import { CACHE_TTL_DAYS } from '../services/bv-cache.service';

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
      normalisedData: { organisationNumber: ORG_NR, legalName: 'Test AB' },
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
