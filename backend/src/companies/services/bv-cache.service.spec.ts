import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BvCacheService, CACHE_TTL_DAYS } from './bv-cache.service';
import { BvFetchSnapshotEntity } from '../entities/bv-fetch-snapshot.entity';
import { BvOrganisationEntity } from '../entities/bv-organisation.entity';

const ID_REGEX = /^(\d{10}|\d{12}|302\d{7})$/;

function makeSnapshot(daysOld: number): BvFetchSnapshotEntity {
  const snapshot = new BvFetchSnapshotEntity();
  snapshot.id = 'snapshot-uuid';
  snapshot.tenantId = 'tenant-1';
  snapshot.organisationsnummer = '5560000001';
  snapshot.fetchStatus = 'success';
  snapshot.isFromCache = false;
  const date = new Date();
  date.setDate(date.getDate() - daysOld);
  snapshot.fetchedAt = date;
  return snapshot;
}

describe('BvCacheService', () => {
  let service: BvCacheService;
  let snapshotRepo: jest.Mocked<Repository<BvFetchSnapshotEntity>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BvCacheService,
        {
          provide: getRepositoryToken(BvFetchSnapshotEntity),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(BvOrganisationEntity),
          useValue: { findOne: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<BvCacheService>(BvCacheService);
    snapshotRepo = module.get(getRepositoryToken(BvFetchSnapshotEntity));
  });

  describe('checkFreshness', () => {
    it('returns isFresh=false when no snapshot exists', async () => {
      snapshotRepo.findOne.mockResolvedValue(null);
      const result = await service.checkFreshness('tenant-1', '5560000001');
      expect(result.isFresh).toBe(false);
      expect(result.snapshot).toBeNull();
      expect(result.ageInDays).toBeNull();
    });

    it('returns isFresh=true when snapshot is 5 days old', async () => {
      snapshotRepo.findOne.mockResolvedValue(makeSnapshot(5));
      const result = await service.checkFreshness('tenant-1', '5560000001');
      expect(result.isFresh).toBe(true);
      expect(result.ageInDays).toBe(5);
    });

    it('returns isFresh=false when snapshot is 35 days old', async () => {
      snapshotRepo.findOne.mockResolvedValue(makeSnapshot(35));
      const result = await service.checkFreshness('tenant-1', '5560000001');
      expect(result.isFresh).toBe(false);
      expect(result.ageInDays).toBe(35);
    });

    it('uses CACHE_TTL_DAYS as boundary (exact TTL days → stale)', async () => {
      snapshotRepo.findOne.mockResolvedValue(makeSnapshot(CACHE_TTL_DAYS));
      const result = await service.checkFreshness('tenant-1', '5560000001');
      expect(result.isFresh).toBe(false);
    });
  });

  describe('identifier validation regex', () => {
    it('accepts a 10-digit organisationsnummer', () => {
      expect(ID_REGEX.test('5560000001')).toBe(true);
    });

    it('accepts a 12-digit personnummer', () => {
      expect(ID_REGEX.test('197001011234')).toBe(true);
    });

    it('accepts a GD-nummer (302XXXXXXX)', () => {
      expect(ID_REGEX.test('3020000001')).toBe(true);
    });

    it('rejects an invalid identifier (too short)', () => {
      expect(ID_REGEX.test('12345')).toBe(false);
    });

    it('rejects an identifier with letters', () => {
      expect(ID_REGEX.test('AB1234567')).toBe(false);
    });

    it('rejects an 11-digit number', () => {
      expect(ID_REGEX.test('55600000011')).toBe(false);
    });
  });
});
