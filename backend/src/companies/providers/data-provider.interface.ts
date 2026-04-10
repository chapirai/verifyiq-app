import {
  AktiekapitalforandringResponse,
  ArendeResponse,
  BvDokumentListaRequest,
  DocumentListResponse,
  FinansiellaRapporterResponse,
  FirmateckningsalternativResponse,
  HighValueDatasetResponse,
  OrganisationInformationResponse,
  OrganisationsengagemangResponse,
  PersonResponse,
} from '../integrations/bolagsverket.types';

/** Shared request context for all provider calls. */
export interface ProviderRequestContext {
  tenantId?: string;
  actorId?: string | null;
  correlationId?: string | null;
}

/**
 * Provider abstraction that decouples the service layer from specific
 * external data sources (Bolagsverket, UC, Creditsafe, Bisnode, …).
 *
 * Any alternative provider must implement this interface so it can be
 * swapped in transparently.
 */
export interface DataProvider {
  /** Retrieve organisation information (v4 / HVD). */
  fetchOrganisation(
    identitetsbeteckning: string,
    context?: ProviderRequestContext,
  ): Promise<OrganisationInformationResponse[]>;

  /** Retrieve high-value dataset for an organisation. */
  fetchHighValueOrganisation(
    identitetsbeteckning: string,
    context?: ProviderRequestContext,
  ): Promise<HighValueDatasetResponse>;

  /** Retrieve person information by personal identity number. */
  fetchPerson(
    identitetsbeteckning: string,
    context?: ProviderRequestContext,
  ): Promise<PersonResponse>;

  /** Retrieve arende (case) information. */
  fetchCases(
    organisationIdentitetsbeteckning: string,
    fromdatum?: string,
    tomdatum?: string,
    context?: ProviderRequestContext,
  ): Promise<ArendeResponse>;

  /** Verify signatory power for a person/organisation pair. */
  fetchSignatoryOptions(
    funktionarIdentitetsbeteckning: string,
    organisationIdentitetsbeteckning: string,
    context?: ProviderRequestContext,
  ): Promise<FirmateckningsalternativResponse>;

  /** Retrieve share capital change history. */
  fetchShareCapitalChanges(
    identitetsbeteckning: string,
    fromdatum?: string,
    tomdatum?: string,
    context?: ProviderRequestContext,
  ): Promise<AktiekapitalforandringResponse>;

  /** Retrieve organisation engagements for a person/organisation. */
  fetchOrganisationEngagements(
    identitetsbeteckning: string,
    pageNumber?: number,
    pageSize?: number,
    context?: ProviderRequestContext,
  ): Promise<OrganisationsengagemangResponse>;

  /** Retrieve financial reports. */
  fetchFinancialReports(
    identitetsbeteckning: string,
    fromdatum?: string,
    tomdatum?: string,
    context?: ProviderRequestContext,
  ): Promise<FinansiellaRapporterResponse>;

  /** HVD step 1: POST …/dokumentlista — dokumentId list only. */
  fetchDocumentList(
    request: BvDokumentListaRequest,
    context?: ProviderRequestContext,
  ): Promise<DocumentListResponse>;

  /** Check if the provider's API is reachable. */
  isAlive(): Promise<{ status: string }>;
}
