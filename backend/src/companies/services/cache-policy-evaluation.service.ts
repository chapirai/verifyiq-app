import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AuditService } from '../../audit/audit.service';
import { CachePolicyEntity } from '../entities/cache-policy.entity';

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * P02-T04: Outcome of a single policy evaluation run.
 *
 * - 'fresh'            – Data is within the freshness window; serve from cache.
 * - 'stale_serve'      – Data is stale but stale_fallback_allowed; serve with badge.
 * - 'refresh_required' – Data has exceeded refresh_trigger_hours; trigger async refresh.
 * - 'provider_call'    – Data has exceeded max_age_hours; require a synchronous provider call.
 */
export type PolicyDecision = 'fresh' | 'stale_serve' | 'refresh_required' | 'provider_call';

/** Full result returned by CachePolicyEvaluationService.evaluate(). */
export interface PolicyEvaluationResult {
  /** Recommended action for the caller. */
  decision: PolicyDecision;
  /** True when data age is within freshness_window_hours. */
  isFresh: boolean;
  /** True when data age is between freshness_window_hours and max_age_hours. */
  isStale: boolean;
  /** True when data age exceeds max_age_hours. */
  isExpired: boolean;
  /** True when data age exceeds refresh_trigger_hours. */
  shouldTriggerRefresh: boolean;
  /** Whether stale data may be served as fallback. */
  staleFallbackAllowed: boolean;
  /** Cost/quota flags from the resolved policy. */
  costFlags: Record<string, unknown>;
  /** ID of the policy record that was applied. */
  policyId: string;
  /** True when the system-default policy was used (no tenant override found). */
  usedSystemDefault: boolean;
  /** Age of the data in hours at evaluation time. */
  dataAgeHours: number;
}

/**
 * P02-T04: Safe default policy used when the DB lookup fails or returns no rows.
 * Conservative values ensure data is not overly stale if the policy table is
 * empty or unavailable.
 */
export const SAFE_DEFAULT_POLICY = {
  id: 'system-safe-default',
  freshnessWindowHours: 720,   // 30 days
  maxAgeHours: 2160,           // 90 days
  refreshTriggerHours: 1440,   // 60 days
  staleFallbackAllowed: true,
  forceRefreshCostFlags: {} as Record<string, unknown>,
} as const;

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * P02-T04: Centralized cache policy evaluation engine.
 *
 * Resolves the applicable policy for a (tenant, entity) combination, then
 * evaluates whether cached data should be served, refreshed, or replaced with
 * a live provider call.
 *
 * Policy resolution order:
 *   1. Entity-level override  (tenantId + entityType + entityId)
 *   2. Tenant-level policy    (tenantId only)
 *   3. System default         (is_system_default = true)
 *   4. Hard-coded safe default (if DB is unavailable)
 */
@Injectable()
export class CachePolicyEvaluationService {
  private readonly logger = new Logger(CachePolicyEvaluationService.name);

  constructor(
    @InjectRepository(CachePolicyEntity)
    private readonly policyRepo: Repository<CachePolicyEntity>,
    private readonly auditService: AuditService,
  ) {}

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Evaluate the cache policy for `tenantId` against `dataAgeHours`.
   *
   * @param tenantId     Tenant requesting the data.
   * @param dataAgeHours Age of the cached data in fractional hours.
   * @param opts         Optional entity-level scoping or auditing context.
   */
  async evaluate(
    tenantId: string,
    dataAgeHours: number,
    opts: {
      entityType?: string;
      entityId?: string;
      correlationId?: string | null;
      actorId?: string | null;
      orgNumber?: string;
    } = {},
  ): Promise<PolicyEvaluationResult> {
    let policy: CachePolicyEntity | null = null;
    let usedSystemDefault = false;

    try {
      policy = await this._resolvePolicy(tenantId, opts.entityType, opts.entityId);
    } catch (err) {
      this.logger.error(
        `[P02-T04] Policy lookup failed for tenant=${tenantId}; using safe default. Error: ${err}`,
      );
    }

    if (!policy) {
      usedSystemDefault = true;
    } else {
      usedSystemDefault = policy.isSystemDefault;
    }

    const result = this._computeDecision(policy, dataAgeHours, usedSystemDefault);

    // Emit audit event for the policy evaluation (best-effort; never throws).
    this._emitAuditEvent(
      tenantId,
      opts.actorId ?? null,
      result,
      opts.correlationId ?? null,
      opts.orgNumber,
    ).catch((err) =>
      this.logger.warn(`[P02-T04] Audit emit failed: ${err}`),
    );

    return result;
  }

