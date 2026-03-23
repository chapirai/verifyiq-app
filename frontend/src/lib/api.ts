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

export interface CompanyLookupPayload {
  identitetsbeteckning: string;
  organisationInformationsmangd?: string[];
}

export const api = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await httpClient.post<LoginResponse>('/auth/login', { email, password });
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

  async lookupCompany(payload: CompanyLookupPayload) {
    const response = await httpClient.post('/companies/lookup', payload);
    return response.data;
  },

  async listCompanies() {
    const response = await httpClient.get('/companies');
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
};
