export interface ApiEnvelope<T> {
  data: T;
}

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  tenantId: string;
  fullName: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface BillingPlan {
  code: string;
  name: string;
  monthlyPriceCents: number;
  currency: string;
  isActive: boolean;
}

export interface ApiKey {
  id: string;
  name: string;
  createdAt: string;
  revokedAt: string | null;
  environment?: 'live' | 'sandbox';
  key?: string;
}

export interface OauthClient {
  id: string;
  name: string;
  clientId: string;
  environment: 'live' | 'sandbox';
  scopes: string[];
  createdAt: string;
  revokedAt: string | null;
  clientSecret?: string;
}

export interface BulkJob {
  id: string;
  status: string;
  fileName: string;
  rowsTotal: number;
  rowsProcessed: number;
  failedCount: number;
  successCount: number;
  createdAt: string;
}

export interface CompanyListResponse {
  data: Array<{
    id: string;
    organisationNumber: string;
    legalName: string;
    status: string;
    companyForm?: string | null;
    updatedAt: string;
    ownershipRiskScore?: number;
    dealMode?: 'founder_exit' | 'distressed' | 'roll_up' | null;
    dealModeScore?: number | null;
  }>;
  total: number;
  page: number;
  limit: number;
  has_next: boolean;
  perf?: {
    elapsed_ms: number;
    cache_hit: boolean;
  };
}
