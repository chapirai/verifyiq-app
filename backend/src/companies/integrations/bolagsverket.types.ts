// ─────────────────────────────────────────────────────────────────────────────
// Bolagsverket API TypeScript type definitions
// Covers both APIs:
//   • https://gw.api.bolagsverket.se/vardefulla-datamangder/v1
//   • https://gw.api.bolagsverket.se/foretagsinformation/v4
// ─────────────────────────────────────────────────────────────────────────────

// ── Shared primitives ────────────────────────────────────────────────────────

export type JaNej = 'JA' | 'NEJ';
export type SortOrder = 'ASC' | 'DESC';
export type SortAttributeEngagemang = 'ORGANISATIONSFORM' | 'REGISTRERINGSTIDPUNKT';

// ── OAuth (Värdefulla datamängder) ───────────────────────────────────────────

export interface OAuthTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in: number;
  scope?: string;
}

/** A "fel" field indicates that data from a specific source is unavailable. */
export interface BvFel {
  typ?: string;
  felBeskrivning?: string;
}

/** Wrapper that pairs a data value with an optional error indicator. */
export interface BvDataField<T> {
  data?: T;
  fel?: BvFel;
}

// ── Information categories ───────────────────────────────────────────────────

export const ALL_INFORMATION_CATEGORIES = [
  'AKTIEINFORMATION',
  'FIRMATECKNING',
  'FUNKTIONARER',
  'HEMVISTKOMMUN',
  'KOMMUNORGANISATIONSADRESSER',
  'ORGANISATIONSDATUM',
  'ORGANISATIONSENGAGEMANG',
  'RAKENSKAPSÅR',
  'SAMTLIGA_ORGANISATIONSNAMN',
  'TILLSTAND',
  'VERKSAMHETSBESKRIVNING',
  'ÖVRIG_ORGANISATIONSINFORMATION',
  'ORGANISATIONSMARKERINGAR',
  'BESTÄMMELSER',
  'VAKANSER_OCH_UPPLYSNINGAR',
  'EKONOMISK_PLAN',
  'UTLÄNDSK_FILIALÄGANDEORGANISATION',
  'FINANSIELLA_RAPPORTER',
] as const;

export type InformationCategory = (typeof ALL_INFORMATION_CATEGORIES)[number];

// ── High-value dataset (vardefulla-datamangder/v1) ───────────────────────────

/** Generic KodKlartext shape as returned by the Bolagsverket HVD API. */
export interface HvdKodKlartext {
  kod?: string;
  klartext?: string;
  dataproducent?: string;
  fel?: BvFel;
}

export interface HvdAddress {
  gatuadress?: string;
  postnummer?: string;
  postort?: string;
  land?: string;
  adresstyp?: string;
  fel?: BvFel;
}

export interface HvdOrganisationStatus {
  /** Can be a plain string or a KodKlartext object depending on API version. */
  status?: string | HvdKodKlartext;
  statusdatum?: string;
  fel?: BvFel;
}

export interface HvdRestructuringStatus {
  rekonstruktionsstatus?: string;
  rekonstruktionsdatum?: string;
  fel?: BvFel;
}

export interface HvdDeregistrationInfo {
  avregistreringsdatum?: string;
  /** Can be a plain string or a KodKlartext object. */
  avregistreringsorsak?: string | HvdKodKlartext;
  fel?: BvFel;
}

export interface HvdIndustryCode {
  snikod?: string;
  snikodText?: string;
  fel?: BvFel;
}

export interface HvdOrganisationsnamn {
  namn?: string;
  namnstyp?: string;
  sprak?: string;
  registreringsdatum?: string;
  avregistreringsdatum?: string;
  fel?: BvFel;
}

