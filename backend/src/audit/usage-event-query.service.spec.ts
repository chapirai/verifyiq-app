import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditEventType } from './audit-event.entity';
import { UsageEventEntity } from './usage-event.entity';
import { UsageEventQueryService } from './usage-event-query.service';

const TENANT_ID = 'tenant-abc';
const USER_ID = 'user-1';

function makeEvent(overrides: Partial<UsageEventEntity> = {}): UsageEventEntity {
  const e = new UsageEventEntity();
  e.id = 'usage-1';
  e.tenantId = TENANT_ID;
  e.userId = USER_ID;
  e.eventType = AuditEventType.REFRESH_COMPLETED;
  e.action = 'company.refresh';
  e.status = 'success';
  e.resourceId = '5560000001';
  e.correlationId = 'corr-1';
  e.costImpact = {};
  e.metadata = {};
  e.retentionExpiresAt = null;
  e.createdAt = new Date();
  return Object.assign(e, overrides);
}

function makeQbMock(results: UsageEventEntity[]) {
  const qb: Record<string, jest.Mock> = {};
  const chain = () => qb;
  qb.where = jest.fn(chain);
  qb.andWhere = jest.fn(chain);
  qb.orderBy = jest.fn(chain);
  qb.take = jest.fn(chain);
  qb.getMany = jest.fn().mockResolvedValue(results);
  return qb;
}

describe('UsageEventQueryService', () => {
  let service: UsageEventQueryService;
  let repo: { findOne: jest.Mock; createQueryBuilder: jest.Mock };

  beforeEach(async () => {
    repo = { findOne: jest.fn(), createQueryBuilder: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsageEventQueryService,
        { provide: getRepositoryToken(UsageEventEntity), useValue: repo },
      ],
    }).compile();

    service = module.get<UsageEventQueryService>(UsageEventQueryService);
  });

  afterEach(() => jest.clearAllMocks());

  it('scopes getById to tenant', async () => {
    const event = makeEvent();
    repo.findOne.mockResolvedValue(event);

    const result = await service.getById(TENANT_ID, event.id);

    expect(result).toBe(event);
    expect(repo.findOne).toHaveBeenCalledWith({ where: { id: event.id, tenantId: TENANT_ID } });
  });

  it('applies filters when listing events', async () => {
    const qb = makeQbMock([makeEvent()]);
    repo.createQueryBuilder.mockReturnValue(qb);

    await service.listForAudit(TENANT_ID, {
      userId: USER_ID,
      eventType: AuditEventType.REFRESH_COMPLETED,
      resourceId: '5560000001',
      status: 'success',
      fromDate: '2026-01-01',
      toDate: '2026-02-01',
      limit: 10,
    });

    expect(qb.where).toHaveBeenCalledWith('e.tenantId = :tenantId', { tenantId: TENANT_ID });
    expect(qb.andWhere).toHaveBeenCalledWith('e.userId = :userId', { userId: USER_ID });
    expect(qb.andWhere).toHaveBeenCalledWith('e.eventType = :eventType', {
      eventType: AuditEventType.REFRESH_COMPLETED,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('e.resourceId = :resourceId', {
      resourceId: '5560000001',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('e.status = :status', { status: 'success' });
  });
});
