import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ChangeType,
  CompanyChangeEventEntity,
} from '../entities/company-change-event.entity';
import { ChangeEventQueryService } from './change-event-query.service';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-t08-query';
const ORG_NR = '5560000099';

let idCounter = 0;
function makeEvent(
  overrides: Partial<CompanyChangeEventEntity> = {},
): CompanyChangeEventEntity {
  idCounter++;
  const e = new CompanyChangeEventEntity();
  e.id = `evt-${idCounter}`;
  e.tenantId = TENANT_ID;
  e.orgNumber = ORG_NR;
  e.snapshotIdBefore = null;
  e.snapshotIdAfter = `snap-after-${idCounter}`;
  e.attributeName = 'legalName';
  e.oldValue = null;
  e.newValue = JSON.stringify('New Name');
  e.changeType = ChangeType.ADDED;
  e.correlationId = null;
  e.actorId = null;
  e.createdAt = new Date();
  return Object.assign(e, overrides);
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('ChangeEventQueryService', () => {
  let service: ChangeEventQueryService;
  let changeEventRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    createQueryBuilder: jest.Mock;
  };

  function makeQbMock(result: CompanyChangeEventEntity[] | Record<string, unknown>[]) {
    const qb: Record<string, jest.Mock> = {};
    const chain = () => qb;
    qb.where = jest.fn(chain);
    qb.andWhere = jest.fn(chain);
    qb.orderBy = jest.fn(chain);
    qb.take = jest.fn(chain);
    qb.getMany = jest.fn().mockResolvedValue(result);
    qb.select = jest.fn(chain);
    qb.addSelect = jest.fn(chain);
    qb.groupBy = jest.fn(chain);
    qb.getRawMany = jest.fn().mockResolvedValue(result);
    return qb;
  }

  beforeEach(async () => {
    idCounter = 0;

    changeEventRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChangeEventQueryService,
        { provide: getRepositoryToken(CompanyChangeEventEntity), useValue: changeEventRepo },
      ],
    }).compile();

    service = module.get<ChangeEventQueryService>(ChangeEventQueryService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── getById ────────────────────────────────────────────────────────────────

  describe('getById', () => {
    it('returns the event when found', async () => {
      const evt = makeEvent({ id: 'evt-abc' });
      changeEventRepo.findOne.mockResolvedValue(evt);

      const result = await service.getById(TENANT_ID, 'evt-abc');

      expect(changeEventRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'evt-abc', tenantId: TENANT_ID },
      });
      expect(result).toBe(evt);
    });

    it('returns null when not found', async () => {
      changeEventRepo.findOne.mockResolvedValue(null);
      expect(await service.getById(TENANT_ID, 'evt-none')).toBeNull();
    });
  });

  // ── findByOrgNumber ────────────────────────────────────────────────────────

  describe('findByOrgNumber', () => {
    it('queries with tenantId and orgNumber', async () => {
      const events = [makeEvent()];
      const qb = makeQbMock(events);
      changeEventRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findByOrgNumber(TENANT_ID, ORG_NR);

      expect(qb.where).toHaveBeenCalledWith('ce.tenantId = :tenantId', { tenantId: TENANT_ID });
      expect(qb.andWhere).toHaveBeenCalledWith('ce.orgNumber = :orgNumber', { orgNumber: ORG_NR });
      expect(result).toBe(events);
    });

    it('applies attributeName filter when provided', async () => {
      const qb = makeQbMock([]);
      changeEventRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findByOrgNumber(TENANT_ID, ORG_NR, { attributeName: 'legalName' });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'ce.attributeName = :attributeName',
        { attributeName: 'legalName' },
      );
    });

    it('applies changeType filter when provided', async () => {
      const qb = makeQbMock([]);
      changeEventRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findByOrgNumber(TENANT_ID, ORG_NR, { changeType: ChangeType.MODIFIED });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'ce.changeType = :changeType',
        { changeType: ChangeType.MODIFIED },
      );
    });

    it('applies fromDate filter when provided', async () => {
      const qb = makeQbMock([]);
      changeEventRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findByOrgNumber(TENANT_ID, ORG_NR, { fromDate: '2024-01-01' });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'ce.createdAt >= :fromDate',
        expect.objectContaining({ fromDate: expect.any(Date) }),
      );
    });

    it('applies toDate filter when provided', async () => {
      const qb = makeQbMock([]);
      changeEventRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findByOrgNumber(TENANT_ID, ORG_NR, { toDate: '2024-12-31' });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'ce.createdAt <= :toDate',
        expect.objectContaining({ toDate: expect.any(Date) }),
      );
    });

    it('caps limit at 200', async () => {
      const qb = makeQbMock([]);
      changeEventRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findByOrgNumber(TENANT_ID, ORG_NR, { limit: 9999 });

      expect(qb.take).toHaveBeenCalledWith(200);
    });
  });

  // ── findBySnapshotAfter ────────────────────────────────────────────────────

  describe('findBySnapshotAfter', () => {
    it('queries by tenantId and snapshotIdAfter', async () => {
      const events = [makeEvent({ snapshotIdAfter: 'snap-x' })];
      changeEventRepo.find.mockResolvedValue(events);

      const result = await service.findBySnapshotAfter(TENANT_ID, 'snap-x');

      expect(changeEventRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT_ID, snapshotIdAfter: 'snap-x' },
        }),
      );
      expect(result).toBe(events);
    });

    it('caps limit at 200', async () => {
      changeEventRepo.find.mockResolvedValue([]);
      await service.findBySnapshotAfter(TENANT_ID, 'snap-x', 9999);
      expect(changeEventRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 200 }),
      );
    });
  });

  // ── findByAttribute ────────────────────────────────────────────────────────

  describe('findByAttribute', () => {
    it('queries by tenantId and attributeName', async () => {
      const qb = makeQbMock([]);
      changeEventRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findByAttribute(TENANT_ID, 'registeredAddress.city');

      expect(qb.andWhere).toHaveBeenCalledWith(
        'ce.attributeName = :attributeName',
        { attributeName: 'registeredAddress.city' },
      );
    });
  });

  // ── findByChangeType ───────────────────────────────────────────────────────

  describe('findByChangeType', () => {
    it('queries by tenantId and changeType', async () => {
      const qb = makeQbMock([]);
      changeEventRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findByChangeType(TENANT_ID, ChangeType.REMOVED);

      expect(qb.andWhere).toHaveBeenCalledWith(
        'ce.changeType = :changeType',
        { changeType: ChangeType.REMOVED },
      );
    });
  });

  // ── getChangeTypeSummary ───────────────────────────────────────────────────

  describe('getChangeTypeSummary', () => {
    it('returns a map of changeType → count', async () => {
      const rawRows = [
        { changeType: 'ADDED', count: '5' },
        { changeType: 'MODIFIED', count: '3' },
      ];
      const qb = makeQbMock(rawRows);
      changeEventRepo.createQueryBuilder.mockReturnValue(qb);

      const summary = await service.getChangeTypeSummary(TENANT_ID, ORG_NR);

      expect(summary['ADDED']).toBe(5);
      expect(summary['MODIFIED']).toBe(3);
    });

    it('returns empty object when no events', async () => {
      const qb = makeQbMock([]);
      changeEventRepo.createQueryBuilder.mockReturnValue(qb);

      const summary = await service.getChangeTypeSummary(TENANT_ID, ORG_NR);
      expect(summary).toEqual({});
    });
  });
});
