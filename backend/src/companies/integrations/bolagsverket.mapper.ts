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

    return {
      organisationNumber:
        hvOrg.identitetsbeteckning ?? richOrg.identitetsbeteckning ?? '',
      legalName:
        hvOrg.namn ?? richOrg.namn ?? DEFAULT_COMPANY_NAME,
      companyForm:
        hvOrg.organisationsform ?? richOrg.organisationsform ?? null,
      status:
        hvOrg.organisationsstatusar?.[0]?.status ??
        richOrg.organisationsstatusar?.[0]?.status ??
        null,
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
        hasRichOrganisationInformation: !!richInfoArray?.length,
        partialDataFields: fieldErrors.map((e) => e.field),
        historicalRecords: historicalHvdRecords,
      },
      fieldErrors,
    };
  }

  /**
   * Safely extract a value from a field that may contain a `{ fel: ... }` error
   * object.  When a `fel` is detected the field is mapped to `null` and an entry
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
