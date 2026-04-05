import { Injectable } from '@nestjs/common';
import {
  BvFel,
  BvFirmateckning,
  BvOfficer,
  HighValueDatasetResponse,
  HvdOrganisation,
  OrganisationInformationResponse,
} from './bolagsverket.types';

/** Fallback legal name when none is returned by the API. */
export const DEFAULT_COMPANY_NAME = 'Unknown company';

/** A single field-level error extracted from a `fel` object. */
export interface FieldError {
  field: string;
  errorType: string;
}

/** Structured name entry (used in both HVD and v4 sections). */
export interface MappedName {
  namn: string | null;
  namnstyp: string | null;
  sprak: string | null;
  registreringsdatum: string | null;
  avregistreringsdatum: string | null;
}

/** Structured address entry. */
export interface MappedAddress {
  adresstyp: string | null;
  gatuadress: string | null;
  postnummer: string | null;
  postort: string | null;
  land: string | null;
}

/** Structured officer entry. */
export interface MappedOfficer {
  namn: string | null;
  personId: string | null;
  roller: Array<{ rollkod: string | null; rollbeskrivning: string | null; rollstatus: string | null; fran: string | null; tom: string | null }>;
  fodelseAr: string | null;
  nationalitet: string | null;
}

/** Structured status entry. */
export interface MappedStatus {
  status: string | null;
  statusdatum: string | null;
}

/** Structured industry code entry. */
export interface MappedIndustryCode {
  snikod: string | null;
  snikodText: string | null;
}

/**
 * Structured section produced from the HVD (Värdefulla datamängder) payload.
 * All fields are mapped from HvdOrganisation — no raw JSON blobs.
 */
export interface HvdStructuredSection {
  identitetsbeteckning: string | null;
  namn: string | null;
  names: MappedName[];
  juridiskForm: string | null;
  organisationsform: string | null;
  organisationsdatum: string | null;
  registreringsdatum: string | null;
  verksamhetsbeskrivning: string | null;
  naringsgren: MappedIndustryCode[];
  statusar: MappedStatus[];
  adresser: MappedAddress[];
  postadressOrganisation: MappedAddress | null;
  reklamsparr: string | null;
  avregistreradOrganisation: string | null;
  avregistreringsorsak: string | null;
  avregistreringsdatum: string | null;
  pagaendeAvvecklingsEllerOmstruktureringsforfarande: string | null;
  verksamOrganisation: string | null;
  registreringsland: string | null;
  organisationsidentitet: string | null;
  rekonstruktionsstatus: string | null;
  rekonstruktionsdatum: string | null;
}

/**
 * Structured section produced from the Företagsinformation v4 payload.
 * All fields are mapped — no raw JSON blobs.
 */
export interface V4StructuredSection {
  identitetsbeteckning: string | null;
  organisationsnamn: string | null;
  organisationsform: string | null;
  organisationsdatum: string | null;
  registreringsdatum: string | null;
  organisationsstatusar: MappedStatus[];
  hemvistkommun: { kommunnamn: string | null; kommunkod: string | null } | null;
  rakenskapsar: {
    rakenskapsarInleds: string | null;
    rakenskapsarAvslutas: string | null;
    forstaRakenskapsarInleds: string | null;
    forstaRakenskapsarAvslutas: string | null;
  } | null;
  verksamhetsbeskrivning: string | null;
  firmateckning: string | null;
  firmateckningstyp: string | null;
  samtligaOrganisationsnamn: MappedName[];
  funktionarer: MappedOfficer[];
  aktieinformation: {
    aktiekapital: number | null;
    antalAktier: number | null;
    kvotvarde: number | null;
    aktiekapitalMin: number | null;
    aktiekapitalMax: number | null;
    antalAktierMin: number | null;
    antalAktierMax: number | null;
    registreringsdatum: string | null;
    aktieslag: Array<{
      aktieslagsnamn: string | null;
      antalAktier: number | null;
      aktiekapital: number | null;
      kvotvarde: number | null;
      rostvarde: number | null;
    }>;
  } | null;
  adresser: MappedAddress[];
  tillstand: Array<{
    tillstandstyp: string | null;
    tillstandsnummer: string | null;
    tillstandsstatus: string | null;
    beviljatDatum: string | null;
    giltigFran: string | null;
    giltigTom: string | null;
    utfardareNamn: string | null;
  }>;
  organisationsmarkeringar: Array<{
    markeringstyp: string | null;
    markeringsdatum: string | null;
    text: string | null;
  }>;
  bestammelser: Array<{
    bestammelsetyp: string | null;
    text: string | null;
    registreringsdatum: string | null;
  }>;
  vakanserOchUpplysningar: Array<{
    typ: string | null;
    text: string | null;
    registreringsdatum: string | null;
  }>;
  ekonomiskPlan: {
    plantyp: string | null;
    godkandDatum: string | null;
    registreringsdatum: string | null;
  } | null;
  utlandskFilialagandeOrganisation: {
    utlandskOrganisationNamn: string | null;
    utlandskOrganisationIdentitetsbeteckning: string | null;
    utlandskOrganisationLand: string | null;
  } | null;
  finansiellaRapporter: Array<{
    rapporttyp: string | null;
    rapporteringsperiodFran: string | null;
    rapporteringsperiodTom: string | null;
    registreringsdatum: string | null;
    dokumentId: string | null;
  }>;
  ovrigOrganisationsinformation: Record<string, unknown> | null;
}

