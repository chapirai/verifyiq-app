import {
  ForbiddenException,
  GatewayTimeoutException,
  HttpException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditEventType } from '../../audit/audit-event.entity';
import { AuditService } from '../../audit/audit.service';
import { FailureState, FailureStateEntity } from '../entities/failure-state.entity';

const NETWORK_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ETIMEDOUT',
]);

const TIMEOUT_PATTERNS = ['timeout', 'timed out', 'time out'];

const BACKOFF_CONFIG = {
  baseDelayMs: 60_000,
  maxDelayMs: 15 * 60_000,
} as const;

export interface FailureClassification {
  failureState: FailureState;
  failureReason: string;
  isRecoverable: boolean;
  isPermissionFailure: boolean;
  isQuotaFailure: boolean;
}

export interface FailureRecordInput {
  tenantId: string;
  entityType: string;
  entityId: string;
  failureState: FailureState;
  failureReason: string;
  isRecoverable: boolean;
  fallbackUsed: boolean;
  staleDataTimestamp?: Date | null;
  correlationId?: string | null;
  actorId?: string | null;
  incrementRetry?: boolean;
}

export interface FailureSuccessInput {
  tenantId: string;
  entityType: string;
  entityId: string;
  correlationId?: string | null;
  actorId?: string | null;
}

export interface FailureRecoveryStatus {
  state: FailureState;
  isRecoverable: boolean;
  retryCount: number;
  lastAttempted: Date | null;
  nextRetryAt: Date | null;
  canRetry: boolean;
  failureReason?: string | null;
  fallbackUsed?: boolean;
}

@Injectable()
export class FailureStateService {
  private readonly logger = new Logger(FailureStateService.name);

  constructor(
    @InjectRepository(FailureStateEntity)
    private readonly failureRepo: Repository<FailureStateEntity>,
    private readonly auditService: AuditService,
  ) {}

  // ── Classification ─────────────────────────────────────────────────────────

