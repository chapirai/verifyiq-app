import { Injectable } from '@nestjs/common';
import {
  BvFirmateckning,
  BvOfficer,
  HighValueDatasetResponse,
  HvdOrganisation,
  OrganisationInformationResponse,
} from './bolagsverket.types';

/** Fallback legal name when none is returned by the API. */
export const DEFAULT_COMPANY_NAME = 'Unknown company';

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
}

@Injectable()
export class BolagsverketMapper {
  /**
   * Map high-value dataset + rich organisation information into a single
   * normalised company record ready for persistence.
   */
  map(
    highValue: HighValueDatasetResponse | null | undefined,
    richInfoArray: OrganisationInformationResponse[] | null | undefined,
  ): NormalisedCompany {
    const hvOrg: HvdOrganisation =
      highValue?.organisation ?? highValue?.organisationer?.[0] ?? {};

    const richOrg: OrganisationInformationResponse =
      (richInfoArray ?? [])[0] ?? {};

    const officers = this.mapOfficers(richOrg.funktionarer ?? []);

    const signatoryText =
      typeof richOrg.firmateckning === 'object'
        ? (richOrg.firmateckning as BvFirmateckning)?.text ?? null
        : (richOrg.firmateckning as string | undefined) ?? null;

    const businessDescription =
      typeof richOrg.verksamhetsbeskrivning === 'object'
        ? richOrg.verksamhetsbeskrivning?.text ?? null
        : (richOrg.verksamhetsbeskrivning as string | undefined) ?? null;

    const industryCode =
      hvOrg.snikoder?.[0]?.snikod ?? null;

    const deregisteredAt =
      hvOrg.avregistreringsinformation?.avregistreringsdatum ?? null;

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
      shareInformation: (richOrg.aktieinformation as Record<string, unknown>) ?? {},
      financialReports: (richOrg.finansiellaRapporter as Array<Record<string, unknown>>) ?? [],
      addresses: (richOrg.adresser ?? hvOrg.adresser ?? []) as Array<Record<string, unknown>>,
      allNames: (richOrg.samtligaOrganisationsnamn ?? []) as Array<Record<string, unknown>>,
      permits: (richOrg.tillstand ?? []) as Array<Record<string, unknown>>,
      financialYear: (richOrg.rakenskapsAr as Record<string, unknown> | undefined) ?? null,
      industryCode,
      deregisteredAt,
      sourcePayloadSummary: {
        hasHighValueDataset: !!highValue,
        hasRichOrganisationInformation: !!richInfoArray?.length,
        partialDataFields: this.collectPartialDataFields(hvOrg, richOrg),
      },
    };
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

  /** Collect field names where a "fel" (error) indicator is present. */
  private collectPartialDataFields(
    hvOrg: HvdOrganisation,
    richOrg: OrganisationInformationResponse,
  ): string[] {
    const partial: string[] = [];
    if (hvOrg.fel) partial.push('hvOrg');
    if (hvOrg.avregistreringsinformation?.fel) partial.push('avregistreringsinformation');
    if (hvOrg.rekonstruktionsstatus?.fel) partial.push('rekonstruktionsstatus');
    if (richOrg.fel) partial.push('richOrg');
    if (richOrg.aktieinformation?.fel) partial.push('aktieinformation');
    if (richOrg.rakenskapsAr?.fel) partial.push('rakenskapsAr');
    if (typeof richOrg.verksamhetsbeskrivning === 'object' && richOrg.verksamhetsbeskrivning?.fel) {
      partial.push('verksamhetsbeskrivning');
    }
    if (typeof richOrg.firmateckning === 'object' && richOrg.firmateckning?.fel) {
      partial.push('firmateckning');
    }
    return partial;
  }
}
