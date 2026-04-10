export interface SourceFetchState<T> {
  data: T | null;
  error: string | null;
  ok: boolean;
}

export type HvdOrganisationResponse = Record<string, unknown>;
export type HvdDocumentListResponse = Record<string, unknown>;
export interface HvdDocumentDownloadResponse {
  fileName: string;
  blob: Blob;
}

export type FiOrganisationResponse = Record<string, unknown>;
export type FiPersonResponse = Record<string, unknown>;
export type FiSignatoryAlternativesResponse = Record<string, unknown>;
export type FiCasesResponse = Record<string, unknown>;
export type FiShareCapitalChangesResponse = Record<string, unknown>;
export type FiOrganisationEngagementsResponse = Record<string, unknown>;
export type FiFinancialReportsResponse = Record<string, unknown>;
