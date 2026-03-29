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
});
