import { BadGatewayException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BolagsverketService, DataValidationResult } from './bolagsverket.service';
import { BolagsverketClient } from '../integrations/bolagsverket.client';
import { BolagsverketMapper, DEFAULT_COMPANY_NAME, NormalisedCompany } from '../integrations/bolagsverket.mapper';
import { BvCacheService } from './bv-cache.service';
import { BvPersistenceService } from './bv-persistence.service';
import { RawPayloadStorageService } from './raw-payload-storage.service';
import { CachePolicyEvaluationService } from './cache-policy-evaluation.service';
import { SnapshotChainService } from './snapshot-chain.service';
import { SnapshotComparisonService } from './snapshot-comparison.service';
import { BvFetchSnapshotEntity } from '../entities/bv-fetch-snapshot.entity';
import { AuditEventType } from '../../audit/audit-event.entity';
import { AuditService } from '../../audit/audit.service';

function makeNormalisedCompany(overrides: Partial<NormalisedCompany> = {}): NormalisedCompany {
  return {
    organisationNumber: '5560000001',
    legalName: 'Test AB',
    companyForm: 'Aktiebolag',
    status: 'REGISTRERAD',
    registeredAt: '2010-01-01',
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
    sourcePayloadSummary: {
      hasHighValueDataset: true,
      hasRichOrganisationInformation: false,
      partialDataFields: [],
    },
    fieldErrors: [],
    hvdSection: null,
    v4Section: null,
    documentList: null,
    ...overrides,
  };
}

