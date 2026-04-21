import { getAccessToken } from '@/lib/auth';
import { API_V1_BASE_URL } from '@/lib/api-base-url';
import { api, ApiError } from '@/lib/api';
import { normalizeIdentitetsbeteckning } from '@/lib/org-number';
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

function normalizeBolagsverketPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const out = { ...payload };
  const idKeys = ['identitetsbeteckning', 'organisationIdentitetsbeteckning', 'funktionarIdentitetsbeteckning'] as const;
  for (const k of idKeys) {
    const v = out[k];
    if (typeof v === 'string') out[k] = normalizeIdentitetsbeteckning(v);
  }
  return out;
}

async function postJson<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(`${API_V1_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(normalizeBolagsverketPayload(payload)),
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
    return postJson<HvdOrganisationResponse>('/bolagsverket/hvd/organisationer', payload);
  },
  async hvdGetDocumentList(payload: { identitetsbeteckning: string; namnskyddslopnummer?: string }) {
    return postJson<HvdDocumentListResponse>('/bolagsverket/hvd/dokumentlista', payload);
  },
  /** Pass only dokumentId from hvdGetDocumentList rows (same value as Bolagsverket GET …/v1/dokument/{id}). */
  async hvdDownloadDocument(dokumentId: string): Promise<HvdDocumentDownloadResponse> {
    const id = dokumentId?.trim();
    if (!id) {
      throw new ApiError('Missing dokumentId (use an id from dokumentlista only)', 400);
    }
    const token = getAccessToken();
    const pathSeg = encodeURIComponent(id);
    const res = await fetch(`${API_V1_BASE_URL}/bolagsverket/hvd/dokument/${pathSeg}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      throw new ApiError('Failed to download HVD document', res.status);
    }
    const disposition = res.headers.get('content-disposition') ?? '';
    const fileNameMatch = disposition.match(/filename="(.+)"/);
    const fileName = fileNameMatch?.[1] ?? `${id}.zip`;
    return { fileName, blob: await res.blob() };
  },
};

export const fiClient = {
  async fiIsAlive() {
    return api.healthFi();
  },
  async fiGetOrganisation(payload: { identitetsbeteckning: string; informationCategories?: string[]; tidpunkt?: string; namnskyddslopnummer?: string }) {
    return postJson<FiOrganisationResponse>('/bolagsverket/fi/organisationer', payload);
  },
  async fiGetPerson(payload: { identitetsbeteckning: string; personInformationsmangd?: string[] }) {
    return postJson<FiPersonResponse>('/bolagsverket/fi/personer', payload);
  },
  async fiGetSignatoryAlternatives(payload: { funktionarIdentitetsbeteckning: string; organisationIdentitetsbeteckning: string }) {
    return postJson<FiSignatoryAlternativesResponse>('/bolagsverket/fi/firmateckningsalternativ', payload);
  },
  async fiGetCases(payload: { arendenummer?: string; organisationIdentitetsbeteckning?: string; fromdatum?: string; tomdatum?: string }) {
    return postJson<FiCasesResponse>('/bolagsverket/fi/arenden', payload);
  },
  async fiGetShareCapitalChanges(payload: { identitetsbeteckning: string; fromdatum?: string; tomdatum?: string }) {
    return postJson<FiShareCapitalChangesResponse>('/bolagsverket/fi/aktiekapitalforandringar', payload);
  },
  async fiGetOrganisationEngagements(payload: { identitetsbeteckning: string; paginering?: { sida: number; antalPerSida: number } }) {
    return postJson<FiOrganisationEngagementsResponse>('/bolagsverket/fi/organisationsengagemang', payload);
  },
  async fiGetFinancialReports(payload: { identitetsbeteckning: string; fromdatum?: string; tomdatum?: string }) {
    return postJson<FiFinancialReportsResponse>('/bolagsverket/fi/finansiella-rapporter', payload);
  },
};

/** Verkliga huvudmän — separate Bolagsverket product; same app JWT, backend uses FI-class OAuth to upstream. */
export const vhClient = {
  async vhIsAlive() {
    return api.healthVh();
  },
  async vhGetRegister(payload: { identitetsbeteckning: string }) {
    return postJson<Record<string, unknown>>('/bolagsverket/vh/organisationer', payload);
  },
};
