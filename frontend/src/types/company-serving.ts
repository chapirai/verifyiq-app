/** Typed read-model rows from GET /company-serving/… (bv_read physical tables). */

export interface CompanyOverviewServing {
  tenantId: string;
  organisationsnummer: string;
  organisationsnamn: string | null;
  organisationsformKlartext: string | null;
  organisationsdatumRegistreringsdatum: string | null;
  organisationsdatumBildatDatum: string | null;
  verksamhetsbeskrivning: string | null;
  hemvistKommunKlartext: string | null;
  hemvistLanKlartext: string | null;
  rakenskapsarInleds: string | null;
  rakenskapsarAvslutas: string | null;
  aktiekapitalBelopp: string | null;
  aktiekapitalValuta: string | null;
  antalAktier: string | null;
  verksamOrganisationKod: string | null;
  registreringslandKlartext: string | null;
  organisationsadressPostadress: string | null;
  organisationsadressPostnummer: string | null;
  organisationsadressPostort: string | null;
  organisationsadressEpost: string | null;
  firmateckningKlartext: string | null;
  antalValdaLedamoter: number | null;
  antalValdaSuppleanter: number | null;
  identitetTypKlartext: string | null;
  dataRefreshedAt: string | null;
}

export interface CompanyOfficerServing {
  tenantId: string;
  organisationsnummer: string;
  funktionarId: string;
  fiFunktionarRollId: string;
  fornamn: string | null;
  efternamn: string | null;
  identitetsbeteckning: string | null;
  postadressAdress: string | null;
  postadressPostnummer: string | null;
  postadressPostort: string | null;
  rollKod: string | null;
  rollKlartext: string | null;
  dataRefreshedAt: string | null;
}

export interface CompanyFiReportServing {
  tenantId: string;
  organisationsnummer: string;
  reportId: string;
  rapporttypKod: string | null;
  rapporttypKlartext: string | null;
  periodFrom: string | null;
  periodTom: string | null;
  ankomDatum: string | null;
  registreradDatum: string | null;
  innehallerKoncernredovisning: boolean | null;
  vinstutdelningBelopp: string | null;
  vinstutdelningValutaKod: string | null;
  vinstutdelningBeslutadDatum: string | null;
  dataRefreshedAt: string | null;
}

export interface CompanyHvdDocumentServing {
  tenantId: string;
  organisationsnummer: string;
  dokumentId: string;
  filformat: string | null;
  registreringstidpunkt: string | null;
  rapporteringsperiodTom: string | null;
  dataRefreshedAt: string | null;
}

export interface CompanyFiCaseServing {
  tenantId: string;
  organisationsnummer: string;
  arendeRank: number;
  arendenummer: string | null;
  avslutatTidpunkt: string | null;
  arendetyp: string | null;
  status: string | null;
  dataRefreshedAt: string | null;
}

export interface CompanyShareCapitalServing {
  tenantId: string;
  organisationsnummer: string;
  aktiekapitalBelopp: string | null;
  aktiekapitalValuta: string | null;
  antalAktier: string | null;
  kvotvardeBelopp: string | null;
  kvotvardeValuta: string | null;
  aktiekapitalGransLagst: string | null;
  aktiekapitalGransHogst: string | null;
  antalAktierGransLagst: string | null;
  antalAktierGransHogst: string | null;
  aktiegranserValuta: string | null;
  dataRefreshedAt: string | null;
}

export interface CompanyEngagementServing {
  tenantId: string;
  organisationsnummer: string;
  engagementRank: number;
  relatedOrganisationName: string | null;
  relatedOrganisationNumber: string | null;
  engagementTypeKod: string | null;
  engagementTypeKlartext: string | null;
  roleKod: string | null;
  roleKlartext: string | null;
  personOrOrganisationName: string | null;
  dataRefreshedAt: string | null;
}