describe('BolagsverketService', () => {
  let service: BolagsverketService;
  let auditService: { emitAuditEvent: jest.Mock };
  let cacheService: { checkFreshness: jest.Mock; createSnapshot: jest.Mock };
  let persistenceService: { upsertOrganisation: jest.Mock; storeHvdPayload: jest.Mock; storeForetagsinfoPayload: jest.Mock; storeDocumentList: jest.Mock };
  let rawPayloadStorageService: { storeRawPayload: jest.Mock };
  let snapshotChainService: { linkSnapshot: jest.Mock };
  let snapshotComparisonService: { compareSnapshots: jest.Mock };
  let policyService: {
    evaluate: jest.Mock;
    getPolicyForTenant: jest.Mock;
    listPolicies: jest.Mock;
    getPolicyById: jest.Mock;
  };

  beforeEach(async () => {
    cacheService = { checkFreshness: jest.fn(), createSnapshot: jest.fn() };
    persistenceService = { upsertOrganisation: jest.fn(), storeHvdPayload: jest.fn().mockResolvedValue({ id: 'hvd-payload-1' }), storeForetagsinfoPayload: jest.fn().mockResolvedValue({ id: 'v4-payload-1' }), storeDocumentList: jest.fn().mockResolvedValue({ id: 'doc-list-1' }) };
    rawPayloadStorageService = { storeRawPayload: jest.fn() };
    snapshotChainService = { linkSnapshot: jest.fn() };
    snapshotComparisonService = { compareSnapshots: jest.fn() };
    auditService = { emitAuditEvent: jest.fn().mockResolvedValue(null) };
    policyService = {
      evaluate: jest.fn().mockResolvedValue({
        decision: 'fresh',
        isFresh: true,
        isStale: false,
        isExpired: false,
        shouldTriggerRefresh: false,
        staleFallbackAllowed: true,
        costFlags: {},
        policyId: 'default',
        usedSystemDefault: true,
        dataAgeHours: 0,
      }),
      getPolicyForTenant: jest.fn().mockResolvedValue(null),
      listPolicies: jest.fn().mockResolvedValue([]),
      getPolicyById: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BolagsverketService,
        { provide: BolagsverketClient, useValue: {} },
        { provide: BolagsverketMapper, useValue: {} },
        { provide: BvCacheService, useValue: cacheService },
        { provide: BvPersistenceService, useValue: persistenceService },
        { provide: RawPayloadStorageService, useValue: rawPayloadStorageService },
        { provide: CachePolicyEvaluationService, useValue: policyService },
        { provide: SnapshotChainService, useValue: snapshotChainService },
        { provide: SnapshotComparisonService, useValue: snapshotComparisonService },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<BolagsverketService>(BolagsverketService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('validateCompanyData', () => {
    it('returns isValid=true for a valid company', () => {
      const company = makeNormalisedCompany();
      const result: DataValidationResult = service.validateCompanyData(company);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns an error when organisationNumber is missing', () => {
      const company = makeNormalisedCompany({ organisationNumber: '' });
      const result: DataValidationResult = service.validateCompanyData(company);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing organisationNumber');
    });

    it('returns a warning when legalName is the default placeholder', () => {
      const company = makeNormalisedCompany({ legalName: DEFAULT_COMPANY_NAME });
      const result: DataValidationResult = service.validateCompanyData(company);
      expect(result.warnings).toContain('Legal name is missing or unknown');
    });

    it('returns a warning when share capital arithmetic does not match', () => {
      const company = makeNormalisedCompany({
        shareInformation: {
          antalAktier: 1000,
          kvotvarde: 10,
          aktiekapital: 5000, // computed = 10000, mismatch > 1%
        },
      });
      const result: DataValidationResult = service.validateCompanyData(company);
      expect(result.warnings.some((w) => w.includes('Share capital mismatch'))).toBe(true);
    });

    it('does NOT warn when share capital is within 1% tolerance', () => {
      const company = makeNormalisedCompany({
        shareInformation: {
          antalAktier: 1000,
          kvotvarde: 10,
          aktiekapital: 10000, // exactly correct
        },
      });
      const result: DataValidationResult = service.validateCompanyData(company);
      expect(result.warnings.some((w) => w.includes('Share capital mismatch'))).toBe(false);
    });

    it('returns an error when financial year start is after end', () => {
      const company = makeNormalisedCompany({
        financialYear: {
          rakenskapsarInleds: '2023-12-31',
          rakenskapsarAvslutas: '2023-01-01',
        } as Record<string, unknown>,
      });
      const result: DataValidationResult = service.validateCompanyData(company);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('Financial year start'))).toBe(true);
    });

    it('returns a warning when partialDataFields are present', () => {
      const company = makeNormalisedCompany({
        sourcePayloadSummary: {
          hasHighValueDataset: false,
          hasRichOrganisationInformation: false,
          partialDataFields: ['officers', 'shareInformation'],
        },
      });
      const result: DataValidationResult = service.validateCompanyData(company);
      expect(result.warnings.some((w) => w.includes('Partial data detected'))).toBe(true);
    });
  });

  describe('mapper normalization (via mapper)', () => {
    it('maps a minimal HVD response correctly', () => {
      const mapper = new BolagsverketMapper();
      const hvd = {
        organisation: {
          identitetsbeteckning: '5560000001',
          namn: 'Test AB',
          organisationsform: 'Aktiebolag',
          organisationsstatusar: [{ status: 'REGISTRERAD' }],
        },
      } as any;

      const result = mapper.map(hvd, []);
      expect(result.organisationNumber).toBe('5560000001');
      expect(result.legalName).toBe('Test AB');
      expect(result.companyForm).toBe('Aktiebolag');
    });
  });

  describe('getCompleteCompanyData', () => {
    let clientMock: jest.Mocked<BolagsverketClient>;
    let mapperMock: jest.Mocked<BolagsverketMapper>;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          BolagsverketService,
          {
            provide: BolagsverketClient,
            useValue: {
              fetchHighValueDataset: jest.fn(),
              fetchOrganisationInformation: jest.fn(),
              fetchDocumentList: jest.fn(),
            },
          },
          {
            provide: BolagsverketMapper,
            useValue: { map: jest.fn() },
          },
          { provide: BvCacheService, useValue: {} },
          { provide: BvPersistenceService, useValue: {} },
          { provide: RawPayloadStorageService, useValue: { storeRawPayload: jest.fn() } },
          {
            provide: CachePolicyEvaluationService,
            useValue: {
              evaluate: jest.fn().mockResolvedValue({
                decision: 'fresh',
                isFresh: true,
                isStale: false,
                isExpired: false,
                shouldTriggerRefresh: false,
                staleFallbackAllowed: true,
                costFlags: {},
                policyId: 'default',
                usedSystemDefault: true,
                dataAgeHours: 0,
              }),
              getPolicyForTenant: jest.fn().mockResolvedValue(null),
            },
          },
          { provide: SnapshotChainService, useValue: { linkSnapshot: jest.fn() } },
          { provide: SnapshotComparisonService, useValue: { compareSnapshots: jest.fn() } },
          { provide: AuditService, useValue: { emitAuditEvent: jest.fn().mockResolvedValue(null) } },
        ],
      }).compile();

      service = module.get<BolagsverketService>(BolagsverketService);
      clientMock = module.get(BolagsverketClient);
      mapperMock = module.get(BolagsverketMapper);
    });

    it('throws BadGatewayException when all three API calls fail', async () => {
      clientMock.fetchHighValueDataset.mockRejectedValue(new Error('HVD error'));
      clientMock.fetchOrganisationInformation.mockRejectedValue(new Error('Org error'));
      clientMock.fetchDocumentList.mockRejectedValue(new Error('Doc error'));

      await expect(service.getCompleteCompanyData('5560210261')).rejects.toBeInstanceOf(
        BadGatewayException,
      );
    });

    it('includes the org number in the BadGatewayException message when all calls fail', async () => {
      clientMock.fetchHighValueDataset.mockRejectedValue(new Error('HVD error'));
      clientMock.fetchOrganisationInformation.mockRejectedValue(new Error('Org error'));
      clientMock.fetchDocumentList.mockRejectedValue(new Error('Doc error'));

      await expect(service.getCompleteCompanyData('5560210261')).rejects.toThrow('5560210261');
    });

    it('succeeds with partial data when only one API call fails', async () => {
      const hvdPayload = { organisation: { identitetsbeteckning: '5560210261', namn: 'Test AB' } };
      const richPayload = [{ identitetsbeteckning: '5560210261' }];

      clientMock.fetchHighValueDataset.mockResolvedValue({
        requestPayload: { identitetsbeteckning: '5560210261' },
        responsePayload: hvdPayload as any,
        requestId: 'req-1',
      });
      clientMock.fetchOrganisationInformation.mockResolvedValue({
        requestPayload: {},
        responsePayload: richPayload as any,
        requestId: 'req-2',
      });
      clientMock.fetchDocumentList.mockRejectedValue(new Error('Doc error'));

      const normalisedCompany = makeNormalisedCompany({ organisationNumber: '5560210261' });
      mapperMock.map.mockReturnValue(normalisedCompany);

      const result = await service.getCompleteCompanyData('5560210261');

      expect(result.normalisedData).toBe(normalisedCompany);
      expect(result.highValueDataset).toBe(hvdPayload);
      expect(result.documents).toBeNull();
    });

    it('passes tenant context through API client calls', async () => {
      const hvdPayload = { organisation: { identitetsbeteckning: '5560210261', namn: 'Test AB' } };
      const richPayload = [{ identitetsbeteckning: '5560210261' }];
      clientMock.fetchHighValueDataset.mockResolvedValue({
        requestPayload: { identitetsbeteckning: '5560210261' },
        responsePayload: hvdPayload as any,
        requestId: 'req-1',
      });
      clientMock.fetchOrganisationInformation.mockResolvedValue({
        requestPayload: {},
        responsePayload: richPayload as any,
        requestId: 'req-2',
      });
      clientMock.fetchDocumentList.mockResolvedValue({
        requestPayload: { identitetsbeteckning: '5560210261' },
        responsePayload: null as any,
        requestId: 'req-3',
      });
      mapperMock.map.mockReturnValue(makeNormalisedCompany({ organisationNumber: '5560210261' }));

      await service.getCompleteCompanyData('5560210261', {
        tenantId: 'tenant-ctx',
        actorId: 'actor-ctx',
        correlationId: 'corr-ctx',
      });

      expect(clientMock.fetchHighValueDataset).toHaveBeenCalledWith(
        '5560210261',
        expect.objectContaining({ tenantId: 'tenant-ctx' }),
      );
      expect(clientMock.fetchOrganisationInformation).toHaveBeenCalledWith(
        '5560210261',
        undefined,
        undefined,
        expect.objectContaining({ tenantId: 'tenant-ctx' }),
      );
      expect(clientMock.fetchDocumentList).toHaveBeenCalledWith(
        { identitetsbeteckning: '5560210261' },
        expect.objectContaining({ tenantId: 'tenant-ctx' }),
      );
    });
  });

  describe('enrichAndSave audit events', () => {
    it('emits cache hit event when serving cached snapshot', async () => {
      const snapshot = new BvFetchSnapshotEntity();
      snapshot.id = 'snap-cache';
      snapshot.tenantId = 'tenant-1';
      snapshot.organisationsnummer = '5560000001';
      snapshot.fetchStatus = 'success';
      snapshot.isFromCache = true;
      snapshot.policyDecision = 'cache_hit';
      snapshot.costImpactFlags = {};
      snapshot.isStaleFallback = false;
      snapshot.normalisedSummary = { organisationNumber: '5560000001' } as any;
      snapshot.fetchedAt = new Date();

      cacheService.checkFreshness.mockResolvedValue({
        isFresh: true,
        snapshot,
        ageInDays: 1,
      });

      await service.enrichAndSave('tenant-1', '5560000001', false, 'corr-1', 'actor-1');

      expect(auditService.emitAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: AuditEventType.CACHE_HIT,
          status: 'hit',
          resourceId: '5560000001',
        }),
      );
    });

    it('emits refresh events on force refresh success', async () => {
      const resultPayload = {
        normalisedData: makeNormalisedCompany(),
        highValueDataset: null,
        organisationInformation: [],
        documents: null,
        retrievedAt: new Date().toISOString(),
      };

      jest
        .spyOn(service, 'getCompleteCompanyData')
        .mockResolvedValue(resultPayload);

      persistenceService.upsertOrganisation.mockResolvedValue({ id: 'org-1' });
      rawPayloadStorageService.storeRawPayload.mockResolvedValue({
        rawPayload: { id: 'raw-1' },
        isDeduplicated: false,
      });

      const snapshot = new BvFetchSnapshotEntity();
      snapshot.id = 'snap-new';
      snapshot.tenantId = 'tenant-1';
      snapshot.organisationsnummer = '5560000001';
      snapshot.fetchStatus = 'success';
      snapshot.isFromCache = false;
      snapshot.policyDecision = 'force_refresh';
      snapshot.costImpactFlags = { apiCallCharged: true, apiCallCount: 3 };
      snapshot.isStaleFallback = false;
      snapshot.apiCallCount = 3;
      snapshot.fetchedAt = new Date();

      cacheService.createSnapshot.mockResolvedValue(snapshot);
      snapshotChainService.linkSnapshot.mockResolvedValue({ id: snapshot.id, previousSnapshotId: null });
      snapshotComparisonService.compareSnapshots.mockResolvedValue(undefined);

      await service.enrichAndSave('tenant-1', '5560000001', true, 'corr-2', 'actor-2');

      const eventTypes = auditService.emitAuditEvent.mock.calls.map(
        (call) => call[0].eventType,
      );

      expect(eventTypes).toEqual(
        expect.arrayContaining([
          AuditEventType.FORCE_REFRESH,
          AuditEventType.REFRESH_INITIATED,
          AuditEventType.PROVIDER_CALLED,
          AuditEventType.REFRESH_COMPLETED,
        ]),
      );
    });
  });
});