/** Normalised company record produced by the mapper (not a DB entity). */
export interface NormalisedCompany {
  organisationNumber: string;
  legalName: string;
  companyForm: string | null;
  status: string | null;
  registeredAt: string | null;
  countryCode: string;
  businessDescription: string | null;
  signatoryText: string | null;
  officers: Array<Record<string, unknown>>;
  shareInformation: Record<string, unknown>;
  financialReports: Array<Record<string, unknown>>;
  addresses: Array<Record<string, unknown>>;
  allNames: Array<Record<string, unknown>>;
  permits: Array<Record<string, unknown>>;
  financialYear: Record<string, unknown> | null;
  industryCode: string | null;
  deregisteredAt: string | null;
  sourcePayloadSummary: Record<string, unknown>;
  /** Field-level errors encountered during mapping. Empty when no errors. */
  fieldErrors: FieldError[];
  /** Fully structured HVD section — no raw JSON blobs. Null when HVD fetch failed. */
  hvdSection: HvdStructuredSection | null;
  /** Fully structured Företagsinformation v4 section — no raw JSON blobs. Null when v4 fetch failed. */
  v4Section: V4StructuredSection | null;
}

/** Safely extract a plain string from a KodKlartext object or a plain string. */
function extractKodKlartext(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (typeof obj['klartext'] === 'string') return obj['klartext'];
    if (typeof obj['kod'] === 'string') return obj['kod'];
    if (typeof obj['text'] === 'string') return obj['text'];
  }
  return null;
}

/** Map a raw HvdAddress (or similar) into a flat MappedAddress. */
function mapAddress(a: { gatuadress?: string; postnummer?: string; postort?: string; land?: string; adresstyp?: string } | null | undefined): MappedAddress | null {
  if (!a) return null;
  return {
    adresstyp: a.adresstyp ?? null,
    gatuadress: a.gatuadress ?? null,
    postnummer: a.postnummer ?? null,
    postort: a.postort ?? null,
    land: a.land ?? null,
  };
}

