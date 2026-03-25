import { Test, TestingModule } from '@nestjs/testing';
import { BolagsverketService, DataValidationResult } from './bolagsverket.service';
import { BolagsverketClient } from '../integrations/bolagsverket.client';
import { BolagsverketMapper, DEFAULT_COMPANY_NAME, NormalisedCompany } from '../integrations/bolagsverket.mapper';
import { BvCacheService } from './bv-cache.service';
import { BvPersistenceService } from './bv-persistence.service';

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
        organisationsnummer: '5560000001',
        namn: [{ namn: 'Test AB', typ: { klartext: 'FIRMA' } }],
        organisationsform: { klartext: 'Aktiebolag' },
        status: [{ status: { klartext: 'REGISTRERAD' }, arAktuell: true }],
      } as any;

      const result = mapper.map(hvd, []);
      expect(result.organisationNumber).toBe('5560000001');
      expect(result.legalName).toBe('Test AB');
      expect(result.companyForm).toBe('Aktiebolag');
    });
  });
});
