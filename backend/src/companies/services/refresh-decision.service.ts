import { Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import {
  CachePolicyEvaluationService,
  PolicyEvaluationResult,
} from './cache-policy-evaluation.service';

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * P02-T05: Where a refresh decision directs data to be served from.
 *
 * - 'db'       – Serve fresh data directly from the database cache.
 * - 'stale_db' – Serve stale data from DB (staleness badge should be surfaced).
 * - 'api'      – Fetch live data from the external provider.
 */
export type ServeFrom = 'db' | 'stale_db' | 'api';

/**
 * P02-T05: Cost and quota flags emitted with every refresh decision.
 * Consumed by downstream billing / quota enforcement systems.
 */
export interface RefreshCostFlags {
  /** True when the caller explicitly requested a provider call (bypassing cache). */
  force_refresh?: boolean;
  /** True when a quota hook reported that the tenant's quota is exhausted. */
  quota_exceeded?: boolean;
  /** True when the entity has been refreshed above a high-frequency threshold. */
  high_frequency?: boolean;
  /** Arbitrary provider- or policy-level flags merged from the resolved policy. */
  [key: string]: unknown;
}

/**
 * P02-T05: The output of a single refresh decision run.
 *
 * All fields are mandatory so consumers can always act on the result without
 * null-checking.
 */
export interface RefreshDecision {
  /** Explicit directive: where to serve data from. Never a silent default. */
  serve_from: ServeFrom;
  /** Human-readable explanation of why this decision was made. */
  reason: string;
  /** Cost/quota flags for billing and quota enforcement downstream. */
  cost_flags: RefreshCostFlags;
  /** Whether the decision was triggered by a force-refresh request. */
  force_refresh: boolean;
}

/**
 * P02-T05: Context object passed to each quota hook.
 * The hook may inspect the draft decision and return a veto or modification.
 */
export interface QuotaHookContext {
  /** Tenant for whom the decision is being made. */
  tenantId: string;
  /** Entity being looked up (e.g. org number). */
  entityId?: string;
  /** Type of entity (e.g. 'company'). */
  entityType?: string;
  /** Request-scoped correlation ID for lineage tracing. */
  correlationId?: string | null;
  /** The draft decision produced before quota checks. */
  draftDecision: RefreshDecision;
}

/**
 * P02-T05: Result returned by a quota hook.
 */
export interface QuotaHookResult {
  /** When false, the hook vetoes the decision and forces a stale fallback. */
  allow: boolean;
  /** Optional overrides applied to the draft decision when allow=true. */
  modified?: Partial<Pick<RefreshDecision, 'serve_from' | 'reason' | 'cost_flags'>>;
}

/** A pre-decision hook that can veto or modify a refresh decision. */
export type QuotaHook = (ctx: QuotaHookContext) => Promise<QuotaHookResult>;

/**
 * P02-T05: Parameters for a single refresh decision call.
 */
export interface RefreshDecisionParams {
  /** Tenant scoping — all decisions are tenant-isolated. */
  tenantId: string;
  /** Age of the currently cached data in fractional hours (0 when no cache exists). */
  dataAgeHours: number;
  /** When true, skip all cache/policy checks and go directly to the API. */
  forceRefresh?: boolean;
  /** Entity identifier (e.g. org number) for entity-level policy resolution. */
  entityId?: string;
  /** Entity type for entity-level policy resolution. */
  entityType?: string;
  /** Request-scoped correlation ID for lineage tracing. */
  correlationId?: string | null;
  /** Actor (user/service) that initiated the lookup. */
  actorId?: string | null;
  /**
   * When false, the service treats the API as unavailable and will downgrade
   * an 'api' decision to 'stale_db' if the policy permits stale fallback.
   * Defaults to true.
   */
  isApiAvailable?: boolean;
  /**
   * Optional pre-decision quota hooks called before the final decision is
   * confirmed.  Each hook may veto the decision (forcing a stale fallback) or
   * modify fields such as cost_flags.  Hook failures are non-blocking.
   */
  quotaHooks?: QuotaHook[];
}

/**
 * P02-T05: Result of a batch refresh decision call.
 */
export interface BatchRefreshDecisionResult {
  /** One entry per input item, in the same order. */
  decisions: Array<{ params: RefreshDecisionParams; decision: RefreshDecision }>;
  /** Count of items with serve_from='api'. */
  apiCallCount: number;
  /** Count of items with serve_from='db'. */
  dbHitCount: number;
  /** Count of items with serve_from='stale_db'. */
  staleFallbackCount: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * P02-T05: Refresh decision service.
 *
 * Makes explicit, auditable, and testable decisions about where to serve data
 * from (DB cache, stale DB, or live API) for a given tenant and entity.
 *
 * Decision pipeline:
 *   1. Force-refresh override  → if requested, always serve from API.
 *   2. Policy evaluation       → consume CachePolicyEvaluationService (P02-T04)
 *                                to map PolicyDecision → ServeFrom.
 *   3. API availability check  → downgrade 'api' → 'stale_db' when unavailable.
 *   4. Quota hook points       → pre-decision hooks may veto or modify the draft.
 *   5. Audit emission          → best-effort audit event on every decision.
 */
@Injectable()
export class RefreshDecisionService {
  private readonly logger = new Logger(RefreshDecisionService.name);

  constructor(
    private readonly cachePolicyEvaluationService: CachePolicyEvaluationService,
    private readonly auditService: AuditService,
  ) {}

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Make a refresh decision for a single entity.
   *
   * The returned decision is always explicit: serve_from is never a silent
   * default.  All inputs that influenced the decision are captured in `reason`
   * and `cost_flags`.
   */
  async decide(params: RefreshDecisionParams): Promise<RefreshDecision> {
    const {
      tenantId,
      dataAgeHours,
      forceRefresh = false,
      entityId,
      entityType,
      correlationId,
      actorId,
      isApiAvailable = true,
      quotaHooks = [],
    } = params;

    let decision: RefreshDecision;

    // ── Step 1: Force-refresh override ──────────────────────────────────────
    if (forceRefresh) {
      decision = {
        serve_from: 'api',
        reason: 'force_refresh_override',
        cost_flags: { force_refresh: true },
        force_refresh: true,
      };
    } else {
      // ── Step 2: Policy-driven decision ────────────────────────────────────
      let policyResult: PolicyEvaluationResult | null = null;
      try {
        policyResult = await this.cachePolicyEvaluationService.evaluate(
          tenantId,
          dataAgeHours,
          { entityType, entityId, correlationId, actorId },
        );
      } catch (err) {
        this.logger.error(
          `[P02-T05] Policy evaluation failed for tenant=${tenantId} entity=${entityId ?? 'n/a'}; falling back to safe decision. ${err}`,
        );
      }

      decision = this._mapPolicyToDecision(policyResult, dataAgeHours);
    }

    // ── Step 3: API availability check ──────────────────────────────────────
    if (decision.serve_from === 'api' && !isApiAvailable) {
      decision = this._applyStaleFallback(decision);
    }

    // ── Step 4: Quota hook points ────────────────────────────────────────────
    if (quotaHooks.length > 0) {
      decision = await this._runQuotaHooks(decision, quotaHooks, {
        tenantId,
        entityId,
        entityType,
        correlationId,
      });
    }

    // ── Step 5: Audit emission (best-effort; never throws) ───────────────────
    this._emitAuditEvent(tenantId, actorId ?? null, decision, {
      correlationId: correlationId ?? null,
      entityId: entityId ?? null,
      entityType: entityType ?? null,
      dataAgeHours,
    }).catch((err) =>
      this.logger.warn(`[P02-T05] Audit emit failed: ${err}`),
    );

    return decision;
  }

  /**
   * Make refresh decisions for multiple entities in a single call.
   *
   * Quota checks are batched so that hooks receive each decision individually
   * but are not called once per batch — failures in one item do not abort the
   * rest.
   */
  async decideBatch(
    items: RefreshDecisionParams[],
  ): Promise<BatchRefreshDecisionResult> {
    const results = await Promise.all(
      items.map(async (p) => {
        try {
          const decision = await this.decide(p);
          return { params: p, decision };
        } catch (err) {
          // Per-item failure must not abort the batch; emit a safe fallback.
          this.logger.error(
            `[P02-T05] decideBatch item failed for tenant=${p.tenantId} entity=${p.entityId ?? 'n/a'}; returning safe fallback. ${err}`,
          );
          const fallback: RefreshDecision = {
            serve_from: 'stale_db',
            reason: 'decision_error_safe_fallback',
            cost_flags: {},
            force_refresh: false,
          };
          return { params: p, decision: fallback };
        }
      }),
    );

    const apiCallCount = results.filter((r) => r.decision.serve_from === 'api').length;
    const dbHitCount = results.filter((r) => r.decision.serve_from === 'db').length;
    const staleFallbackCount = results.filter((r) => r.decision.serve_from === 'stale_db').length;

    return { decisions: results, apiCallCount, dbHitCount, staleFallbackCount };
  }

  // ── Internal helpers ────────────────────────────────────────────────────────

  /**
   * Map a PolicyEvaluationResult to a RefreshDecision.
   * Falls back to a safe 'stale_db' decision when policy evaluation failed.
   */
  private _mapPolicyToDecision(
    policyResult: PolicyEvaluationResult | null,
    dataAgeHours: number,
  ): RefreshDecision {
    if (!policyResult) {
      // Policy evaluation failed entirely; serve stale if any data exists,
      // otherwise send to API (dataAgeHours=0 means no cached data).
      const serveFrom: ServeFrom = dataAgeHours > 0 ? 'stale_db' : 'api';
      return {
        serve_from: serveFrom,
        reason: 'policy_evaluation_error_safe_fallback',
        cost_flags: {},
        force_refresh: false,
      };
    }

    const { decision: policyDecision, staleFallbackAllowed, costFlags } = policyResult;

    let serve_from: ServeFrom;
    let reason: string;

    switch (policyDecision) {
      case 'fresh':
        serve_from = 'db';
        reason = 'policy_fresh';
        break;
      case 'stale_serve':
        serve_from = 'stale_db';
        reason = 'policy_stale_serve';
        break;
      case 'refresh_required':
        serve_from = staleFallbackAllowed ? 'stale_db' : 'api';
        reason = staleFallbackAllowed
          ? 'policy_refresh_required_stale_fallback'
          : 'policy_refresh_required';
        break;
      case 'provider_call':
        serve_from = 'api';
        reason = 'policy_provider_call';
        break;
      default:
        serve_from = 'api';
        reason = 'policy_unknown_fallback_api';
    }

    return {
      serve_from,
      reason,
      cost_flags: { ...costFlags },
      force_refresh: false,
    };
  }

  /**
   * Downgrade an 'api' decision to 'stale_db' because the provider is
   * unavailable.  The decision is always downgraded to 'stale_db' regardless
   * of whether cached data actually exists — callers must handle the case where
   * no stale data is available and surface the API-unavailable state to users.
   */
  private _applyStaleFallback(decision: RefreshDecision): RefreshDecision {
    return {
      ...decision,
      serve_from: 'stale_db',
      reason: `${decision.reason}_api_unavailable_stale_fallback`,
      cost_flags: { ...decision.cost_flags },
    };
  }

  /**
   * Run all quota hooks sequentially.  Each hook may veto or modify the draft
   * decision.  Hook failures are non-blocking — the last safe decision is kept.
   */
  private async _runQuotaHooks(
    decision: RefreshDecision,
    hooks: QuotaHook[],
    ctx: Pick<QuotaHookContext, 'tenantId' | 'entityId' | 'entityType' | 'correlationId'>,
  ): Promise<RefreshDecision> {
    let current = { ...decision };

    for (const hook of hooks) {
      try {
        const hookCtx: QuotaHookContext = { ...ctx, draftDecision: { ...current } };
        const result = await hook(hookCtx);

        if (!result.allow) {
          // Quota veto: downgrade to stale_db (safe fallback).
          current = {
            ...current,
            serve_from: 'stale_db',
            reason: `${current.reason}_quota_veto`,
            cost_flags: { ...current.cost_flags, quota_exceeded: true },
          };
          this.logger.warn(
            `[P02-T05] Quota hook vetoed decision for tenant=${ctx.tenantId} entity=${ctx.entityId ?? 'n/a'}; downgraded to stale_db.`,
          );
        } else if (result.modified) {
          // Hook allowed but provided modifications.
          current = {
            ...current,
            ...(result.modified.serve_from !== undefined && { serve_from: result.modified.serve_from }),
            ...(result.modified.reason !== undefined && { reason: result.modified.reason }),
            cost_flags: {
              ...current.cost_flags,
              ...(result.modified.cost_flags ?? {}),
            },
          };
        }
      } catch (hookErr) {
        // Hook failure must not block the decision; fall back to stale_db.
        this.logger.error(
          `[P02-T05] Quota hook threw for tenant=${ctx.tenantId} entity=${ctx.entityId ?? 'n/a'}; falling back to stale_db. ${hookErr}`,
        );
        current = {
          ...current,
          serve_from: 'stale_db',
          reason: `${current.reason}_quota_hook_error_fallback`,
          cost_flags: { ...current.cost_flags },
        };
      }
    }

    return current;
  }

  /** Emit a best-effort audit log entry for the refresh decision. */
  private async _emitAuditEvent(
    tenantId: string,
    actorId: string | null,
    decision: RefreshDecision,
    meta: {
      correlationId: string | null;
      entityId: string | null;
      entityType: string | null;
      dataAgeHours: number;
    },
  ): Promise<void> {
    await this.auditService.log({
      tenantId,
      actorId,
      action: 'refresh_decision.made',
      resourceType: meta.entityType ?? 'entity',
      resourceId: meta.entityId ?? tenantId,
      metadata: {
        correlationId: meta.correlationId,
        entityId: meta.entityId,
        entityType: meta.entityType,
        dataAgeHours: meta.dataAgeHours,
        serve_from: decision.serve_from,
        reason: decision.reason,
        cost_flags: decision.cost_flags,
        force_refresh: decision.force_refresh,
      },
    });
  }
}