@Injectable()
export class BolagsverketMapper {
  /**
   * Map high-value dataset + rich organisation information into a single
   * normalised company record ready for persistence.
   *
   * Multi-record HVD responses are sorted by `registreringsdatum` descending
   * so that the most recently registered record is selected as the primary.
   * Historical records are preserved in `sourcePayloadSummary.historicalRecords`.
   */
  map(
    highValue: HighValueDatasetResponse | null | undefined,
    richInfoArray: OrganisationInformationResponse[] | null | undefined,
    fallbackIdentifier?: string,
  ): NormalisedCompany {
    // ── Multi-record handling ──────────────────────────────────────────────
    // HVD may return an array; sort descending by registreringsdatum and take
    // the latest valid (non-error) record as the primary.
    const allHvdOrgs: HvdOrganisation[] = highValue?.organisationer
      ? [...highValue.organisationer].sort((a, b) => {
          const aDate = a.registreringsdatum ?? '';
          const bDate = b.registreringsdatum ?? '';
          return bDate.localeCompare(aDate);
        })
      : highValue?.organisation
        ? [highValue.organisation]
        : [];

    const hvOrg: HvdOrganisation =
      allHvdOrgs.find((o) => !o.fel) ?? allHvdOrgs[0] ?? {};

    const historicalHvdRecords = allHvdOrgs.slice(1);

    const richOrg: OrganisationInformationResponse =
      (richInfoArray ?? [])[0] ?? {};

    const fieldErrors: FieldError[] = [];

    const officers = this.mapOfficers(richOrg.funktionarer ?? []);

    // ── Field-level fel detection ──────────────────────────────────────────
    const signatoryText = this.extractFieldOrNull(
      richOrg.firmateckning,
      (v) =>
        typeof v === 'object'
          ? (v as BvFirmateckning)?.text ?? null
          : (v as string | undefined) ?? null,
      'firmateckning',
      fieldErrors,
    );

    const businessDescription = this.extractFieldOrNull(
      richOrg.verksamhetsbeskrivning,
      (v) =>
        typeof v === 'object' ? v?.text ?? null : (v as string | undefined) ?? null,
      'verksamhetsbeskrivning',
      fieldErrors,
    );

    const industryCode = this.extractFieldOrNull(
      hvOrg.snikoder?.[0],
      (v) => v?.snikod ?? null,
      'snikoder',
      fieldErrors,
    );

    const deregisteredAt = this.extractFieldOrNull(
      hvOrg.avregistreringsinformation,
      (v) => v?.avregistreringsdatum ?? null,
      'avregistreringsinformation',
      fieldErrors,
    );

    // Collect top-level fel flags
    if (hvOrg.fel) {
      fieldErrors.push({ field: 'hvOrg', errorType: hvOrg.fel.typ ?? 'UNKNOWN' });
    }
    if (richOrg.fel) {
      fieldErrors.push({ field: 'richOrg', errorType: richOrg.fel.typ ?? 'UNKNOWN' });
    }
    if (richOrg.aktieinformation?.fel) {
      fieldErrors.push({ field: 'aktieinformation', errorType: richOrg.aktieinformation.fel.typ ?? 'UNKNOWN' });
    }
    if (richOrg.rakenskapsAr?.fel) {
      fieldErrors.push({ field: 'rakenskapsAr', errorType: richOrg.rakenskapsAr.fel.typ ?? 'UNKNOWN' });
    }
    if (hvOrg.rekonstruktionsstatus?.fel) {
      fieldErrors.push({
        field: 'rekonstruktionsstatus',
        errorType: hvOrg.rekonstruktionsstatus.fel.typ ?? 'UNKNOWN',
      });
    }

    // ── Safe KodKlartext extractions ──────────────────────────────────────
    const companyForm =
      extractKodKlartext(hvOrg.organisationsform) ??
      extractKodKlartext(richOrg.organisationsform) ??
      null;

    const rawStatus =
      hvOrg.organisationsstatusar?.[0]?.status ??
      richOrg.organisationsstatusar?.[0]?.status ??
      null;
    const status = extractKodKlartext(rawStatus);

    // ── Build structured HVD section ──────────────────────────────────────
    const hvdSection: HvdStructuredSection | null = highValue
      ? {
          identitetsbeteckning: hvOrg.identitetsbeteckning ?? null,
          namn: hvOrg.namn ?? null,
          names: (hvOrg.organisationsnamnLista ?? [])
            .filter((n) => !n.fel)
            .map((n) => ({
              namn: n.namn ?? null,
              namnstyp: n.namnstyp ?? null,
              sprak: n.sprak ?? null,
              registreringsdatum: n.registreringsdatum ?? null,
              avregistreringsdatum: n.avregistreringsdatum ?? null,
            })),
          juridiskForm: extractKodKlartext(hvOrg.juridiskForm) ?? null,
          organisationsform: extractKodKlartext(hvOrg.organisationsform) ?? null,
          organisationsdatum: hvOrg.organisationsdatum ?? null,
          registreringsdatum: hvOrg.registreringsdatum ?? null,
          verksamhetsbeskrivning: hvOrg.verksamhetsbeskrivning ?? null,
          naringsgren: (hvOrg.snikoder ?? [])
            .filter((c) => !c.fel)
            .map((c) => ({ snikod: c.snikod ?? null, snikodText: c.snikodText ?? null })),
          statusar: (hvOrg.organisationsstatusar ?? [])
            .filter((s) => !s.fel)
            .map((s) => ({ status: extractKodKlartext(s.status) ?? s.status ?? null, statusdatum: s.statusdatum ?? null })),
          adresser: (hvOrg.adresser ?? []).filter((a) => !a.fel).map((a) => mapAddress(a)!),
          postadressOrganisation: mapAddress(hvOrg.postadressOrganisation),
          reklamsparr: hvOrg.reklamsparr ?? null,
          avregistreradOrganisation: hvOrg.avregistreradOrganisation ?? null,
          avregistreringsorsak: hvOrg.avregistreringsinformation?.fel
            ? null
            : hvOrg.avregistreringsinformation?.avregistreringsorsak ?? null,
          avregistreringsdatum: hvOrg.avregistreringsinformation?.fel
            ? null
            : hvOrg.avregistreringsinformation?.avregistreringsdatum ?? null,
          pagaendeAvvecklingsEllerOmstruktureringsforfarande:
            hvOrg.pagaendeAvvecklingsEllerOmstruktureringsforfarande ?? null,
          verksamOrganisation: hvOrg.verksamOrganisation ?? null,
          registreringsland: hvOrg.registreringsland ?? null,
          organisationsidentitet: hvOrg.organisationsidentitet ?? null,
          rekonstruktionsstatus: hvOrg.rekonstruktionsstatus?.fel
            ? null
            : hvOrg.rekonstruktionsstatus?.rekonstruktionsstatus ?? null,
          rekonstruktionsdatum: hvOrg.rekonstruktionsstatus?.fel
            ? null
            : hvOrg.rekonstruktionsstatus?.rekonstruktionsdatum ?? null,
        }
      : null;

    // ── Build structured v4 section ────────────────────────────────────────
    const hasRichOrg = !!(richInfoArray?.length);
    const v4Section: V4StructuredSection | null = hasRichOrg
      ? {
          identitetsbeteckning: richOrg.identitetsbeteckning ?? null,
          organisationsnamn: richOrg.namn ?? null,
          organisationsform: extractKodKlartext(richOrg.organisationsform) ?? null,
          organisationsdatum: richOrg.organisationsdatum ?? null,
          registreringsdatum: richOrg.registreringsdatum ?? null,
          organisationsstatusar: (richOrg.organisationsstatusar ?? [])
            .filter((s) => !s.fel)
            .map((s) => ({ status: extractKodKlartext(s.status) ?? s.status ?? null, statusdatum: s.statusdatum ?? null })),
          hemvistkommun: richOrg.hemvistkommun?.fel
            ? null
            : richOrg.hemvistkommun
              ? { kommunnamn: richOrg.hemvistkommun.kommunnamn ?? null, kommunkod: richOrg.hemvistkommun.kommunkod ?? null }
              : null,
          rakenskapsar: richOrg.rakenskapsAr?.fel
            ? null
            : richOrg.rakenskapsAr
              ? {
                  rakenskapsarInleds: richOrg.rakenskapsAr.rakenskapsarInleds ?? null,
                  rakenskapsarAvslutas: richOrg.rakenskapsAr.rakenskapsarAvslutas ?? null,
                  forstaRakenskapsarInleds: richOrg.rakenskapsAr.forstaRakenskapsarInleds ?? null,
                  forstaRakenskapsarAvslutas: richOrg.rakenskapsAr.forstaRakenskapsarAvslutas ?? null,
                }
              : null,
          verksamhetsbeskrivning:
            typeof richOrg.verksamhetsbeskrivning === 'string'
              ? richOrg.verksamhetsbeskrivning
              : richOrg.verksamhetsbeskrivning?.fel
                ? null
                : (richOrg.verksamhetsbeskrivning?.text ?? null),
          firmateckning:
            typeof richOrg.firmateckning === 'string'
              ? richOrg.firmateckning
              : richOrg.firmateckning?.fel
                ? null
                : (richOrg.firmateckning?.text ?? null),
          firmateckningstyp:
            typeof richOrg.firmateckning === 'object' && !richOrg.firmateckning?.fel
              ? ((richOrg.firmateckning as BvFirmateckning)?.firmateckningstyp ?? null)
              : null,
          samtligaOrganisationsnamn: (richOrg.samtligaOrganisationsnamn ?? [])
            .filter((n) => !n.fel)
            .map((n) => ({
              namn: n.namn ?? null,
              namnstyp: n.namnstyp ?? null,
              sprak: n.sprak ?? null,
              registreringsdatum: n.registreringsdatum ?? null,
              avregistreringsdatum: n.avregistreringsdatum ?? null,
            })),
          funktionarer: (richOrg.funktionarer ?? [])
            .filter((o) => !o.fel)
            .map((o) => ({
              namn: o.namn ?? null,
              personId: o.personId ?? o.identitetsbeteckning ?? null,
              roller: (o.roller ?? []).map((r) => ({
                rollkod: r.rollkod ?? null,
                rollbeskrivning: r.rollbeskrivning ?? null,
                rollstatus: r.rollstatus ?? null,
                fran: r.fran ?? null,
                tom: r.tom ?? null,
              })),
              fodelseAr: o.fodelseAr ?? null,
              nationalitet: o.nationalitet ?? null,
            })),
          aktieinformation: richOrg.aktieinformation?.fel
            ? null
            : richOrg.aktieinformation
              ? {
                  aktiekapital: richOrg.aktieinformation.aktiekapital ?? null,
                  antalAktier: richOrg.aktieinformation.antalAktier ?? null,
                  kvotvarde: richOrg.aktieinformation.kvotvarde ?? null,
                  aktiekapitalMin: richOrg.aktieinformation.aktiekapitalMin ?? null,
                  aktiekapitalMax: richOrg.aktieinformation.aktiekapitalMax ?? null,
                  antalAktierMin: richOrg.aktieinformation.antalAktierMin ?? null,
                  antalAktierMax: richOrg.aktieinformation.antalAktierMax ?? null,
                  registreringsdatum: richOrg.aktieinformation.registreringsdatum ?? null,
                  aktieslag: (richOrg.aktieinformation.aktieslag ?? [])
                    .filter((s) => !s.fel)
                    .map((s) => ({
                      aktieslagsnamn: s.aktieslagsnamn ?? null,
                      antalAktier: s.antalAktier ?? null,
                      aktiekapital: s.aktiekapital ?? null,
                      kvotvarde: s.kvotvarde ?? null,
                      rostvarde: s.rostvarde ?? null,
                    })),
                }
              : null,
          adresser: (richOrg.adresser ?? []).filter((a) => !a.fel).map((a) => mapAddress(a)!),
          tillstand: (richOrg.tillstand ?? [])
            .filter((t) => !t.fel)
            .map((t) => ({
              tillstandstyp: t.tillstandstyp ?? null,
              tillstandsnummer: t.tillstandsnummer ?? null,
              tillstandsstatus: t.tillstandsstatus ?? null,
              beviljatDatum: t.beviljatDatum ?? null,
              giltigFran: t.giltigFran ?? null,
              giltigTom: t.giltigTom ?? null,
              utfardareNamn: t.utfardareNamn ?? null,
            })),
          organisationsmarkeringar: (richOrg.organisationsmarkeringar ?? [])
            .filter((m) => !m.fel)
            .map((m) => ({
              markeringstyp: m.markeringstyp ?? null,
              markeringsdatum: m.markeringsdatum ?? null,
              text: m.text ?? null,
            })),
          bestammelser: (richOrg.bestammelser ?? [])
            .filter((b) => !b.fel)
            .map((b) => ({
              bestammelsetyp: b.bestammelsetyp ?? null,
              text: b.text ?? null,
              registreringsdatum: b.registreringsdatum ?? null,
            })),
          vakanserOchUpplysningar: (richOrg.vakanserOchUpplysningar ?? [])
            .filter((v) => !v.fel)
            .map((v) => ({
              typ: v.typ ?? null,
              text: v.text ?? null,
              registreringsdatum: v.registreringsdatum ?? null,
            })),
          ekonomiskPlan: richOrg.ekonomiskPlan?.fel
            ? null
            : richOrg.ekonomiskPlan
              ? {
                  plantyp: richOrg.ekonomiskPlan.plantyp ?? null,
                  godkandDatum: richOrg.ekonomiskPlan.godkandDatum ?? null,
                  registreringsdatum: richOrg.ekonomiskPlan.registreringsdatum ?? null,
                }
              : null,
          utlandskFilialagandeOrganisation: richOrg.utlandskFilialagandeOrganisation?.fel
            ? null
            : richOrg.utlandskFilialagandeOrganisation
              ? {
                  utlandskOrganisationNamn: richOrg.utlandskFilialagandeOrganisation.utlandskOrganisationNamn ?? null,
                  utlandskOrganisationIdentitetsbeteckning:
                    richOrg.utlandskFilialagandeOrganisation.utlandskOrganisationIdentitetsbeteckning ?? null,
                  utlandskOrganisationLand: richOrg.utlandskFilialagandeOrganisation.utlandskOrganisationLand ?? null,
                }
              : null,
          finansiellaRapporter: (richOrg.finansiellaRapporter ?? [])
            .filter((r) => !r.fel)
            .map((r) => ({
              rapporttyp: r.rapporttyp ?? null,
              rapporteringsperiodFran: r.rapporteringsperiodFran ?? null,
              rapporteringsperiodTom: r.rapporteringsperiodTom ?? null,
              registreringsdatum: r.registreringsdatum ?? null,
              dokumentId: r.dokumentId ?? null,
            })),
          ovrigOrganisationsinformation:
            (richOrg.ovrigOrganisationsinformation as Record<string, unknown> | null | undefined) ?? null,
        }
      : null;

    return {
      organisationNumber:
        hvOrg.identitetsbeteckning ?? richOrg.identitetsbeteckning ?? fallbackIdentifier ?? '',
      legalName:
        hvOrg.namn ?? richOrg.namn ?? DEFAULT_COMPANY_NAME,
      companyForm,
      status,
      registeredAt:
        hvOrg.registreringsdatum ?? richOrg.registreringsdatum ?? null,
      countryCode: 'SE',
      businessDescription,
      signatoryText,
      officers,
      shareInformation: richOrg.aktieinformation?.fel
        ? {}
        : ((richOrg.aktieinformation as Record<string, unknown>) ?? {}),
      financialReports: (richOrg.finansiellaRapporter as Array<Record<string, unknown>>) ?? [],
      addresses: (richOrg.adresser ?? hvOrg.adresser ?? []) as Array<Record<string, unknown>>,
      allNames: (richOrg.samtligaOrganisationsnamn ?? []) as Array<Record<string, unknown>>,
      permits: (richOrg.tillstand ?? []) as Array<Record<string, unknown>>,
      financialYear: richOrg.rakenskapsAr?.fel
        ? null
        : ((richOrg.rakenskapsAr as Record<string, unknown> | undefined) ?? null),
      industryCode,
      deregisteredAt,
      sourcePayloadSummary: {
        hasHighValueDataset: !!highValue,
        hasRichOrganisationInformation: hasRichOrg,
        partialDataFields: fieldErrors.map((e) => e.field),
        historicalRecords: historicalHvdRecords,
      },
      fieldErrors,
      hvdSection,
      v4Section,
    };
  }

  /**
   * Safely extract a value from a field that may contain a `{ fel: ... }` error
   * object. When a `fel` is detected the field is mapped to `null` and an entry
   * is added to `fieldErrors`.
   */
  private extractFieldOrNull<TRaw, TOut>(
    raw: TRaw | undefined | null,
    extract: (v: NonNullable<TRaw>) => TOut | null,
    fieldName: string,
    fieldErrors: FieldError[],
  ): TOut | null {
    if (raw == null) return null;
    const fel = (raw as { fel?: BvFel }).fel;
    if (fel) {
      fieldErrors.push({ field: fieldName, errorType: fel.typ ?? 'UNKNOWN' });
      return null;
    }
    return extract(raw as NonNullable<TRaw>);
  }

  private mapOfficers(officers: BvOfficer[]): Array<Record<string, unknown>> {
    return officers.map((o) => ({
      namn: o.namn ?? null,
      personId: o.personId ?? o.identitetsbeteckning ?? null,
      roller: o.roller ?? [],
      fodelseAr: o.fodelseAr ?? null,
      nationalitet: o.nationalitet ?? null,
    }));
  }
}