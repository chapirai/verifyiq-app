import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditEventEntity, AuditEventType } from './audit-event.entity';
import { AuditEventQueryService } from './audit-event-query.service';

const TENANT_ID = 'tenant-abc';
const USER_ID = 'user-1';
const CORR_ID = 'corr-1';

function makeEvent(overrides: Partial<AuditEventEntity> = {}): AuditEventEntity {
  const e = new AuditEventEntity();
  e.id = 'evt-1';
  e.tenantId = TENANT_ID;
  e.userId = USER_ID;
  e.eventType = AuditEventType.LOOKUP_COMPLETED;
  e.action = 'company.lookup';
  e.status = 'success';
  e.resourceId = '5560000001';
  e.correlationId = CORR_ID;
  e.costImpact = {};
  e.metadata = {};
  e.retentionExpiresAt = null;
  e.createdAt = new Date();
  return Object.assign(e, overrides);
}

function makeQbMock(results: AuditEventEntity[]) {
  const qb: Record<string, jest.Mock> = {};
  const chain = () => qb;
  qb.where = jest.fn(chain);
  qb.andWhere = jest.fn(chain);
  qb.orderBy = jest.fn(chain);
  qb.take = jest.fn(chain);
  qb.getMany = jest.fn().mockResolvedValue(results);
  return qb;
}

describe('AuditEventQueryService', () => {
  let service: AuditEventQueryService;
  let repo: { findOne: jest.Mock; createQueryBuilder: jest.Mock };

  beforeEach(async () => {
    repo = { findOne: jest.fn(), createQueryBuilder: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditEventQueryService,
        { provide: getRepositoryToken(AuditEventEntity), useValue: repo },
      ],
    }).compile();

    service = module.get<AuditEventQueryService>(AuditEventQueryService);
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
      eventType: AuditEventType.LOOKUP_COMPLETED,
      resourceId: '5560000001',
      correlationId: CORR_ID,
      status: 'success',
      fromDate: '2026-01-01',
      toDate: '2026-02-01',
      limit: 10,
    });

    expect(qb.where).toHaveBeenCalledWith('e.tenantId = :tenantId', { tenantId: TENANT_ID });
    expect(qb.andWhere).toHaveBeenCalledWith('e.userId = :userId', { userId: USER_ID });
    expect(qb.andWhere).toHaveBeenCalledWith('e.eventType = :eventType', {
      eventType: AuditEventType.LOOKUP_COMPLETED,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('e.resourceId = :resourceId', {
      resourceId: '5560000001',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('e.correlationId = :correlationId', {
      correlationId: CORR_ID,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('e.status = :status', { status: 'success' });
  });
});
