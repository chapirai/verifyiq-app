import { BadGatewayException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BolagsverketService, DataValidationResult } from './bolagsverket.service';
import { BolagsverketClient } from '../integrations/bolagsverket.client';
import { BolagsverketMapper, DEFAULT_COMPANY_NAME, NormalisedCompany } from '../integrations/bolagsverket.mapper';
import { BvCacheService } from './bv-cache.service';
import { BvPersistenceService } from './bv-persistence.service';
import { RawPayloadStorageService } from './raw-payload-storage.service';
import { CachePolicyEvaluationService } from './cache-policy-evaluation.service';

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
    ...overrides,
  };
}

describe('BolagsverketService', () => {
  let service: BolagsverketService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BolagsverketService,
        { provide: BolagsverketClient, useValue: {} },
        { provide: BolagsverketMapper, useValue: {} },
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
            listPolicies: jest.fn().mockResolvedValue([]),
            getPolicyById: jest.fn().mockResolvedValue(null),
          },
        },
      ],
    }).compile();

    service = module.get<BolagsverketService>(BolagsverketService);
  });

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
  });
});