export interface HvdOrganisation {
  identitetsbeteckning?: string;
  namn?: string;
  /** List of all registered names (current + historical). */
  organisationsnamnLista?: HvdOrganisationsnamn[];
  /** KodKlartext: { kod, klartext, dataproducent, fel } */
  organisationsform?: string | HvdKodKlartext;
  /** Date wrapper: { registreringsdatum, infortHosScb, dataproducent, fel } or plain date string. */
  organisationsdatum?: string | HvdOrganisationsdatum;
  registreringsdatum?: string;
  organisationsstatusar?: HvdOrganisationStatus[];
  /** KodKlartext: { kod, klartext, dataproducent, fel } */
  juridiskForm?: string | HvdKodKlartext;
  adresser?: HvdAddress[];
  /** Postal address for organisation. */
  postadressOrganisation?: HvdAddress;
  snikoder?: HvdIndustryCode[];
  /** Activity description wrapper: { beskrivning, dataproducent, fel } or plain string. */
  verksamhetsbeskrivning?: string | { beskrivning?: string; text?: string; dataproducent?: string; fel?: BvFel };
  avregistreringsinformation?: HvdDeregistrationInfo;
  /** Deregistration wrapper: { avregistreringsdatum, dataproducent, fel } or plain string. */
  avregistreradOrganisation?: string | { avregistreringsdatum?: string; dataproducent?: string; fel?: BvFel };
  rekonstruktionsstatus?: HvdRestructuringStatus;
  /** Active status: { kod: 'JA'|'NEJ', dataproducent, fel } or plain string. */
  verksamOrganisation?: string | HvdKodKlartext;
  /** Country of registration: KodKlartext { kod, klartext } or plain string. */
  registreringsland?: string | HvdKodKlartext;
  /** External identity: { identitetsbeteckning, typ: KodKlartext } or plain string. */
  organisationsidentitet?: string | { identitetsbeteckning?: string; typ?: HvdKodKlartext };
  /** Marketing opt-out: { kod: 'JA'|'NEJ', dataproducent, fel } or plain string. */
  reklamsparr?: string | HvdKodKlartext;
  /** Winding-up / restructuring proceedings: complex list wrapper or plain string. */
  pagaendeAvvecklingsEllerOmstruktureringsforfarande?: string | Record<string, unknown>;
  fel?: BvFel;
}

export interface HighValueDatasetResponse {
  organisation?: HvdOrganisation;
  organisationer?: HvdOrganisation[];
  fel?: BvFel;
}

// ── Document list (vardefulla-datamangder/v1/dokumentlista) ─────────────────

export interface BvDokument {
  dokumentId?: string;
  filformat?: string;
  rapporteringsperiodTom?: string;
  registreringstidpunkt?: string;
  dokumenttyp?: string;
  fel?: BvFel;
}

export interface DocumentListResponse {
  dokument?: BvDokument[];
  fel?: BvFel;
}

// ── Organisation information (foretagsinformation/v4) ────────────────────────

export interface BvOfficerRole {
  rollkod?: string;
  rollbeskrivning?: string;
  rollstatus?: string;
  fran?: string;
  tom?: string;
}

export interface BvOfficer {
  namn?: string;
  personId?: string;
  identitetsbeteckning?: string;
  roller?: BvOfficerRole[];
  fodelseAr?: string;
  nationalitet?: string;
  adress?: HvdAddress;
  fel?: BvFel;
}

export interface BvFirmateckning {
  text?: string;
  firmateckningstyp?: string;
  firmateckningsregel?: string;
  registreringsdatum?: string;
  fel?: BvFel;
}

export interface BvAktieslag {
  aktieslagsnamn?: string;
  antalAktier?: number;
  kvotvarde?: number;
  aktiekapital?: number;
  rostvarde?: number;
  fel?: BvFel;
}

export interface BvAktieinformation {
  aktiekapital?: number;
  antalAktier?: number;
  kvotvarde?: number;
  aktieslag?: BvAktieslag[];
  aktiekapitalMax?: number;
  aktiekapitalMin?: number;
  antalAktierMax?: number;
  antalAktierMin?: number;
  registreringsdatum?: string;
  fel?: BvFel;
}

export interface BvRakenskapsAr {
  rakenskapsarInleds?: string;
  rakenskapsarAvslutas?: string;
  forstaRakenskapsarInleds?: string;
  forstaRakenskapsarAvslutas?: string;
  fel?: BvFel;
}

export interface BvOrganisationsnamn {
  namn?: string;
  namnstyp?: string;
  sprak?: string;
  registreringsdatum?: string;
  avregistreringsdatum?: string;
  fel?: BvFel;
}

export interface BvTillstand {
  tillstandstyp?: string;
  tillstandsnummer?: string;
  tillstandsstatus?: string;
  beviljatDatum?: string;
  giltigFran?: string;
  giltigTom?: string;
  utfardareNamn?: string;
  fel?: BvFel;
}

