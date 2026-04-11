import { clearSession, getAccessToken, getRefreshToken, setSession } from '@/lib/auth';
import { API_V1_BASE_URL } from '@/lib/api-base-url';
import type { ApiEnvelope, ApiKey, AuthTokens, BillingPlan, BulkJob, CompanyListResponse } from '@/types/api';
import type {
  CompanyEngagementServing,
  CompanyFiCaseServing,
  CompanyFiReportServing,
  CompanyHvdDocumentServing,
  CompanyOfficerServing,
  CompanyOverviewServing,
  CompanyShareCapitalServing,
} from '@/types/company-serving';

const API_BASE_URL = API_V1_BASE_URL;

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
  const token = getAccessToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    let details: unknown = null;
    try {
      details = await res.json();
    } catch {
      details = await res.text();
    }

    if (res.status === 401) {
      clearSession();
    }

    const message = typeof details === 'object' && details && 'message' in details
      ? String((details as { message?: string }).message)
      : 'Request failed';
    throw new ApiError(message, res.status, details);
  }

  return (await res.json()) as T;
}

export const api = {
  async healthHvd() {
    return request('/bolagsverket/hvd/isalive');
  },
  async healthFi() {
    return request('/bolagsverket/fi/isalive');
  },
  async login(payload: { tenantId: string; email: string; password: string }) {
    const data = await request<AuthTokens>('/auth/login', { method: 'POST', body: JSON.stringify(payload) });
    setSession(data.accessToken, data.refreshToken, data.user);
    return data;
  },
  async signup(payload: {
    tenantSlug: string;
    tenantName: string;
    email: string;
    password: string;
    fullName: string;
  }) {
    const data = await request<AuthTokens>('/auth/signup', { method: 'POST', body: JSON.stringify(payload) });
    setSession(data.accessToken, data.refreshToken, data.user);
    return data;
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
  async revokeApiKey(id: string) {
    return request(`/api-keys/${id}`, { method: 'DELETE' });
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
  async createCompanyLookup(payload: { identitetsbeteckning: string; force_refresh?: boolean }) {
    return request('/company-lookups', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  async getCompanyLookupStatus(lookupRequestId: string) {
    return request(`/company-lookups/${encodeURIComponent(lookupRequestId)}/status`);
  },
};
