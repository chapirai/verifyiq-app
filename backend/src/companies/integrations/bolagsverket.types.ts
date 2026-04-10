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
  'ORGANISATIONSADRESSER',
  'ORGANISATIONSDATUM',
  'ORGANISATIONSENGAGEMANG',
  'RAKENSKAPSAR',
  'SAMTLIGA_ORGANISATIONSNAMN',
  'TILLSTAND',
  'VERKSAMHETSBESKRIVNING',
  'OVRIG_ORGANISATIONSINFORMATION',
  'ORGANISATIONSMARKERINGAR',
  'BESTAMMELSER',
  'VAKANSER_OCH_UPPLYSNINGAR',
  'EKONOMISK_PLAN',
  'UTLANDSK_FILIALAGANDE_ORGANISATION',
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
  /** Delivery/postal box address line, used instead of gatuadress for postal addresses. */
  utdelningsadress?: string;
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
  /** Some upstream payloads use PascalCase for this field. */
  DokumentId?: string;
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

/** Request body for POST …/vardefulla-datamangder/v1/dokumentlista */
export interface BvDokumentListaRequest {
  identitetsbeteckning: string;
  namnskyddslopnummer?: string;
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

/** Schema: aktieslag entry inside BvAktieinformation. */
export interface BvAktieslag {
  /** Schema: namn (was aktieslagsnamn). */
  namn?: string;
  /** Schema: antal (was antalAktier). */
  antal?: number;
  /** Schema: aktieslagGranser. */
  aktieslagGranser?: { lagst?: number; hogst?: number };
  /** Schema: kvotvarde as { belopp, valuta } object (was plain number). */
  kvotvarde?: { belopp?: number; valuta?: string } | number;
  /** Schema: rostvarde. */
  rostvarde?: string;
  /** Schema: fritext. */
  fritext?: string;
  /** Kept for backward compatibility. */
  aktieslagsnamn?: string;
  /** Kept for backward compatibility. */
  antalAktier?: number;
  /** Kept for backward compatibility. */
  aktiekapital?: number;
  fel?: BvFel;
}

/** Schema: aktieinformation block in OrganisationResponse and AktiekapitalforandringResponse. */
export interface BvAktieinformation {
  /** Schema: aktiekapital as { belopp, valuta } object. Plain number kept for backward compat. */
  aktiekapital?: { belopp?: number; valuta?: string } | number;
  /** Schema: antalAktier. */
  antalAktier?: number;
  /** Schema: aktiegranser — capital and share count limits. */
  aktiegranser?: {
    aktiekapitalGranser?: { lagst?: number; hogst?: number };
    antalAktierGranser?: { lagst?: number; hogst?: number };
    valuta?: string;
  };
  /** Schema: aktieslag array. */
  aktieslag?: BvAktieslag[];
  /** Schema: nedsattningPagar — capital reduction in progress. */
  nedsattningPagar?: boolean;
  /** Kept for backward compatibility. */
  kvotvarde?: number;
  /** Kept for backward compatibility. */
  aktiekapitalMax?: number;
  /** Kept for backward compatibility. */
  aktiekapitalMin?: number;
  /** Kept for backward compatibility. */
  antalAktierMax?: number;
  /** Kept for backward compatibility. */
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

/** Schema: arsredovisning entry inside finansiellaRapporter[].rakenskapsperioder[]. */
export interface BvArsredovisning {
  rapporteringsperiod?: { periodFrom?: string; periodTom?: string };
  rapporttyp?: HvdKodKlartext;
  ankomsttidpunkt?: string;
  registreradTidpunkt?: string;
  arsredovisningsinnehall?: HvdKodKlartext[];
  brister?: HvdKodKlartext[];
  handlaggningAvslutadDatum?: string;
  arsredovisningspaminnelse?: {
    skickadTidpunkt?: string;
    arsredovisningspaminnelsetyp?: HvdKodKlartext;
  };
  vinstutdelning?: {
    beslutadDatum?: string;
    valuta?: HvdKodKlartext;
    belopp?: number;
    vinstutdelningstyp?: HvdKodKlartext;
  };
  fortsattStamma?: { stammodatum?: string; fritext?: string };
}

/** Schema: rakenskapsperiod entry inside finansiellaRapporter[]. */
export interface BvRakenskapsperiod {
  start?: string;
  slut?: string;
  arsredovisningar?: BvArsredovisning[];
}

/** Schema: finansiellaRapporter item in FinansiellaRapporterResponse. */
export interface BvFinansiellaRapportItem {
  arende?: { arendenummer?: string; avslutatTidpunkt?: string };
  rakenskapsperioder?: BvRakenskapsperiod[];
}

/**
 * Legacy BvFinansiellRapport — used in OrganisationInformationResponse.finansiellaRapporter.
 * These fields come from the organisation summary, not the dedicated /finansiellarapporter endpoint.
 */
export interface BvFinansiellRapport {
  rapporttyp?: string;
  rapporteringsperiodFran?: string;
  rapporteringsperiodTom?: string;
  registreringsdatum?: string;
  dokumentId?: string;
  /** arende link in the summary view. */
  arende?: { arendenummer?: string; avslutatTidpunkt?: string };
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

/** Schema: OrganisationsResponse — postal address within organisationsadresser. */
export interface BvPostadress {
  land?: HvdKodKlartext;
  coAdress?: string;
  adress?: string;
  postnummer?: string;
  postort?: string;
  adressrad1?: string;
  adressrad2?: string;
  fel?: BvFel;
}

export interface OrganisationInformationResponse {
  /** Schema: identitet.identitetsbeteckning (nested identity object). */
  identitet?: { typ?: HvdKodKlartext; identitetsbeteckning?: string };
  /** Top-level identitetsbeteckning (kept for backward compatibility). */
  identitetsbeteckning?: string;
  /** Schema: namnskyddslopnummer — sequence number for multi-company registrations. */
  namnskyddslopnummer?: number;
  /** Schema: arende — the latest case linked to this organisation. */
  arende?: { arendenummer?: string; avslutatTidpunkt?: string };
  /** Schema: organisationsnamn — nested name object. */
  organisationsnamn?: { typ?: HvdKodKlartext; namn?: string };
  /** Top-level namn (kept for backward compatibility). */
  namn?: string;
  /** KodKlartext object in v4 API: { kod, klartext }. */
  organisationsform?: string | HvdKodKlartext;
  /** Date wrapper in v4 API: { registreringsdatum, bildatDatum }. */
  organisationsdatum?: string | { registreringsdatum?: string; bildatDatum?: string };
  registreringsdatum?: string;
  /** v4 API: each entry IS a KodKlartextDatum { kod, klartext, typ, datum }. */
  organisationsstatusar?: V4OrganisationStatus[];
  funktionarer?: BvOfficer[];
  /** Schema: antalValdaFunktionarer — elected officer counts. */
  antalValdaFunktionarer?: { ledamoter?: number; suppleanter?: number };
  firmateckning?: BvFirmateckning | string;
  aktieinformation?: BvAktieinformation;
  /** Schema: rakenskapsar (financial year, schema-correct name). */
  rakenskapsar?: BvRakenskapsAr;
  /** Kept for backward compatibility — same as rakenskapsar. */
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
  /** Schema: organisationsadresser — postal address and email. */
  organisationsadresser?: { postadress?: BvPostadress; epostadress?: string };
  /** Top-level adresser (kept for backward compatibility). */
  adresser?: HvdAddress[];
  /** Schema: ovrigOrganisationinformation (schema-correct name). */
  ovrigOrganisationinformation?: Record<string, unknown>;
  /** Kept for backward compatibility — same as ovrigOrganisationinformation. */
  ovrigOrganisationsinformation?: Record<string, unknown>;
  /** Schema: organisationsengagemang — engagements listed in the organisation response. */
  organisationsengagemang?: Array<{ organisation?: Record<string, unknown> }>;
  fel?: BvFel;
}

// ── Arende (case) information ────────────────────────────────────────────────

export interface BvKontaktuppgiftPostadress {
  coAdress?: string;
  adress?: string;
  postnummer?: string;
  postort?: string;
  adressrad1?: string;
  adressrad2?: string;
  land?: HvdKodKlartext;
}

export interface BvKontaktuppgiftIArende {
  adressat?: string;
  postadress?: BvKontaktuppgiftPostadress;
  epostadress?: string;
}

export interface BvArendeAktor {
  /** Schema: identitet object with typ and identitetsbeteckning. */
  identitet?: { typ?: HvdKodKlartext; identitetsbeteckning?: string };
  /** Schema: organisationsform KodKlartext. */
  organisationsform?: HvdKodKlartext;
  /** Schema: arenderoll KodKlartext. */
  arenderoll?: HvdKodKlartext;
  /** Schema: kontaktuppgiftIArende. */
  kontaktuppgiftIArende?: BvKontaktuppgiftIArende;
  /** Kept for backward compatibility. */
  aktortyp?: string;
  /** Kept for backward compatibility. */
  identitetsbeteckning?: string;
  namn?: string;
  /** Kept for backward compatibility. */
  roll?: string;
}

export interface BvSakfraga {
  /** Schema: sakfraga KodKlartext. */
  sakfraga?: HvdKodKlartext;
  /** Schema: avslutsorsak KodKlartext. */
  avslutsorsak?: HvdKodKlartext;
  /** Kept for backward compatibility. */
  sakfraganummer?: string;
  /** Kept for backward compatibility. */
  sakfragatyp?: string;
  /** Kept for backward compatibility. */
  sakfragestatus?: string;
  text?: string;
}

export interface BvArendesamband {
  /** Schema: utgarFranArendenummer. */
  utgarFranArendenummer?: string;
  /** Schema: fortsatterIArendenummer. */
  fortsatterIArendenummer?: string;
  /** Schema: arendesambandstyp KodKlartext. */
  arendesambandstyp?: HvdKodKlartext;
  /** Kept for backward compatibility. */
  sambandArendenummer?: string;
  /** Kept for backward compatibility. */
  sambandtyp?: string;
}

export interface BvArende {
  arendenummer?: string;
  /** Schema: arendeslag KodKlartext (was plain string). */
  arendeslag?: string | HvdKodKlartext;
  /** Schema: arendetyp KodKlartext (was plain string). */
  arendetyp?: string | HvdKodKlartext;
  /** Schema: arendestatus KodKlartext (was plain string). */
  arendestatus?: string | HvdKodKlartext;
  /** Schema: handlaggningsstatus KodKlartext (was plain string). */
  handlaggningsstatus?: string | HvdKodKlartext;
  /** Schema: ankommetDatum. */
  ankommetDatum?: string;
  /** Schema: skapatTidpunkt. */
  skapatTidpunkt?: string;
  /** Schema: kept as avslutatTidpunkt. */
  avslutatTidpunkt?: string;
  /** Schema: korrigeratDatum. */
  korrigeratDatum?: string;
  /** Schema: atagandeid. */
  atagandeid?: string;
  /** Schema: konsumentreferens. */
  konsumentreferens?: string;
  /** Schema: inskicksidentitet. */
  inskicksidentitet?: string;
  /** Schema: uppladdningsid. */
  uppladdningsid?: string;
  /** Schema: samladInskicksidentitet. */
  samladInskicksidentitet?: string;
  /** Schema: aktid (semicolon-separated, preserved as raw string). */
  aktid?: string;
  totalAvgift?: number;
  betaltBelopp?: number;
  /** Schema: ocrNummer. */
  ocrNummer?: string;
  /** Schema: arendeinitiativ KodKlartext. */
  arendeinitiativ?: HvdKodKlartext;
  /** Schema: arendekanal KodKlartext. */
  arendekanal?: HvdKodKlartext;
  /** Schema: arendekanalUndertyp KodKlartext. */
  arendekanalUndertyp?: HvdKodKlartext;
  /** Kept for backward compatibility. */
  registreradTidpunkt?: string;
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

/** Schema: firmateckningssvar inside firmateckningInformation[]. */
export interface BvFirmateckningssvar {
  /** JA-svar — list of signing rules that allow the person to sign. */
  firmateckningsutfallJaSvar?: BvFirmateckningsutfallJaSvar[];
  /** NEJ-svar — reason why signing authority was denied. */
  firmateckningsutfallNejSvar?: { anledning?: string };
}

/** Schema: firmateckningOrganisation inside firmateckningInformation[]. */
export interface BvFirmateckningOrganisation {
  identitet?: { typ?: HvdKodKlartext; identitetsbeteckning?: string };
  organisationsnamn?: { typ?: HvdKodKlartext; namn?: string };
  organisationsform?: HvdKodKlartext;
  organisationsstatusar?: V4OrganisationStatus[];
  /** Pending cases that may affect signing authority. */
  inneliggandeArenden?: Record<string, unknown>;
}

/** Schema: single firmateckningInformation entry. */
export interface BvFirmateckningInformation {
  funktionar?: BvEngagemangFunktionar;
  firmateckningOrganisation?: BvFirmateckningOrganisation;
  firmateckningssvar?: BvFirmateckningssvar;
}

export interface FirmateckningsalternativResponse {
  /** Schema: firmateckningInformation — the primary response array. */
  firmateckningInformation?: BvFirmateckningInformation[];
  /** Kept for backward compatibility. */
  firmateckningsutfall?: JaNej;
  /** Kept for backward compatibility. */
  firmateckningsalternativ?: Firmateckningsalternativ;
  /** Kept for backward compatibility. */
  firmateckningsutfallJaSvar?: BvFirmateckningsutfallJaSvar;
  fel?: BvFel;
}

// ── Share capital history (aktiekapitalforandringar) ─────────────────────────

/** Schema: single aktiekapitalforandringar entry. */
export interface BvAktiekapitalforandring {
  /** Schema: arende — linked case (arendenummer + avslutatTidpunkt per schema). */
  arende?: { arendenummer?: string; avslutatTidpunkt?: string };
  aktieinformation?: BvAktieinformation;
  fel?: BvFel;
}

export interface AktiekapitalforandringResponse {
  /** Schema: identitet — organisation identity at the top level. */
  identitet?: { typ?: HvdKodKlartext; identitetsbeteckning?: string };
  /** Schema: organisationsnamn — name of the organisation. */
  organisationsnamn?: { typ?: HvdKodKlartext; namn?: string };
  /** Schema: organisationsform — legal form. */
  organisationsform?: HvdKodKlartext;
  /** Schema: organisationsstatusar — statuses. */
  organisationsstatusar?: V4OrganisationStatus[];
  gallandeAktieinformation?: BvAktieinformation;
  aktiekapitalforandringar?: BvAktiekapitalforandring[];
  fel?: BvFel;
}

// ── Organisation engagements (organisationsengagemang) ──────────────────────

export interface BvEngagemangOrganisation {
  identitet?: { typ?: HvdKodKlartext; identitetsbeteckning?: string };
  /** Kept for backward compatibility. */
  identitetsbeteckning?: string;
  namnskyddslopnummer?: number;
  personnamn?: { fornamn?: string; efternamn?: string };
  organisationsnamn?: { typ?: HvdKodKlartext; namn?: string };
  /** Kept for backward compatibility. */
  namn?: string;
  organisationsform?: string | HvdKodKlartext;
  registreringsdatum?: string;
  organisationsstatusar?: HvdOrganisationStatus[];
}

export interface BvEngagemangFunktionar {
  identitet?: { typ?: HvdKodKlartext; identitetsbeteckning?: string };
  /** Kept for backward compatibility. */
  identitetsbeteckning?: string;
  personnamn?: { fornamn?: string; efternamn?: string };
  organisationsnamn?: { typ?: HvdKodKlartext; namn?: string };
  /** Kept for backward compatibility. */
  namn?: string;
  /** Schema: funktionarsroller array of KodKlartext. */
  funktionarsroller?: HvdKodKlartext[];
  /** Kept for backward compatibility. */
  roller?: BvOfficerRole[];
  postadress?: BvKontaktuppgiftPostadress;
  representerasAv?: {
    personnamn?: { fornamn?: string; efternamn?: string };
    identitet?: { typ?: HvdKodKlartext; identitetsbeteckning?: string };
  };
  insats?: string;
  anteckning?: string;
  /** Schema: arFirmatecknare — whether this person has signatory authority (JA/NEJ). */
  arFirmatecknare?: string;
}

export interface BvEngagemang {
  organisation?: BvEngagemangOrganisation;
  funktionar?: BvEngagemangFunktionar;
  fel?: BvFel;
}

export interface OrganisationsengagemangResponse {
  totaltAntalTraffar?: number;
  /** Schema: sida — current page number in paginated response. */
  sida?: number;
  /** Schema: antalPerSida — page size in paginated response. */
  antalPerSida?: number;
  funktionarsOrganisationsengagemang?: BvEngagemang[];
  fel?: BvFel;
}

// ── Financial reports ─────────────────────────────────────────────────────────

/** Schema: FinansiellaRapporterResponse from the dedicated /finansiellarapporter endpoint. */
export interface FinansiellaRapporterResponse {
  identitetsbeteckning?: string;
  /** Schema: finansiellaRapporter — uses arende + rakenskapsperioder structure. */
  finansiellaRapporter?: BvFinansiellaRapportItem[];
  fel?: BvFel;
}

// ── Pagination / sorting ─────────────────────────────────────────────────────

export interface BvPaginering {
  sida: number;
  antalPerSida: number;
}

/** Schema: OrganisationsengagemangRequest sortering — uses `attribut` (not sorteringsattribut). */
export interface BvSortering {
  attribut: SortAttributeEngagemang;
  sorteringsordning: SortOrder;
}

/** Schema: OrganisationsengagemangRequest filtrering — uses must/mustNot/should arrays. */
export interface BvFilteringCondition {
  attribut?: string;
}

export interface BvFiltrering {
  must?: BvFilteringCondition[];
  mustNot?: BvFilteringCondition[];
  should?: BvFilteringCondition[];
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
  /** Schema: identitet object. */
  identitet?: { typ?: HvdKodKlartext; identitetsbeteckning?: string };
  /** Top-level identitetsbeteckning (kept for backward compatibility). */
  identitetsbeteckning?: string;
  /** Schema: personnamn object. */
  personnamn?: { fornamn?: string; efternamn?: string };
  /** Kept for backward compatibility. */
  namn?: string;
  fodelsedatum?: string;
  nationalitet?: string;
  adresser?: BvPersonAdress[];
  roller?: BvOfficerRole[];
  organisationsengagemang?: OrganisationsengagemangResponse;
  /** Schema: personligKonkurs — personal bankruptcy records. */
  personligKonkurs?: Array<Record<string, unknown>>;
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