export interface BvVerksamhetsbeskrivning {
  text?: string;
  sprak?: string;
  registreringsdatum?: string;
  fel?: BvFel;
}

export interface BvBestammelse {
  bestammelsetyp?: string;
  text?: string;
  registreringsdatum?: string;
  fel?: BvFel;
}

export interface BvVakansUpplysning {
  typ?: string;
  text?: string;
  registreringsdatum?: string;
  fel?: BvFel;
}

export interface BvEkonomiskPlan {
  plantyp?: string;
  godkandDatum?: string;
  registreringsdatum?: string;
  fel?: BvFel;
}

export interface BvUtlandskFilial {
  utlandskOrganisationNamn?: string;
  utlandskOrganisationIdentitetsbeteckning?: string;
  utlandskOrganisationLand?: string;
  fel?: BvFel;
}

export interface BvFinansiellRapport {
  rapporttyp?: string;
  rapporteringsperiodFran?: string;
  rapporteringsperiodTom?: string;
  registreringsdatum?: string;
  dokumentId?: string;
  fel?: BvFel;
}

export interface BvOrganisationsmarkering {
  markeringstyp?: string;
  markeringsdatum?: string;
  text?: string;
  fel?: BvFel;
}

/** Företagsinformation v4: status entry is a KodKlartextDatum = { kod, klartext, typ, datum }. */
export interface V4OrganisationStatus {
  /** Status code. */
  kod?: string;
  /** Status label. */
  klartext?: string;
  /** Type qualifier (e.g. 'AvregistreradOrganisationstyp', 'AvvecklingsOmstruktureringsforfarande'). */
  typ?: string;
  /** Date the status was set. */
  datum?: string;
  /** HVD-compatible fallback (some datasets nest status text here). */
  status?: string | HvdKodKlartext;
  statusdatum?: string;
  fel?: BvFel;
}

/** Bolagsverket HVD date-of-establishment wrapper object. */
export interface HvdOrganisationsdatum {
  registreringsdatum?: string;
  infortHosScb?: string;
  dataproducent?: string;
  fel?: BvFel;
}

/** Företagsinformation v4 hemvistkommun. */
export interface V4Hemvistkommun {
  typ?: string;
  lanForHemvistkommun?: HvdKodKlartext;
  /** Municipality — the main displayable field. */
  kommun?: HvdKodKlartext;
  /** Legacy HVD field name (if ever present). */
  kommunnamn?: string;
  kommunkod?: string;
  fel?: BvFel;
}

export interface BvHemvistkommun {
  kommunnamn?: string;
  kommunkod?: string;
  fel?: BvFel;
}

export interface OrganisationInformationResponse {
  identitetsbeteckning?: string;
  namn?: string;
  /** KodKlartext object in v4 API: { kod, klartext }. */
  organisationsform?: string | HvdKodKlartext;
  /** Date wrapper in v4 API: { registreringsdatum, bildatDatum }. */
  organisationsdatum?: string | { registreringsdatum?: string; bildatDatum?: string };
  registreringsdatum?: string;
  /** v4 API: each entry IS a KodKlartextDatum { kod, klartext, typ, datum }. */
  organisationsstatusar?: V4OrganisationStatus[];
  funktionarer?: BvOfficer[];
  firmateckning?: BvFirmateckning | string;
  aktieinformation?: BvAktieinformation;
  rakenskapsAr?: BvRakenskapsAr;
  samtligaOrganisationsnamn?: BvOrganisationsnamn[];
  tillstand?: BvTillstand[];
  verksamhetsbeskrivning?: BvVerksamhetsbeskrivning | string;
  bestammelser?: BvBestammelse[];
  vakanserOchUpplysningar?: BvVakansUpplysning[];
  ekonomiskPlan?: BvEkonomiskPlan;
  utlandskFilialagandeOrganisation?: BvUtlandskFilial;
  finansiellaRapporter?: BvFinansiellRapport[];
  organisationsmarkeringar?: BvOrganisationsmarkering[];
  hemvistkommun?: BvHemvistkommun;
  adresser?: HvdAddress[];
  ovrigOrganisationsinformation?: Record<string, unknown>;
  fel?: BvFel;
}

// ── Arende (case) information ────────────────────────────────────────────────

