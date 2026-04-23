import { clearSession, getAccessToken, getRefreshToken, setSession } from '@/lib/auth';
import { API_V1_BASE_URL } from '@/lib/api-base-url';
import type { ApiEnvelope, ApiKey, AuthTokens, BillingPlan, BulkJob, CompanyListResponse, OauthClient } from '@/types/api';
import type {
  CompanyServingBundle,
  CompanyEngagementServing,
  CompanyFiCaseServing,
  CompanyFiReportServing,
  CompanyHvdDocumentServing,
  CompanyOfficerServing,
  CompanyOverviewServing,
  CompanyShareCapitalServing,
  CompanyVerkligaHuvudmanServing,
} from '@/types/company-serving';
import type {
  AnnualReportFinancialComparison,
  AnnualReportWorkspaceReadModel,
  CompanyAnnualReportHeader,
  IngestHvdAnnualReportResult,
} from '@/types/annual-reports';
import type {
  CreateMonitoringSubscriptionPayload,
  MonitoringAlert,
  MonitoringGroupedFeedRow,
  MonitoringSubscription,
} from '@/types/monitoring';
import type { TargetList } from '@/types/target-lists';
import type {
  CompanySignalsJobStatus,
  CompanySignalsResponse,
  CompanySignalsRecomputeResponse,
} from '@/types/company-signals';
import type { CompanyDecisionInsight, CompanyDecisionInsightSnapshot } from '@/types/decision';
import type { SimilarCompaniesResponse, SourcingParseResult } from '@/types/sourcing';

