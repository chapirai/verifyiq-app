import { getAccessToken } from '@/lib/auth';
import { api, ApiError } from '@/lib/api';
import type {
  FiCasesResponse,
  FiFinancialReportsResponse,
  FiOrganisationEngagementsResponse,
  FiOrganisationResponse,
  FiPersonResponse,
  FiShareCapitalChangesResponse,
  FiSignatoryAlternativesResponse,
  HvdDocumentDownloadResponse,
  HvdDocumentListResponse,
  HvdOrganisationResponse,
} from '@/types/source-data';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api/v1';

async function postJson<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(text || 'Request failed', res.status, text);
  }
  return (await res.json()) as T;
}

export const hvdClient = {
  async hvdIsAlive() {
    return api.healthHvd();
  },
  async hvdGetOrganisation(payload: { identitetsbeteckning: string; namnskyddslopnummer?: string; informationCategories?: string[] }) {
    return postJson<HvdOrganisationResponse>('/bolagsverket/company', payload);
  },
  async hvdGetDocumentList(payload: { identitetsbeteckning: string; namnskyddslopnummer?: string }) {
    return postJson<HvdDocumentListResponse>('/bolagsverket/documents', payload);
  },
  async hvdDownloadDocument(dokumentId: string): Promise<HvdDocumentDownloadResponse> {
    const token = getAccessToken();
    const res = await fetch(`${API_BASE_URL}/bolagsverket/documents/${encodeURIComponent(dokumentId)}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      throw new ApiError('Failed to download HVD document', res.status);
    }
    const disposition = res.headers.get('content-disposition') ?? '';
    const fileNameMatch = disposition.match(/filename="(.+)"/);
    const fileName = fileNameMatch?.[1] ?? `${dokumentId}.zip`;
    return { fileName, blob: await res.blob() };
  },
};

export const fiClient = {
  async fiIsAlive() {
    return api.healthFi();
  },
  async fiGetOrganisation(payload: { identitetsbeteckning: string; informationCategories?: string[]; tidpunkt?: string; namnskyddslopnummer?: string }) {
    return postJson<FiOrganisationResponse>('/bolagsverket/company-information', payload);
  },
  async fiGetPerson(payload: { identitetsbeteckning: string; informationCategories?: string[] }) {
    return postJson<FiPersonResponse>('/bolagsverket/officers', payload);
  },
  async fiGetSignatoryAlternatives(payload: { funktionarIdentitetsbeteckning: string; organisationIdentitetsbeteckning: string }) {
    return postJson<FiSignatoryAlternativesResponse>('/bolagsverket/signatory-power', payload);
  },
  async fiGetCases(payload: { arendenummer?: string; organisationIdentitetsbeteckning?: string; fromdatum?: string; tomdatum?: string }) {
    return postJson<FiCasesResponse>('/bolagsverket/cases', payload);
  },
  async fiGetShareCapitalChanges(payload: { identitetsbeteckning: string; fromdatum?: string; tomdatum?: string }) {
    return postJson<FiShareCapitalChangesResponse>('/bolagsverket/share-capital-history', payload);
  },
  async fiGetOrganisationEngagements(payload: { identitetsbeteckning: string; paginering?: { sida: number; antalPerSida: number } }) {
    return postJson<FiOrganisationEngagementsResponse>('/bolagsverket/engagements', payload);
  },
  async fiGetFinancialReports(payload: { identitetsbeteckning: string; fromdatum?: string; tomdatum?: string }) {
    return postJson<FiFinancialReportsResponse>('/bolagsverket/financial-reports', payload);
  },
};
