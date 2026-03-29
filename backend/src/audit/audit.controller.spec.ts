import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditController } from './audit.controller';
import { AuditEventQueryService } from './audit-event-query.service';
import { AuditService } from './audit.service';
import { UsageEventQueryService } from './usage-event-query.service';

describe('AuditController permissions (P02-T09)', () => {
  let controller: AuditController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [
        { provide: AuditService, useValue: { listForTenant: jest.fn() } },
        { provide: AuditEventQueryService, useValue: { listForAudit: jest.fn() } },
        { provide: UsageEventQueryService, useValue: { listForAudit: jest.fn() } },
      ],
    }).compile();

    controller = module.get<AuditController>(AuditController);
  });

  it('rejects access for non-audit roles', async () => {
    const req = { user: { role: 'user', tenantId: 'tenant-1' } };

    await expect(
      controller.listEvents(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        req,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