  /**
   * P02-T10: Classify provider failures into canonical failure states.
   * Handles permission/quota failures distinctly for audit reporting.
   */
  classifyFailure(err: unknown): FailureClassification {
    if (err instanceof GatewayTimeoutException) {
      return {
        failureState: 'PROVIDER_TIMEOUT',
        failureReason: 'timeout',
        isRecoverable: true,
        isPermissionFailure: false,
        isQuotaFailure: false,
      };
    }

    if (err instanceof UnauthorizedException || err instanceof ForbiddenException) {
      return {
        failureState: 'PROVIDER_ERROR',
        failureReason: 'permission_denied',
        isRecoverable: false,
        isPermissionFailure: true,
        isQuotaFailure: false,
      };
    }

    if (err instanceof HttpException) {
      const status = err.getStatus();
      if (status === 408 || status === 504) {
        return {
          failureState: 'PROVIDER_TIMEOUT',
          failureReason: `http_${status}_timeout`,
          isRecoverable: true,
          isPermissionFailure: false,
          isQuotaFailure: false,
        };
      }
      if (status === 429) {
        return {
          failureState: 'PROVIDER_ERROR',
          failureReason: 'quota_exceeded',
          isRecoverable: true,
          isPermissionFailure: false,
          isQuotaFailure: true,
        };
      }
      if (status === 502 || status === 503) {
        return {
          failureState: 'PROVIDER_UNAVAILABLE',
          failureReason: `http_${status}_unavailable`,
          isRecoverable: true,
          isPermissionFailure: false,
          isQuotaFailure: false,
        };
      }
      if (status >= 500) {
        return {
          failureState: 'PROVIDER_ERROR',
          failureReason: `http_${status}_server_error`,
          isRecoverable: true,
          isPermissionFailure: false,
          isQuotaFailure: false,
        };
      }
      if (status === 400) {
        return {
          failureState: 'PROVIDER_ERROR',
          failureReason: 'bad_request',
          isRecoverable: false,
          isPermissionFailure: false,
          isQuotaFailure: false,
        };
      }
    }

    const message = err instanceof Error ? err.message : String(err);
    const errorCode = (err as { code?: string })?.code;
    if (errorCode && NETWORK_ERROR_CODES.has(errorCode)) {
      return {
        failureState: 'PROVIDER_UNAVAILABLE',
        failureReason: `network_${errorCode.toLowerCase()}`,
        isRecoverable: true,
        isPermissionFailure: false,
        isQuotaFailure: false,
      };
    }

    const lowerMessage = message.toLowerCase();
    if (TIMEOUT_PATTERNS.some((pattern) => lowerMessage.includes(pattern))) {
      return {
        failureState: 'PROVIDER_TIMEOUT',
        failureReason: 'timeout',
        isRecoverable: true,
        isPermissionFailure: false,
        isQuotaFailure: false,
      };
    }

    return {
      failureState: 'PROVIDER_ERROR',
      failureReason: lowerMessage || 'unknown_error',
      isRecoverable: true,
      isPermissionFailure: false,
      isQuotaFailure: false,
    };
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  async getCurrentState(
    tenantId: string,
    entityType: string,
    entityId: string,
  ): Promise<FailureStateEntity | null> {
    return this.failureRepo.findOne({
      where: { tenantId, entityType, entityId },
      order: { createdAt: 'DESC' },
    });
  }

  async listHistory(
    tenantId: string,
    entityType: string,
    entityId: string,
    limit = 20,
  ): Promise<FailureStateEntity[]> {
    return this.failureRepo.find({
      where: { tenantId, entityType, entityId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  getRecoveryStatus(current: FailureStateEntity | null): FailureRecoveryStatus {
    if (!current || current.failureState === 'SUCCESS') {
      return {
        state: 'SUCCESS',
        isRecoverable: true,
        retryCount: 0,
        lastAttempted: null,
        nextRetryAt: null,
        canRetry: true,
        failureReason: null,
        fallbackUsed: false,
      };
    }

    if (!current.isRecoverable) {
      return {
        state: current.failureState,
        isRecoverable: false,
        retryCount: current.retryCount,
        lastAttempted: current.lastAttempted,
        nextRetryAt: null,
        canRetry: false,
        failureReason: current.failureReason,
        fallbackUsed: current.fallbackUsed,
      };
    }

    const backoffMs = this.computeBackoffMs(current.retryCount);
    const nextRetryAt = new Date(current.lastAttempted.getTime() + backoffMs);
    const canRetry = Date.now() >= nextRetryAt.getTime();

    return {
      state: current.failureState,
      isRecoverable: current.isRecoverable,
      retryCount: current.retryCount,
      lastAttempted: current.lastAttempted,
      nextRetryAt,
      canRetry,
      failureReason: current.failureReason,
      fallbackUsed: current.fallbackUsed,
    };
  }

  async getRecoveryStatusForEntity(
    tenantId: string,
    entityType: string,
    entityId: string,
  ): Promise<FailureRecoveryStatus> {
    const current = await this.getCurrentState(tenantId, entityType, entityId);
    return this.getRecoveryStatus(current);
  }

  // ── Record updates ─────────────────────────────────────────────────────────

  async recordFailure(input: FailureRecordInput): Promise<FailureStateEntity> {
    const previous = await this.getCurrentState(input.tenantId, input.entityType, input.entityId);
    const shouldIncrement = input.incrementRetry !== false;
    const retryCount = shouldIncrement
      ? previous && previous.failureState !== 'SUCCESS'
        ? previous.retryCount + 1
        : 1
      : previous?.retryCount ?? 0;

    const failureState: FailureState = input.fallbackUsed
      ? 'DEGRADED'
      : input.failureState;

    const entity = this.failureRepo.create({
      tenantId: input.tenantId,
      entityType: input.entityType,
      entityId: input.entityId,
      failureState,
      failureReason: input.failureReason,
      lastAttempted: new Date(),
      fallbackUsed: input.fallbackUsed,
      staleDataTimestamp: input.staleDataTimestamp ?? null,
      retryCount,
      isRecoverable: input.isRecoverable,
    });

    const saved = await this.failureRepo.save(entity);

    this.auditService
      .emitAuditEvent({
        tenantId: input.tenantId,
        userId: input.actorId ?? null,
        eventType: AuditEventType.FAILURE_STATE,
        action: 'company.provider_failure',
        status: failureState,
        resourceId: input.entityId,
        correlationId: input.correlationId ?? null,
        metadata: {
          entityType: input.entityType,
          failureState,
          failureReason: input.failureReason,
          retryCount,
          isRecoverable: input.isRecoverable,
          fallbackUsed: input.fallbackUsed,
          staleDataTimestamp: input.staleDataTimestamp?.toISOString() ?? null,
        },
      })
      .catch((err) => this.logger.warn(`[P02-T10] Failure audit emit failed: ${err}`));

    return saved;
  }

  async recordSuccess(input: FailureSuccessInput): Promise<FailureStateEntity> {
    const entity = this.failureRepo.create({
      tenantId: input.tenantId,
      entityType: input.entityType,
      entityId: input.entityId,
      failureState: 'SUCCESS',
      failureReason: null,
      lastAttempted: new Date(),
      fallbackUsed: false,
      staleDataTimestamp: null,
      retryCount: 0,
      isRecoverable: true,
    });

    const saved = await this.failureRepo.save(entity);

    this.auditService
      .emitAuditEvent({
        tenantId: input.tenantId,
        userId: input.actorId ?? null,
        eventType: AuditEventType.FAILURE_STATE,
        action: 'company.provider_recovered',
        status: 'SUCCESS',
        resourceId: input.entityId,
        correlationId: input.correlationId ?? null,
        metadata: {
          entityType: input.entityType,
          failureState: 'SUCCESS',
        },
      })
      .catch((err) => this.logger.warn(`[P02-T10] Recovery audit emit failed: ${err}`));

    return saved;
  }

  // ── Internal helpers ────────────────────────────────────────────────────────

  private computeBackoffMs(retryCount: number): number {
    const exponent = Math.max(retryCount - 1, 0);
    return Math.min(BACKOFF_CONFIG.baseDelayMs * 2 ** exponent, BACKOFF_CONFIG.maxDelayMs);
  }
}
