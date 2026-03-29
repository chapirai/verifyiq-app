import { Injectable } from '@nestjs/common';
import { SnapshotPolicyDecision } from '../entities/bv-fetch-snapshot.entity';
import { CachePolicyEvaluationService, SAFE_DEFAULT_POLICY } from './cache-policy-evaluation.service';
import { SnapshotQueryService } from './snapshot-query.service';

const MS_PER_HOUR = 1000 * 60 * 60;

export type CompanyFreshnessStatus = 'fresh' | 'stale' | 'degraded';
export type CompanyCacheDecision =
  | 'served_from_cache'
  | 'served_stale'
  | 'fetched_from_provider'
  | 'unknown';

export interface CompanyFreshnessMetadata {
  org_number: string;
  has_data: boolean;
  last_fetched_timestamp: string | null;
  freshness_status: CompanyFreshnessStatus;
  next_refresh_time: string | null;
  provider_name: string | null;
  endpoint_used: string | null;
  cache_decision: CompanyCacheDecision;
  policy_decision: SnapshotPolicyDecision | null;
  snapshot_id: string | null;
}

export interface CompanySnapshotHistoryItem {
  id: string;
  fetched_at: string;
  fetch_status: string;
  policy_decision: SnapshotPolicyDecision;
  trigger_type: string;
  is_from_cache: boolean;
  is_stale_fallback: boolean;
  api_call_count: number;
  source_name: string;
  version_number: number;
  correlation_id: string | null;
}

function resolveBaseFreshness(
  ageHours: number,
  freshnessWindowHours: number,
  maxAgeHours: number,
): 'fresh' | 'stale' {
  if (Number.isNaN(ageHours) || ageHours < 0) return 'stale';
  if (ageHours < freshnessWindowHours) return 'fresh';
  if (ageHours < maxAgeHours) return 'stale';
  return 'stale';
}

function resolveCacheDecision(
  policyDecision: SnapshotPolicyDecision | null,
  isFromCache: boolean,
  isStaleFallback: boolean,
): CompanyCacheDecision {
  if (policyDecision === 'stale_fallback' || isStaleFallback) return 'served_stale';
  if (policyDecision === 'cache_hit' || isFromCache) return 'served_from_cache';
  if (policyDecision === 'fresh_fetch' || policyDecision === 'force_refresh') {
    return 'fetched_from_provider';
  }
  return isFromCache ? 'served_from_cache' : 'fetched_from_provider';
}

function resolveTriggerType(
  policyDecision: SnapshotPolicyDecision,
  isFromCache: boolean,
  isStaleFallback: boolean,
): string {
  if (policyDecision === 'force_refresh') return 'FORCE_REFRESH';
  if (policyDecision === 'stale_fallback' || isStaleFallback) return 'STALE_FALLBACK';
  if (policyDecision === 'cache_hit' || isFromCache) return 'CACHE_HIT';
  return 'API_REQUEST';
}

function resolveEndpointUsed(
  policyDecision: SnapshotPolicyDecision | null,
  isFromCache: boolean,
  isStaleFallback: boolean,
): string {
  if (policyDecision === 'cache_hit' || policyDecision === 'stale_fallback' || isFromCache || isStaleFallback) {
    return 'cache';
  }
  return '/bolagsverket/enrich';
}

@Injectable()
export class CompanyMetadataService {
  constructor(
    private readonly snapshotQueryService: SnapshotQueryService,
    private readonly cachePolicyEvaluationService: CachePolicyEvaluationService,
  ) {}

  // P02-T11: Freshness + source metadata for company profile panels.
  async getFreshnessMetadata(tenantId: string, orgNumber: string): Promise<CompanyFreshnessMetadata> {
    const [snapshot] = await this.snapshotQueryService.getSnapshotHistory(tenantId, orgNumber, 1);
    if (!snapshot) {
      return {
        org_number: orgNumber,
        has_data: false,
        last_fetched_timestamp: null,
        freshness_status: 'stale',
        next_refresh_time: null,
        provider_name: null,
        endpoint_used: null,
        cache_decision: 'unknown',
        policy_decision: null,
        snapshot_id: null,
      };
    }

    const policy = (await this.cachePolicyEvaluationService.getPolicyForTenant(tenantId)) ?? SAFE_DEFAULT_POLICY;
    const ageHours = (Date.now() - snapshot.fetchedAt.getTime()) / MS_PER_HOUR;
    const baseFreshness = resolveBaseFreshness(
      ageHours,
      policy.freshnessWindowHours,
      policy.maxAgeHours,
    );
    const degraded = snapshot.policyDecision === 'stale_fallback' || snapshot.isStaleFallback;
    const freshnessStatus: CompanyFreshnessStatus = degraded ? 'degraded' : baseFreshness;
    const nextRefreshTime = new Date(
      snapshot.fetchedAt.getTime() + policy.refreshTriggerHours * MS_PER_HOUR,
    ).toISOString();

    return {
      org_number: orgNumber,
      has_data: true,
      last_fetched_timestamp: snapshot.fetchedAt.toISOString(),
      freshness_status: freshnessStatus,
      next_refresh_time: nextRefreshTime,
      provider_name: snapshot.sourceName,
      endpoint_used: resolveEndpointUsed(snapshot.policyDecision ?? null, snapshot.isFromCache, snapshot.isStaleFallback),
      cache_decision: resolveCacheDecision(
        snapshot.policyDecision ?? null,
        snapshot.isFromCache,
        snapshot.isStaleFallback,
      ),
      policy_decision: snapshot.policyDecision ?? null,
      snapshot_id: snapshot.id,
    };
  }

  // P02-T11: Snapshot history tailored for company profile timeline.
  async getSnapshotHistory(
    tenantId: string,
    orgNumber: string,
    limit = 20,
  ): Promise<CompanySnapshotHistoryItem[]> {
    const snapshots = await this.snapshotQueryService.getSnapshotHistory(tenantId, orgNumber, limit);
    return snapshots.map((snapshot) => ({
      id: snapshot.id,
      fetched_at: snapshot.fetchedAt.toISOString(),
      fetch_status: snapshot.fetchStatus,
      policy_decision: snapshot.policyDecision,
      trigger_type: resolveTriggerType(snapshot.policyDecision, snapshot.isFromCache, snapshot.isStaleFallback),
      is_from_cache: snapshot.isFromCache,
      is_stale_fallback: snapshot.isStaleFallback,
      api_call_count: snapshot.apiCallCount ?? 0,
      source_name: snapshot.sourceName,
      version_number: snapshot.versionNumber,
      correlation_id: snapshot.correlationId ?? null,
    }));
  }
}