export interface BvArendeAktor {
  aktortyp?: string;
  identitetsbeteckning?: string;
  namn?: string;
  roll?: string;
}

export interface BvSakfraga {
  sakfraganummer?: string;
  sakfragatyp?: string;
  sakfragestatus?: string;
  text?: string;
}

export interface BvArendesamband {
  sambandArendenummer?: string;
  sambandtyp?: string;
}

export interface BvArende {
  arendenummer?: string;
  arendeslag?: string;
  arendetyp?: string;
  arendestatus?: string;
  handlaggningsstatus?: string;
  registreradTidpunkt?: string;
  avslutatTidpunkt?: string;
  totalAvgift?: number;
  betaltBelopp?: number;
  arendeaktorer?: BvArendeAktor[];
  sakfragor?: BvSakfraga[];
  arendesamband?: BvArendesamband[];
  fel?: BvFel;
}

export type ArendeResponse = BvArende[];

// ── Signatory power (firmateckningsalternativ) ───────────────────────────────

export type Firmateckningsalternativ = 'ENSAM' | 'TILLSAMMANS' | 'LOPANDE' | 'FULLMAKT';

export interface BvFirmateckningsutfallJaSvar {
  firmateckningsregel?: string;
  ingaendeFunktionarer?: BvOfficer[];
}

export interface FirmateckningsalternativResponse {
  firmateckningsutfall?: JaNej;
  firmateckningsalternativ?: Firmateckningsalternativ;
  firmateckningsutfallJaSvar?: BvFirmateckningsutfallJaSvar;
  fel?: BvFel;
}

// ── Share capital history (aktiekapitalforandringar) ─────────────────────────

export interface BvAktiekapitalforandring {
  arende?: { arendenummer?: string; arendetyp?: string };
  aktieinformation?: BvAktieinformation;
  aktiekapitalforandring?: {
    forandringstyp?: string;
    belopp?: number;
    registreringsdatum?: string;
  };
  fel?: BvFel;
}

export interface AktiekapitalforandringResponse {
  gallandeAktieinformation?: BvAktieinformation;
  aktiekapitalforandringar?: BvAktiekapitalforandring[];
  fel?: BvFel;
}

// ── Organisation engagements (organisationsengagemang) ──────────────────────

export interface BvEngagemang {
  organisation?: {
    identitetsbeteckning?: string;
    namn?: string;
    organisationsform?: string;
    registreringsdatum?: string;
    organisationsstatusar?: HvdOrganisationStatus[];
  };
  funktionar?: {
    identitetsbeteckning?: string;
    namn?: string;
    roller?: BvOfficerRole[];
  };
  fel?: BvFel;
}

export interface OrganisationsengagemangResponse {
  totaltAntalTraffar?: number;
  funktionarsOrganisationsengagemang?: BvEngagemang[];
  fel?: BvFel;
}

// ── Financial reports ─────────────────────────────────────────────────────────

export interface FinansiellaRapporterResponse {
  finansiellaRapporter?: BvFinansiellRapport[];
  fel?: BvFel;
}

// ── Pagination / sorting ─────────────────────────────────────────────────────

export interface BvPaginering {
  sida: number;
  antalPerSida: number;
}

export interface BvSortering {
  sorteringsattribut: SortAttributeEngagemang;
  sorteringsordning: SortOrder;
}

export interface BvFiltrering {
  organisationsformer?: string[];
  statusar?: string[];
}

// ── Person information (foretagsinformation/v4/personer) ────────────────────

export interface BvPersonAdress {
  adresstyp?: string;
  utdelningsadress?: string;
  postnummer?: string;
  postort?: string;
  lan?: string;
  land?: string;
  fel?: BvFel;
}

export interface PersonInformationResponse {
  identitetsbeteckning?: string;
  namn?: string;
  fodelsedatum?: string;
  nationalitet?: string;
  adresser?: BvPersonAdress[];
  roller?: BvOfficerRole[];
  organisationsengagemang?: OrganisationsengagemangResponse;
  fel?: BvFel;
}

export type PersonResponse = PersonInformationResponse[];

// ── Generic API error body ───────────────────────────────────────────────────

export interface BvApiError {
  type?: string;
  instance?: string;
  status?: number;
  timestamp?: string;
  requestId?: string;
  title?: string;
  detail?: string;
  code?: string;
  source?: string;
}
