import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditEventType } from './audit-event.entity';
import { AuditLog } from './audit-log.entity';
import { AuditService } from './audit.service';
import { UsageEventEntity } from './usage-event.entity';
import { AuditEventEntity } from './audit-event.entity';

describe('AuditService (P02-T09)', () => {
  let service: AuditService;
  let auditLogRepo: { create: jest.Mock; save: jest.Mock };
  let auditEventRepo: { create: jest.Mock; save: jest.Mock };
  let usageEventRepo: { create: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    auditLogRepo = { create: jest.fn((v) => v), save: jest.fn().mockResolvedValue(undefined) };
    auditEventRepo = { create: jest.fn((v) => v), save: jest.fn().mockResolvedValue({ id: 'evt-1' }) };
    usageEventRepo = { create: jest.fn((v) => v), save: jest.fn().mockResolvedValue({ id: 'usage-1' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: getRepositoryToken(AuditLog), useValue: auditLogRepo },
        { provide: getRepositoryToken(AuditEventEntity), useValue: auditEventRepo },
        { provide: getRepositoryToken(UsageEventEntity), useValue: usageEventRepo },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  afterEach(() => jest.clearAllMocks());

  it('persists audit events with required fields', async () => {
    await service.emitAuditEvent({
      tenantId: 'tenant-1',
      userId: 'user-1',
      eventType: AuditEventType.LOOKUP_INITIATED,
      action: 'company.lookup',
      status: 'initiated',
      resourceId: '5560000001',
      correlationId: 'corr-1',
      costImpact: { provider_call: false },
      metadata: { orgNumber: '5560000001' },
    });

    expect(auditEventRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        userId: 'user-1',
        eventType: AuditEventType.LOOKUP_INITIATED,
        action: 'company.lookup',
        status: 'initiated',
        resourceId: '5560000001',
        correlationId: 'corr-1',
      }),
    );
  });

  it('returns null when usage event persistence fails', async () => {
    usageEventRepo.save.mockRejectedValue(new Error('db down'));

    await expect(
      service.emitUsageEvent({
        tenantId: 'tenant-1',
        userId: 'user-1',
        eventType: AuditEventType.LOOKUP_COMPLETED,
        action: 'company.lookup',
        status: 'error',
      }),
    ).resolves.toBeNull();
  });

  it('stores non-UUID resource IDs in metadata for audit logs', async () => {
    await service.log({
      tenantId: 'tenant-1',
      actorId: 'user-1',
      action: 'company.lookup',
      resourceType: 'company',
      resourceId: '5560000001',
      metadata: { foo: 'bar' },
    });

    expect(auditLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: null,
        metadata: expect.objectContaining({
          foo: 'bar',
          resourceId: '5560000001',
        }),
      }),
    );
  });
});