  /**
   * Retrieve the effective policy for a tenant (without evaluation).
   * Returns null when neither a tenant-specific nor system-default policy exists.
   */
  async getPolicyForTenant(tenantId: string): Promise<CachePolicyEntity | null> {
    try {
      return await this._resolvePolicy(tenantId);
    } catch (err) {
      this.logger.error(
        `[P02-T04] getPolicyForTenant failed for tenant=${tenantId}: ${err}`,
      );
      return null;
    }
  }

  /** List all active policies (admin read endpoint). */
  async listPolicies(): Promise<CachePolicyEntity[]> {
    return this.policyRepo.find({
      where: { isActive: true },
      order: { createdAt: 'ASC' },
    });
  }

  /** Get a single policy by ID. Returns null if not found. */
  async getPolicyById(id: string): Promise<CachePolicyEntity | null> {
    return this.policyRepo.findOne({ where: { id } });
  }

  // ── Internal helpers ────────────────────────────────────────────────────────

  /**
   * Resolve the most specific applicable policy for the given context.
   * Resolution order: entity-level → tenant-level → system default.
   */
  private async _resolvePolicy(
    tenantId: string,
    entityType?: string,
    entityId?: string,
  ): Promise<CachePolicyEntity | null> {
    // 1. Entity-level override
    if (entityType && entityId) {
      const entityPolicy = await this.policyRepo.findOne({
        where: { tenantId, entityType, entityId, isActive: true },
        order: { createdAt: 'DESC' },
      });
      if (entityPolicy) return entityPolicy;
    }

    // 2. Tenant-level policy
    const tenantPolicy = await this.policyRepo.findOne({
      where: { tenantId, entityType: IsNull(), entityId: IsNull(), isActive: true },
      order: { createdAt: 'DESC' },
    });
    if (tenantPolicy) return tenantPolicy;

    // 3. System default
    const systemDefault = await this.policyRepo.findOne({
      where: { isSystemDefault: true, isActive: true },
      order: { createdAt: 'DESC' },
    });
    return systemDefault ?? null;
  }

  /**
   * Compute the policy decision from a resolved policy (or the hard-coded
   * safe default when `policy` is null).
   */
  private _computeDecision(
    policy: CachePolicyEntity | null,
    dataAgeHours: number,
    usedSystemDefault: boolean,
  ): PolicyEvaluationResult {
    const p = policy ?? SAFE_DEFAULT_POLICY;

    const isFresh = dataAgeHours < p.freshnessWindowHours;
    const isExpired = dataAgeHours >= p.maxAgeHours;
    const isStale = !isFresh && !isExpired;
    const shouldTriggerRefresh = dataAgeHours >= p.refreshTriggerHours;

    let decision: PolicyDecision;

    if (isFresh) {
      decision = 'fresh';
    } else if (isExpired) {
      // Beyond max_age: force a provider call regardless of fallback setting
      decision = 'provider_call';
    } else if (shouldTriggerRefresh) {
      // Past the refresh trigger but not yet expired
      decision = 'refresh_required';
    } else {
      // Stale but within refresh window
      decision = p.staleFallbackAllowed ? 'stale_serve' : 'refresh_required';
    }

    return {
      decision,
      isFresh,
      isStale,
      isExpired,
      shouldTriggerRefresh,
      staleFallbackAllowed: p.staleFallbackAllowed,
      costFlags: { ...p.forceRefreshCostFlags },
      policyId: policy?.id ?? SAFE_DEFAULT_POLICY.id,
      usedSystemDefault,
      dataAgeHours,
    };
  }

  /** Emit a best-effort audit log entry for the policy evaluation. */
  private async _emitAuditEvent(
    tenantId: string,
    actorId: string | null,
    result: PolicyEvaluationResult,
    correlationId: string | null,
    orgNumber?: string,
  ): Promise<void> {
    await this.auditService.log({
      tenantId,
      actorId,
      action: 'cache_policy.evaluated',
      resourceType: 'cache_policy',
      resourceId: result.policyId,
      metadata: {
        correlationId,
        orgNumber: orgNumber ?? null,
        decision: result.decision,
        dataAgeHours: result.dataAgeHours,
        isFresh: result.isFresh,
        isStale: result.isStale,
        isExpired: result.isExpired,
        shouldTriggerRefresh: result.shouldTriggerRefresh,
        staleFallbackAllowed: result.staleFallbackAllowed,
        usedSystemDefault: result.usedSystemDefault,
      },
    });
  }
}
