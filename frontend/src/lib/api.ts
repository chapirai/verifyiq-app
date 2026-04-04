import axios, { AxiosInstance } from 'axios';

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api/v1';

function readToken(key: string): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(key);
}

export const httpClient: AxiosInstance = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

httpClient.interceptors.request.use((config) => {
  const token = readToken('verifyiq_access_token');
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

httpClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (
      typeof window !== 'undefined' &&
      error.response?.status === 401 &&
      !original?._retry &&
      readToken('verifyiq_refresh_token')
    ) {
      original._retry = true;
      try {
        const refreshToken = readToken('verifyiq_refresh_token');
        const refreshResponse = await axios.post(`${baseURL}/auth/refresh`, { refreshToken });
        const nextAccessToken = refreshResponse.data.accessToken || '';
        localStorage.setItem('verifyiq_access_token', nextAccessToken);
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${nextAccessToken}`;
        return httpClient(original);
      } catch (refreshError) {
        localStorage.removeItem('verifyiq_access_token');
        localStorage.removeItem('verifyiq_refresh_token');
        throw refreshError;
      }
    }
    throw error;
  },
);

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user?: {
    id: string;
    email: string;
    role: string;
    tenantId: string;
  };
}

export interface CompanySearchResult {
  orgNumber: string;
  legalName: string | null;
  status: string | null;
  countryCode: string | null;
  fetchedAt: string | null;
}

export interface CompanyListItem {
  organisationNumber: string;
  legalName: string | null;
  status: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyListResponse {
  data: CompanyListItem[];
  total: number;
  page: number;
  limit: number;
  has_next: boolean;
}

export interface CompanySearchResponse {
  results: CompanySearchResult[];
  metadata: {
    total: number;
    page: number;
    limit: number;
  };
}

export interface CompanyLookupPayload {
  identitetsbeteckning: string;
  organisationInformationsmangd?: string[];
}

export interface CompanyLookupByOrgNumberPayload {
  orgNumber: string;
  force_refresh?: boolean;
}

export type FreshnessStatus = 'fresh' | 'stale' | 'expired';
export type LookupSource = 'DB' | 'API';
export type CompanyFreshnessStatus = 'fresh' | 'stale' | 'degraded';
export type CompanyCacheDecision =
  | 'served_from_cache'
  | 'served_stale'
  | 'fetched_from_provider'
  | 'unknown';

export interface CompanyMetadata {
  source: LookupSource;
  fetched_at: string;
  age_days: number;
  freshness: FreshnessStatus;
  cache_ttl_days: number;
  /** ID of the snapshot record that sourced this response. */
  snapshot_id: string;
  /** Request-scoped correlation ID for end-to-end lineage tracing. */
  correlation_id: string;
  /** Policy decision (cache_hit | fresh_fetch | force_refresh | stale_fallback). */
  policy_decision: string;
  /** True when stale fallback is used and the response is degraded. */
  degraded: boolean;
  /** Failure-state label when degraded. */
  failure_state: string | null;
}

export interface CompanyData {
  organisationNumber?: string;
  legalName?: string;
  companyForm?: string | null;
  status?: string | null;
  registeredAt?: string | null;
  countryCode?: string | null;
  businessDescription?: string | null;
  [key: string]: unknown;
}

export interface CompanyLookupResponse {
  company: CompanyData;
  metadata: CompanyMetadata;
}

export interface CompanyFreshnessMetadata {
  org_number: string;
  has_data: boolean;
  last_fetched_timestamp: string | null;
  freshness_status: CompanyFreshnessStatus;
  next_refresh_time: string | null;
  provider_name: string | null;
  endpoint_used: string | null;
  cache_decision: CompanyCacheDecision;
  policy_decision: string | null;
  snapshot_id: string | null;
}

export interface CompanySnapshotHistoryItem {
  id: string;
  fetched_at: string;
  fetch_status: string;
  policy_decision: string;
  trigger_type: string;
  is_from_cache: boolean;
  is_stale_fallback: boolean;
  api_call_count: number;
  source_name: string;
  version_number: number;
  correlation_id: string | null;
}

export interface CompanyChangeEvent {
  id: string;
  orgNumber: string;
  attributeName: string;
  oldValue: string | null;
  newValue: string | null;
  changeType: string;
  createdAt: string;
  snapshotIdAfter?: string | null;
  snapshotIdBefore?: string | null;
  correlationId?: string | null;
}

const defaultTenantSlug = process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG || 'demo-bank';

export const api = {
  async login(email: string, password: string, tenantSlug = defaultTenantSlug): Promise<LoginResponse> {
    let tenantId: string;
    try {
      const tenantResponse = await httpClient.get<{ id: string; name: string; slug: string }>(
        `/auth/tenant/${tenantSlug}`,
      );
      tenantId = tenantResponse.data.id;
    } catch {
      throw new Error(`Could not find tenant "${tenantSlug}". Please check your configuration.`);
    }
    const response = await httpClient.post<LoginResponse>('/auth/login', { tenantId, email, password });
    if (typeof window !== 'undefined') {
      localStorage.setItem('verifyiq_access_token', response.data.accessToken || '');
      localStorage.setItem('verifyiq_refresh_token', response.data.refreshToken || '');
      localStorage.setItem('verifyiq_user', JSON.stringify(response.data.user ?? null));
    }
    return response.data;
  },

  async logout() {
    const refreshToken = readToken('verifyiq_refresh_token');
    try {
      await httpClient.post('/auth/logout', { refreshToken });
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('verifyiq_access_token');
        localStorage.removeItem('verifyiq_refresh_token');
        localStorage.removeItem('verifyiq_user');
      }
    }
  },

  async lookupCompany(payload: CompanyLookupPayload): Promise<unknown> {
    const response = await httpClient.post('/companies/lookup', payload);
    return response.data;
  },

  async lookupCompanyByOrgNumber(
    payload: CompanyLookupByOrgNumberPayload,
  ): Promise<CompanyLookupResponse> {
    const response = await httpClient.post<CompanyLookupResponse>('/companies/lookup', payload);
    return response.data;
  },

  async getCompanyFreshness(orgNumber: string): Promise<CompanyFreshnessMetadata> {
    const response = await httpClient.get<CompanyFreshnessMetadata>(
      `/companies/${encodeURIComponent(orgNumber)}/freshness`,
    );
    return response.data;
  },

  async getCompanySnapshots(orgNumber: string, limit = 20): Promise<CompanySnapshotHistoryItem[]> {
    const response = await httpClient.get<CompanySnapshotHistoryItem[]>(
      `/companies/${encodeURIComponent(orgNumber)}/snapshots`,
      { params: { limit } },
    );
    return response.data;
  },

  async getChangeEventsByOrgNumber(orgNumber: string, limit = 10): Promise<CompanyChangeEvent[]> {
    const response = await httpClient.get<CompanyChangeEvent[]>(
      `/change-events/by-org/${encodeURIComponent(orgNumber)}`,
      { params: { limit } },
    );
    return response.data;
  },

  async listCompanies(): Promise<CompanyListResponse> {
    const response = await httpClient.get<CompanyListResponse>('/companies');
    return response.data;
  },

  async searchCompanies(q: string, page = 1, limit = 10): Promise<CompanySearchResponse> {
    const response = await httpClient.get<CompanySearchResponse>('/companies', {
      params: { q, page, limit },
    });
    return response.data;
  },

  async listOnboardingCases() {
    const response = await httpClient.get('/onboarding/cases');
    return response.data;
  },

  async listScreeningQueue() {
    const response = await httpClient.get('/screening/queue');
    return response.data;
  },

  async listMonitoringAlerts() {
    const response = await httpClient.get('/monitoring/alerts');
    return response.data;
  },

  bolagsverket: {
    async enrich(payload: { identitetsbeteckning: string; forceRefresh?: boolean }) {
      const response = await httpClient.post('/bolagsverket/enrich', payload);
      return response.data;
    },
    async enrichPerson(payload: { personnummer: string; forceRefresh?: boolean }) {
      const response = await httpClient.post('/bolagsverket/enrich/person', payload);
      return response.data;
    },
    async getSnapshots(orgNr: string) {
      const response = await httpClient.get(`/bolagsverket/snapshots?orgNr=${encodeURIComponent(orgNr)}`);
      return response.data;
    },
    async getStoredDocuments(orgNr: string) {
      const response = await httpClient.get(`/bolagsverket/stored-documents?orgNr=${encodeURIComponent(orgNr)}`);
      return response.data;
    },
    async company(orgNr: string) {
      const response = await httpClient.post('/bolagsverket/company', { identitetsbeteckning: orgNr });
      return response.data;
    },
    async documentList(orgNr: string) {
      const response = await httpClient.post('/bolagsverket/documents', { identitetsbeteckning: orgNr });
      return response.data;
    },
    async tokenCacheStatus() {
      const response = await httpClient.get('/bolagsverket/token-cache');
      return response.data as {
        entries: Array<{
          cacheKey: string;
          expiresAt: number;
          expiresInMs: number;
          scope?: string;
          tokenType?: string;
        }>;
        metrics: {
          cacheHits: number;
          cacheMisses: number;
          refreshes: number;
          requestFailures: number;
        };
      };
    },
    async healthCheck() {
      const response = await httpClient.get('/bolagsverket/health');
      return response.data as { status: string; latencyMs?: number };
    },
  },
};
