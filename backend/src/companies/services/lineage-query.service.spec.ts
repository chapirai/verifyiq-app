import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LineageMetadataEntity, TriggerType } from '../entities/lineage-metadata.entity';
import { LineageQueryService } from './lineage-query.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-abc';
const OTHER_TENANT = 'tenant-other';
const CORR_ID = 'corr-001';
const USER_ID = 'user-001';

function makeEntity(
  overrides: Partial<LineageMetadataEntity> = {},
): LineageMetadataEntity {
  const e = new LineageMetadataEntity();
  e.id = 'lineage-1';
  e.tenantId = TENANT_ID;
  e.userId = USER_ID;
  e.correlationId = CORR_ID;
  e.triggerType = TriggerType.API_REQUEST;
  e.httpMethod = 'POST';
  e.sourceEndpoint = '/companies/lookup';
  e.requestParameters = { orgNumber: '5560000001' };
  e.createdAt = new Date();
  return Object.assign(e, overrides);
}

// Chainable QueryBuilder mock factory
function makeQbMock(results: LineageMetadataEntity[]) {
  const qb: Record<string, jest.Mock> = {};
  const chain = () => qb;
  qb.where = jest.fn(chain);
  qb.andWhere = jest.fn(chain);
  qb.orderBy = jest.fn(chain);
  qb.take = jest.fn(chain);
  qb.select = jest.fn(chain);
  qb.addSelect = jest.fn(chain);
  qb.groupBy = jest.fn(chain);
  qb.getMany = jest.fn().mockResolvedValue(results);
  qb.getRawMany = jest.fn().mockResolvedValue([]);
  return qb;
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('LineageQueryService', () => {
  let service: LineageQueryService;
  let lineageRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    createQueryBuilder: jest.Mock;
  };

  beforeEach(async () => {
    lineageRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LineageQueryService,
        {
          provide: getRepositoryToken(LineageMetadataEntity),
          useValue: lineageRepo,
        },
      ],
    }).compile();

    service = module.get<LineageQueryService>(LineageQueryService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── getById() ──────────────────────────────────────────────────────────────

  describe('getById()', () => {
    it('returns the entity when found within the tenant', async () => {
      const entity = makeEntity();
      lineageRepo.findOne.mockResolvedValue(entity);

      const result = await service.getById(TENANT_ID, entity.id);

      expect(result).toBe(entity);
      expect(lineageRepo.findOne).toHaveBeenCalledWith({
        where: { id: entity.id, tenantId: TENANT_ID },
      });
    });

    it('returns null when not found', async () => {
      lineageRepo.findOne.mockResolvedValue(null);

      const result = await service.getById(TENANT_ID, 'non-existent');

      expect(result).toBeNull();
    });

    it('scopes query to the correct tenant', async () => {
      lineageRepo.findOne.mockResolvedValue(null);

      await service.getById(OTHER_TENANT, 'lineage-1');

      expect(lineageRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'lineage-1', tenantId: OTHER_TENANT },
      });
    });
  });

  // ── findByCorrelationId() ─────────────────────────────────────────────────

  describe('findByCorrelationId()', () => {
    it('returns all records for the correlation ID within the tenant', async () => {
      const entities = [makeEntity(), makeEntity({ id: 'lineage-2' })];
      lineageRepo.find.mockResolvedValue(entities);

      const result = await service.findByCorrelationId(TENANT_ID, CORR_ID);

      expect(result).toHaveLength(2);
      expect(lineageRepo.find).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID, correlationId: CORR_ID },
        order: { createdAt: 'ASC' },
      });
    });

    it('returns empty array when no records exist', async () => {
      lineageRepo.find.mockResolvedValue([]);

      const result = await service.findByCorrelationId(TENANT_ID, 'unknown-corr');

      expect(result).toEqual([]);
    });
  });

  // ── findByUserId() ────────────────────────────────────────────────────────

  describe('findByUserId()', () => {
    it('returns records for the user ordered most-recent first', async () => {
      const entities = [makeEntity(), makeEntity({ id: 'lineage-2' })];
      lineageRepo.find.mockResolvedValue(entities);

      const result = await service.findByUserId(TENANT_ID, USER_ID);

      expect(result).toHaveLength(2);
      expect(lineageRepo.find).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID, userId: USER_ID },
        order: { createdAt: 'DESC' },
        take: 50,
      });
    });

    it('caps limit at 200', async () => {
      lineageRepo.find.mockResolvedValue([]);

      await service.findByUserId(TENANT_ID, USER_ID, 9999);

      expect(lineageRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 200 }),
      );
    });
  });

  // ── listForAudit() ────────────────────────────────────────────────────────

  describe('listForAudit()', () => {
    it('applies tenantId WHERE clause', async () => {
      const qb = makeQbMock([]);
      lineageRepo.createQueryBuilder.mockReturnValue(qb);

      await service.listForAudit(TENANT_ID);

      expect(qb.where).toHaveBeenCalledWith('l.tenantId = :tenantId', { tenantId: TENANT_ID });
    });

    it('applies correlationId filter when provided', async () => {
      const qb = makeQbMock([]);
      lineageRepo.createQueryBuilder.mockReturnValue(qb);

      await service.listForAudit(TENANT_ID, { correlationId: CORR_ID });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'l.correlationId = :correlationId',
        { correlationId: CORR_ID },
      );
    });

    it('applies userId filter when provided', async () => {
      const qb = makeQbMock([]);
      lineageRepo.createQueryBuilder.mockReturnValue(qb);

      await service.listForAudit(TENANT_ID, { userId: USER_ID });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'l.userId = :userId',
        { userId: USER_ID },
      );
    });

    it('applies triggerType filter when provided', async () => {
      const qb = makeQbMock([]);
      lineageRepo.createQueryBuilder.mockReturnValue(qb);

      await service.listForAudit(TENANT_ID, { triggerType: TriggerType.FORCE_REFRESH });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'l.triggerType = :triggerType',
        { triggerType: TriggerType.FORCE_REFRESH },
      );
    });

    it('applies sourceEndpoint ILIKE filter when provided', async () => {
      const qb = makeQbMock([]);
      lineageRepo.createQueryBuilder.mockReturnValue(qb);

      await service.listForAudit(TENANT_ID, { sourceEndpoint: '/companies' });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'l.sourceEndpoint ILIKE :sourceEndpoint',
        { sourceEndpoint: '%/companies%' },
      );
    });

    it('applies fromDate filter when provided', async () => {
      const qb = makeQbMock([]);
      lineageRepo.createQueryBuilder.mockReturnValue(qb);
      const fromDate = '2024-01-01T00:00:00Z';

      await service.listForAudit(TENANT_ID, { fromDate });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'l.createdAt >= :fromDate',
        { fromDate: new Date(fromDate) },
      );
    });

    it('applies toDate filter when provided', async () => {
      const qb = makeQbMock([]);
      lineageRepo.createQueryBuilder.mockReturnValue(qb);
      const toDate = '2024-12-31T23:59:59Z';

      await service.listForAudit(TENANT_ID, { toDate });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'l.createdAt <= :toDate',
        { toDate: new Date(toDate) },
      );
    });

    it('caps limit at 200', async () => {
      const qb = makeQbMock([]);
      lineageRepo.createQueryBuilder.mockReturnValue(qb);

      await service.listForAudit(TENANT_ID, { limit: 9999 });

      expect(qb.take).toHaveBeenCalledWith(200);
    });

    it('uses default limit of 50', async () => {
      const qb = makeQbMock([]);
      lineageRepo.createQueryBuilder.mockReturnValue(qb);

      await service.listForAudit(TENANT_ID);

      expect(qb.take).toHaveBeenCalledWith(50);
    });

    it('does not add extra andWhere calls when no filters provided', async () => {
      const qb = makeQbMock([]);
      lineageRepo.createQueryBuilder.mockReturnValue(qb);

      await service.listForAudit(TENANT_ID);

      expect(qb.andWhere).not.toHaveBeenCalled();
    });

    it('returns the results from getMany()', async () => {
      const entities = [makeEntity()];
      const qb = makeQbMock(entities);
      lineageRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.listForAudit(TENANT_ID);

      expect(result).toBe(entities);
    });
  });

  // ── getTriggerTypeStats() ────────────────────────────────────────────────

  describe('getTriggerTypeStats()', () => {
    it('returns parsed trigger type counts', async () => {
      const rawRows = [
        { triggerType: 'API_REQUEST', count: '10' },
        { triggerType: 'FORCE_REFRESH', count: '3' },
      ];
      const qb = makeQbMock([]);
      qb.getRawMany.mockResolvedValue(rawRows);
      lineageRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getTriggerTypeStats(TENANT_ID);

      expect(result).toEqual([
        { triggerType: 'API_REQUEST', count: 10 },
        { triggerType: 'FORCE_REFRESH', count: 3 },
      ]);
    });

    it('applies fromDate and toDate when provided', async () => {
      const qb = makeQbMock([]);
      qb.getRawMany.mockResolvedValue([]);
      lineageRepo.createQueryBuilder.mockReturnValue(qb);

      const fromDate = '2024-01-01T00:00:00Z';
      const toDate = '2024-12-31T00:00:00Z';
      await service.getTriggerTypeStats(TENANT_ID, { fromDate, toDate });

      expect(qb.andWhere).toHaveBeenCalledWith('l.createdAt >= :fromDate', {
        fromDate: new Date(fromDate),
      });
      expect(qb.andWhere).toHaveBeenCalledWith('l.createdAt <= :toDate', {
        toDate: new Date(toDate),
      });
    });

    it('returns empty array when no records exist', async () => {
      const qb = makeQbMock([]);
      qb.getRawMany.mockResolvedValue([]);
      lineageRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getTriggerTypeStats(TENANT_ID);

      expect(result).toEqual([]);
    });
  });
});
