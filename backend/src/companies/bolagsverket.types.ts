export interface BolagsverketOrganisationLookupRequest {
  identitetsbeteckning: string;
}

export interface BolagsverketOrganisationInformationRequest {
  identitetsbeteckning: string;
  organisationInformationsmangd: string[];
}

export interface BolagsverketOfficer {
  namn?: string;
  roll?: string;
  personId?: string;
}

export interface BolagsverketOrganisationStatus {
  status?: string;
  statusdatum?: string;
}

export interface BolagsverketOrganisationResponse {
  identitetsbeteckning?: string;
  namn?: string;
  organisationsform?: string;
  registreringsdatum?: string;
  verksamhetsbeskrivning?: string | { text?: string };
  funktionarer?: BolagsverketOfficer[];
  firmateckning?: string | { text?: string };
  aktieinformation?: Record<string, unknown>;
  organisationsstatusar?: BolagsverketOrganisationStatus[];
  finansiellaRapporter?: Array<Record<string, unknown>>;
}