const API_BASE_URL = API_V1_BASE_URL;
const AUTH_PATHS = ['/auth/login', '/auth/signup', '/auth/refresh', '/auth/verify-email'];

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const perform = async (token?: string | null) => {
    try {
      return await fetch(`${API_BASE_URL}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(init?.headers ?? {}),
        },
        cache: 'no-store',
      });
    } catch (e: unknown) {
      const hint = e instanceof Error ? e.message : String(e);
      throw new ApiError(`Network error while calling ${path}: ${hint}`, 0, { path, cause: hint });
    }
  };

  let res = await perform(getAccessToken());
  if (res.status === 401 && !AUTH_PATHS.some(p => path.startsWith(p))) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      res = await perform(refreshed);
    }
  }
  if (!res.ok) {
    let details: unknown = null;
    try {
      details = await res.json();
    } catch {
      details = await res.text();
    }
    if (res.status === 401) clearSession();
    const message =
      typeof details === 'object' && details && 'message' in details
        ? String((details as { message?: string }).message)
        : 'Request failed';
    throw new ApiError(message, res.status, details);
  }
  return (await res.json()) as T;
}

async function requestText(path: string, init?: RequestInit): Promise<string> {
  const perform = async (token?: string | null) =>
    fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
      cache: 'no-store',
    });
  let res = await perform(getAccessToken());
  if (res.status === 401 && !AUTH_PATHS.some(p => path.startsWith(p))) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      res = await perform(refreshed);
    }
  }
  if (!res.ok) {
    let details: unknown = null;
    try {
      details = await res.json();
    } catch {
      details = await res.text();
    }
    const message = typeof details === 'object' && details && 'message' in details
      ? String((details as { message?: string }).message)
      : 'Request failed';
    throw new ApiError(message, res.status, details);
  }
  return res.text();
}

let refreshInFlight: Promise<string | null> | null = null;
async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
        cache: 'no-store',
      });
      if (!res.ok) {
        clearSession();
        return null;
      }
      const data = (await res.json()) as AuthTokens;
      if (!data?.accessToken || !data?.refreshToken || !data?.user) {
        clearSession();
        return null;
      }
      setSession(data.accessToken, data.refreshToken, data.user);
      return data.accessToken;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export const api = {
  async healthHvd() {
    return request('/bolagsverket/hvd/isalive');
  },
  async healthFi() {
    return request('/bolagsverket/fi/isalive');
  },
  async healthVh() {
    return request<{ status: string; enabled: boolean }>('/bolagsverket/vh/isalive');
  },
  async login(payload: { email: string; password: string }) {
    const data = await request<AuthTokens>('/auth/login', { method: 'POST', body: JSON.stringify(payload) });
    setSession(data.accessToken, data.refreshToken, data.user);
    return data;
  },
  async signup(payload: {
    fullName: string;
    email: string;
    companyName?: string;
    termsAccepted: boolean;
  }) {
    return request<{ status: string; email: string }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  async resendSignupVerification(email: string) {
    return request<{ status: string }>('/auth/signup/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },
  async verifyEmail(token: string) {
    return request<{ status: string; passwordSetupToken: string; redirectUrl: string }>(
      `/auth/verify-email?token=${encodeURIComponent(token)}`,
    );
  },
  async setPassword(token: string, password: string) {
    const data = await request<AuthTokens>('/auth/set-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
    setSession(data.accessToken, data.refreshToken, data.user);
    return data;
  },
  async forgotPassword(email: string) {
    return request<{ status: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },
  async resetPassword(token: string, password: string) {
    return request<{ status: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  },
  async refresh() {
    const refreshToken = getRefreshToken();
    if (!refreshToken) throw new ApiError('Session expired', 401);
    const data = await request<AuthTokens>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
    setSession(data.accessToken, data.refreshToken, data.user);
    return data;
  },
  async logout() {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      await request('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) });
    }
    clearSession();
  },
  async getCompanies(query = '') {
    return request<CompanyListResponse>(`/companies${query ? `?${query}` : ''}`);
  },
  /** Phase 4 discovery — same contract as GET /companies; prefer for ranked sourcing UIs. */
  async searchCompanies(query = '') {
    return request<CompanyListResponse>(`/companies/search${query ? `?${query}` : ''}`);
  },
  async getSearchPerformance() {
    return request<{
      samples: number;
      p50_ms: number;
      p95_ms: number;
      p99_ms: number;
      target_ms: number;
      target_met_p95: boolean | null;
    }>('/companies/search/performance');
  },
  async compareCompanies(payload: { organisationNumbers: string[]; years?: number }) {
    return request<{
      data: Array<{
        organisationNumber: string;
        company: {
          legalName: string;
          status: string | null;
          companyForm: string | null;
          countryCode: string;
          updatedAt: string;
          businessDescription: string | null;
        } | null;
        ownership: { currentEdges: number; ownershipRiskScore?: number };
        financials: {
          fiscalYear: string | null;
          revenue: string | null;
          netResult: string | null;
          totalAssets: string | null;
          totalEquity: string | null;
          equityRatio: number | null;
          statementsCount: number;
        };
        signals: Array<{
          signalType: string;
          score: number | null;
          engineVersion: string;
          computedAt: string;
          explanation: Record<string, unknown>;
        }>;
      }>;
      summary: { compared: number; orgs: string[] };
    }>('/companies/compare', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  async parseSourcingQuery(text: string) {
    return request<SourcingParseResult>('/companies/sourcing/parse-query', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  },
  async getSimilarCompanies(organisationNumber: string, limit = 10, mode?: string) {
    const q = new URLSearchParams({ limit: String(limit) });
    if (mode) q.set('mode', mode);
    return request<SimilarCompaniesResponse>(`/companies/${organisationNumber}/similar?${q}`);
  },
  async getCompanySignals(organisationNumber: string) {
    return request<CompanySignalsResponse>(`/companies/${organisationNumber}/signals`);
  },
  async recomputeCompanySignals(organisationNumber: string) {
    return request<CompanySignalsRecomputeResponse>(
      `/companies/${organisationNumber}/signals/recompute`,
      { method: 'POST' },
    );
  },
  async getCompanySignalsJobStatus(organisationNumber: string, jobId: string) {
    return request<CompanySignalsJobStatus>(
      `/companies/${organisationNumber}/signals/jobs/${encodeURIComponent(jobId)}`,
    );
  },
  async getCompanyDecisionInsight(organisationNumber: string, mode?: 'pe' | 'credit' | 'compliance', persist = false) {
    const q = new URLSearchParams();
    if (mode) q.set('mode', mode);
    if (persist) q.set('persist', 'true');
    const qs = q.toString();
    return request<CompanyDecisionInsight>(
      `/companies/${organisationNumber}/decision-insight${qs ? `?${qs}` : ''}`,
    );
  },
  async getCompanyDecisionInsightHistory(
    organisationNumber: string,
    mode: 'pe' | 'credit' | 'compliance' = 'pe',
    limit = 20,
  ) {
    const q = new URLSearchParams({ mode, limit: String(limit) });
    return request<CompanyDecisionInsightSnapshot[]>(
      `/companies/${organisationNumber}/decision-insight/history?${q}`,
    );
  },
  async captureCompanyDecisionSnapshots(organisationNumber: string) {
    return request<CompanyDecisionInsight[]>(
      `/companies/${organisationNumber}/decision-insight/snapshot`,
      { method: 'POST' },
    );
  },
  async getCompany(id: string) {
    return request(`/companies/${id}`);
  },
  async getCompanyFreshness(orgNumber: string) {
    return request(`/companies/${orgNumber}/freshness`);
  },
  async getCompanySnapshots(orgNumber: string, limit = 20) {
    return request(`/companies/${orgNumber}/snapshots?limit=${limit}`);
  },
  async lookupCompany(orgNumber: string, forceRefresh = false) {
    return request('/companies/lookup', {
      method: 'POST',
      body: JSON.stringify({ identitetsbeteckning: orgNumber, force_refresh: forceRefresh }),
    });
  },
  async getPlans() {
    return request<ApiEnvelope<BillingPlan[]>>('/billing/plans');
  },
  async getSubscription() {
    return request('/billing/subscription');
  },
  async getEntitlements() {
    return request('/entitlements');
  },
  async createCheckoutSession(planCode: string) {
    return request('/billing/checkout-session', {
      method: 'POST',
      body: JSON.stringify({ planCode }),
    });
  },
  async createBillingPortalSession() {
    return request('/billing/portal-session', { method: 'POST' });
  },
  async confirmPayment(sessionId: string, planCode: string) {
    return request('/billing/payment/confirm', {
      method: 'POST',
      body: JSON.stringify({ sessionId, planCode }),
    });
  },
  async listApiKeys() {
    return request<ApiEnvelope<ApiKey[]>>('/api-keys');
  },
  async createApiKey(name: string) {
    return request<ApiEnvelope<ApiKey>>('/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },
  async createApiKeyWithEnvironment(name: string, environment: 'live' | 'sandbox') {
    return request<ApiEnvelope<ApiKey>>('/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name, environment }),
    });
  },
  async revokeApiKey(id: string) {
    return request(`/api-keys/${id}`, { method: 'DELETE' });
  },
  async listOauthClients() {
    return request<ApiEnvelope<OauthClient[]>>('/me/oauth-clients');
  },
  async createOauthClient(payload: { name: string; environment?: 'live' | 'sandbox'; scopes?: string[] }) {
    return request<ApiEnvelope<OauthClient>>('/me/oauth-clients', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  async revokeOauthClient(id: string) {
    return request(`/me/oauth-clients/${id}`, { method: 'DELETE' });
  },
  async getSandboxConnection() {
    return request<ApiEnvelope<{ environment: string; baseUrl: string; hasActiveKey: boolean; keys: ApiKey[] }>>(
      '/api-keys/sandbox/connection',
    );
  },
  async provisionSandboxKey() {
    return request<ApiEnvelope<ApiKey>>('/api-keys/sandbox/provision', { method: 'POST' });
  },
  async listBulkJobs() {
    return request<ApiEnvelope<BulkJob[]>>('/bulk/jobs');
  },
  async createBulkJob(payload: { fileName: string; rowsTotal?: number; identifiers?: string[] }) {
    return request('/bulk/jobs', { method: 'POST', body: JSON.stringify(payload) });
  },
  async getBulkJobItems(id: string) {
    return request(`/bulk/jobs/${id}/items`);
  },
  async retryBulkFailures(id: string) {
    return request(`/bulk/jobs/${id}/retry-failures`, { method: 'POST' });
  },
  getBulkCsvUrl(id: string) {
    return `${API_BASE_URL}/bulk/jobs/${id}/download`;
  },
  async getMe() {
    return request('/users/me');
  },
  async updateUser(id: string, payload: { fullName?: string; email?: string; role?: string; isActive?: boolean }) {
    return request(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
  },
  async getTenantById(id: string) {
    return request(`/tenants/${id}`);
  },
  async getFinancialSnapshot(orgNumber: string) {
    return request('/bolagsverket/financial-snapshot', {
      method: 'POST',
      body: JSON.stringify({ identitetsbeteckning: orgNumber }),
    });
  },
  async getFinancialReports(orgNumber: string, fromdatum?: string, tomdatum?: string) {
    return request('/bolagsverket/financial-reports', {
      method: 'POST',
      body: JSON.stringify({ identitetsbeteckning: orgNumber, fromdatum, tomdatum }),
    });
  },

  async getCompanyServingOverview(orgNumber: string) {
    return request<CompanyOverviewServing | null>(`/company-serving/${encodeURIComponent(orgNumber)}/overview`);
  },
  async getCompanyServingBundle(orgNumber: string) {
    return request<CompanyServingBundle>(`/company-serving/${encodeURIComponent(orgNumber)}/bundle`);
  },
  async getCompanyServingOfficers(orgNumber: string) {
    return request<CompanyOfficerServing[]>(`/company-serving/${encodeURIComponent(orgNumber)}/officers`);
  },
  async getCompanyServingFinancialReports(orgNumber: string) {
    return request<CompanyFiReportServing[]>(`/company-serving/${encodeURIComponent(orgNumber)}/financial-reports`);
  },
  async getCompanyServingDocuments(orgNumber: string) {
    return request<CompanyHvdDocumentServing[]>(`/company-serving/${encodeURIComponent(orgNumber)}/documents`);
  },
  async getCompanyServingFiCases(orgNumber: string) {
    return request<CompanyFiCaseServing[]>(`/company-serving/${encodeURIComponent(orgNumber)}/fi-cases`);
  },
  async getCompanyServingShareCapital(orgNumber: string) {
    return request<CompanyShareCapitalServing | null>(`/company-serving/${encodeURIComponent(orgNumber)}/share-capital`);
  },
  async getCompanyServingEngagements(orgNumber: string) {
    return request<CompanyEngagementServing[]>(`/company-serving/${encodeURIComponent(orgNumber)}/engagements`);
  },
  async getCompanyServingVerkligaHuvudman(orgNumber: string) {
    return request<CompanyVerkligaHuvudmanServing | null>(
      `/company-serving/${encodeURIComponent(orgNumber)}/verkliga-huvudman`,
    );
  },

  async ingestHvdAnnualReport(identitetsbeteckning: string, dokumentId: string) {
    return request<IngestHvdAnnualReportResult>('/annual-reports/ingest-hvd-dokument', {
      method: 'POST',
      body: JSON.stringify({ identitetsbeteckning, dokumentId }),
    });
  },
  async getAnnualReportFinancialComparison(orgNumber: string, opts?: { maxYears?: number }) {
    const q =
      opts?.maxYears != null && Number.isFinite(opts.maxYears)
        ? `?maxYears=${encodeURIComponent(String(opts.maxYears))}`
        : '';
    return request<AnnualReportFinancialComparison>(
      `/annual-reports/companies/${encodeURIComponent(orgNumber)}/financial-comparison${q}`,
    );
  },
  async getAnnualReportHistory(orgNumber: string) {
    return request<{ organisationNumber: string; headers: CompanyAnnualReportHeader[] }>(
      `/annual-reports/companies/${encodeURIComponent(orgNumber)}/history`,
    );
  },
  async getAnnualReportWorkspaceReadModel(orgNumber: string) {
    return request<AnnualReportWorkspaceReadModel>(
      `/annual-reports/companies/${encodeURIComponent(orgNumber)}/workspace-read-model`,
    );
  },
  async createCompanyLookup(payload: { identitetsbeteckning: string; force_refresh?: boolean }) {
    return request('/company-lookups', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  async getCompanyLookupStatus(lookupRequestId: string) {
    return request(`/company-lookups/${encodeURIComponent(lookupRequestId)}/status`);
  },
  async listMonitoringSubscriptions() {
    return request<MonitoringSubscription[]>('/monitoring/subscriptions');
  },
  async createMonitoringSubscription(payload: CreateMonitoringSubscriptionPayload) {
    return request<MonitoringSubscription>('/monitoring/subscriptions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  async listMonitoringAlerts() {
    return request<MonitoringAlert[]>('/monitoring/alerts');
  },
  async listMonitoringGroupedFeed(limit = 100) {
    return request<MonitoringGroupedFeedRow[]>(
      `/monitoring/alerts/feed-grouped?limit=${encodeURIComponent(String(limit))}`,
    );
  },
  async acknowledgeMonitoringAlert(id: string) {
    return request<MonitoringAlert>(`/monitoring/${encodeURIComponent(id)}/acknowledge`, {
      method: 'PATCH',
    });
  },
  async detectMonitoringChanges(lookbackHours = 24) {
    return request<{
      scanned_subscriptions: number;
      created_alerts: number;
      lookback_hours: number;
      triggered_event_types: string[];
    }>(`/monitoring/detect-changes?lookbackHours=${encodeURIComponent(String(lookbackHours))}`, {
      method: 'POST',
    });
  },
  async listTargetLists() {
    return request<TargetList[]>('/target-lists');
  },
  async createTargetList(name: string) {
    return request<TargetList>('/target-lists', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },
  async deleteTargetList(id: string) {
    return request<{ id: string; deleted: boolean }>(`/target-lists/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },
  async addTargetListItem(id: string, organisationNumber: string) {
    return request(`/target-lists/${encodeURIComponent(id)}/items`, {
      method: 'POST',
      body: JSON.stringify({ organisationNumber }),
    });
  },
  async removeTargetListItem(id: string, organisationNumber: string) {
    return request(`/target-lists/${encodeURIComponent(id)}/items/${encodeURIComponent(organisationNumber)}`, {
      method: 'DELETE',
    });
  },
  async addTargetListItemsBulk(
    id: string,
    organisationNumbers: string[],
    dealMode?: 'founder_exit' | 'distressed' | 'roll_up',
  ) {
    return request<{ added: number; skipped: number; items: unknown[] }>(
      `/target-lists/${encodeURIComponent(id)}/items/bulk`,
      { method: 'POST', body: JSON.stringify({ organisationNumbers, dealMode }) },
    );
  },
  async updateTargetListPlaybook(
    id: string,
    payload: { dealMode?: 'founder_exit' | 'distressed' | 'roll_up'; thesis?: string },
  ) {
    return request(`/target-lists/${encodeURIComponent(id)}/playbook`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  async getOwnershipGraph(orgNumber: string) {
    return request(`/ownership/graph/${encodeURIComponent(orgNumber)}`);
  },
  async getAdvancedOwnershipInsights(orgNumber: string) {
    return request(`/ownership/advanced/${encodeURIComponent(orgNumber)}`);
  },
  async precomputeAdvancedOwnershipInsights(orgNumber: string) {
    return request(`/ownership/advanced/${encodeURIComponent(orgNumber)}/precompute`, {
      method: 'POST',
    });
  },
  async getBulkOpsDashboard(filters?: {
    weekStart?: string;
    tenantId?: string;
    planCode?: string;
    tenantPage?: number;
    tenantLimit?: number;
  }) {
    const q = new URLSearchParams();
    if (filters?.weekStart) q.set('week_start', filters.weekStart);
    if (filters?.tenantId) q.set('tenant_id', filters.tenantId);
    if (filters?.planCode) q.set('plan_code', filters.planCode);
    if (filters?.tenantPage) q.set('tenant_page', String(filters.tenantPage));
    if (filters?.tenantLimit) q.set('tenant_limit', String(filters.tenantLimit));
    return request<{
      weekly_run: {
        this_week_runs: number;
        this_week_status: string;
        parser_profile_used: string;
        latest_run: {
          id: string;
          downloadedAt: string;
          rowCount: number;
          status: string;
          errorMessage?: string | null;
        } | null;
        row_deltas: { new: number; updated: number; removed: number };
        failed_lines: number;
        checkpoint_progress: {
          completedCheckpoints: number;
          lastCheckpointSeq: number;
          lastLineNumber: number;
          rowsWritten: number;
          stagingWritten: number;
        };
        health_score: {
          score: number;
          color: 'green' | 'yellow' | 'red';
          reasons: string[];
        };
      };
      customer_usage: {
        tenants_total: number;
        page: number;
        limit: number;
        has_next: boolean;
        by_tenant: Array<{
          tenantId: string;
          tenantName: string;
          planCode: string;
          users: number;
          companies: number;
          apiCalls30d: number;
          includedCallsPerDay: number;
          packageUtilizationPct: number;
        }>;
      };
      charts: {
        package_utilization_series: Array<{
          tenantId: string;
          tenantName: string;
          utilizationPct: number;
        }>;
        run_health_series: Array<{
          runId: string;
          downloadedAt: string;
          status: string;
          score: number;
        }>;
        api_calls_30d_daily: Array<{
          day: string;
          apiCalls: number;
        }>;
      };
      weekly_runs_recent: Array<{
        id: string;
        downloadedAt: string;
        rowCount: number;
        status: string;
      }>;
    }>(`/bolagsverket-bulk/ops/dashboard${q.toString() ? `?${q.toString()}` : ''}`);
  },
  async getBulkRunFiles(runId: string) {
    return request<{
      runId: string;
      zip: { objectKey: string; url: string; expiresInSeconds: number };
      txt: { objectKey: string; url: string; expiresInSeconds: number };
    }>(`/bolagsverket-bulk/runs/${encodeURIComponent(runId)}/files`);
  },
  async getBulkRuntimeSafety() {
    return request<{
      status: 'ok' | 'warning';
      checkedAt: string;
      redis: {
        maxmemoryPolicy: string | null;
        expectedPolicy: string;
        safeForBullQueues: boolean;
        error: string | null;
      };
      bulkIngestionSafety: {
        batchSize: number;
        maxTxtBytes: number;
        yieldEveryLines: number;
        baseChunkPauseMs: number;
        autoThrottleEnabled: boolean;
        autoThrottleMaxPauseMs: number;
        autoThrottleMemWarnMb: number;
        autoThrottleMemHardMb: number;
        autoThrottleLagWarnMs: number;
        autoThrottleLagHardMs: number;
        queueConcurrency: number;
      };
      warnings: string[];
    }>('/bolagsverket-bulk/ops/runtime-safety');
  },
  async exportBulkOpsCsv(
    type: 'tenant_usage' | 'run_deltas',
    filters?: { weekStart?: string; tenantId?: string; planCode?: string },
  ) {
    const q = new URLSearchParams({ type });
    if (filters?.weekStart) q.set('week_start', filters.weekStart);
    if (filters?.tenantId) q.set('tenant_id', filters.tenantId);
    if (filters?.planCode) q.set('plan_code', filters.planCode);
    return requestText(`/bolagsverket-bulk/ops/dashboard/export.csv?${q.toString()}`);
  },
  async forceBulkRunNow(sourceUrl?: string) {
    return request('/bolagsverket-bulk/runs/force', {
      method: 'POST',
      body: JSON.stringify(sourceUrl ? { sourceUrl } : {}),
    });
  },
  async replayBulkRun(runId: string) {
    return request(`/bolagsverket-bulk/runs/${encodeURIComponent(runId)}/replay`, {
      method: 'POST',
    });
  },
};
