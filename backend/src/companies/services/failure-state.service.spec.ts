import { ForbiddenException, GatewayTimeoutException, HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditService } from '../../audit/audit.service';
import { FailureStateEntity } from '../entities/failure-state.entity';
import { FailureStateService } from './failure-state.service';

describe('FailureStateService', () => {
  let service: FailureStateService;
  let failureRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(async () => {
    failureRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn(async (data) => data as FailureStateEntity),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FailureStateService,
        {
          provide: getRepositoryToken(FailureStateEntity),
          useValue: failureRepo,
        },
        {
          provide: AuditService,
          useValue: { emitAuditEvent: jest.fn().mockResolvedValue(null) },
        },
      ],
    }).compile();

    service = module.get<FailureStateService>(FailureStateService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('classifyFailure', () => {
    it('classifies timeouts as PROVIDER_TIMEOUT', () => {
      const result = service.classifyFailure(new GatewayTimeoutException('timeout'));
      expect(result.failureState).toBe('PROVIDER_TIMEOUT');
      expect(result.failureReason).toBe('timeout');
      expect(result.isRecoverable).toBe(true);
    });

    it('classifies forbidden errors as permission_denied', () => {
      const result = service.classifyFailure(new ForbiddenException('no access'));
      expect(result.failureState).toBe('PROVIDER_ERROR');
      expect(result.failureReason).toBe('permission_denied');
      expect(result.isRecoverable).toBe(false);
      expect(result.isPermissionFailure).toBe(true);
    });

    it('classifies quota failures from HTTP 429', () => {
      const quotaError = new HttpException('quota', 429);
      const result = service.classifyFailure(quotaError);
      expect(result.failureState).toBe('PROVIDER_ERROR');
      expect(result.failureReason).toBe('quota_exceeded');
      expect(result.isQuotaFailure).toBe(true);
    });
  });

  describe('getRecoveryStatus', () => {
    it('uses base delay when retryCount <= 1', () => {
      const now = Date.now();
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);
      const current = new FailureStateEntity();
      current.failureState = 'PROVIDER_ERROR';
      current.retryCount = 1;
      current.isRecoverable = true;
      current.lastAttempted = new Date(now - 10_000);

      const status = service.getRecoveryStatus(current);

      expect(status.nextRetryAt?.getTime()).toBe(current.lastAttempted.getTime() + 60_000);
      nowSpy.mockRestore();
    });

    it('caps exponential backoff at the max exponent', () => {
      const current = new FailureStateEntity();
      current.failureState = 'PROVIDER_ERROR';
      current.retryCount = 10;
      current.isRecoverable = true;
      current.lastAttempted = new Date(0);

      const status = service.getRecoveryStatus(current);

      expect(status.nextRetryAt?.getTime()).toBe(480_000);
    });

    it('returns canRetry=false when backoff window has not elapsed', () => {
      const now = Date.now();
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);
      const current = new FailureStateEntity();
      current.failureState = 'PROVIDER_ERROR';
      current.retryCount = 2;
      current.isRecoverable = true;
      current.lastAttempted = new Date(now - 30_000);
      current.failureReason = 'provider_error';
      current.fallbackUsed = false;

      const status = service.getRecoveryStatus(current);

      expect(status.canRetry).toBe(false);
      expect(status.nextRetryAt).not.toBeNull();
      nowSpy.mockRestore();
    });
  });

  describe('recordFailure', () => {
    it('increments retryCount when previous failure exists', async () => {
      failureRepo.findOne.mockResolvedValue({
        failureState: 'PROVIDER_ERROR',
        retryCount: 2,
      });

      const saved = await service.recordFailure({
        tenantId: 'tenant-1',
        entityType: 'company',
        entityId: '5560000001',
        failureState: 'PROVIDER_ERROR',
        failureReason: 'error',
        isRecoverable: true,
        fallbackUsed: false,
      });

      expect(saved.retryCount).toBe(3);
    });
  });

  describe('getCurrentState', () => {
    it('returns the most recent failure state for an entity', async () => {
      const record = new FailureStateEntity();
      record.id = 'fail-1';
      failureRepo.findOne.mockResolvedValue(record);

      const result = await service.getCurrentState('tenant-1', 'company', '5560000001');

      expect(failureRepo.findOne).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', entityType: 'company', entityId: '5560000001' },
        order: { createdAt: 'DESC' },
      });
      expect(result).toBe(record);
    });

    it('returns null when no record exists', async () => {
      failureRepo.findOne.mockResolvedValue(null);
      const result = await service.getCurrentState('tenant-1', 'company', 'missing');
      expect(result).toBeNull();
    });
  });

  describe('listHistory', () => {
    it('returns history ordered by createdAt desc and respects limit', async () => {
      const record = new FailureStateEntity();
      failureRepo.find.mockResolvedValue([record]);

      const result = await service.listHistory('tenant-1', 'company', '5560000001', 5);

      expect(failureRepo.find).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', entityType: 'company', entityId: '5560000001' },
        order: { createdAt: 'DESC' },
        take: 5,
      });
      expect(result).toEqual([record]);
    });

    it('returns empty array when no history exists', async () => {
      failureRepo.find.mockResolvedValue([]);
      const result = await service.listHistory('tenant-1', 'company', 'missing');
      expect(result).toEqual([]);
    });
  });
});
