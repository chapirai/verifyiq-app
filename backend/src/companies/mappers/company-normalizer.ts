import { Injectable } from '@nestjs/common';

@Injectable()
export class CompanyNormalizer {
  normalize(highValue: any, richInfo: any) {
    const hvOrganisation = highValue?.organisation ?? highValue?.organisationer?.[0] ?? {};
    const richOrganisation = richInfo?.organisation ?? richInfo?.organisationer?.[0] ?? richInfo ?? {};

    const officers =
      richOrganisation?.funktionarer ??
      richOrganisation?.foretradare ??
      hvOrganisation?.funktionarer ??
      [];

    // Safely extract signatoryText — API may return an object { text: '...' } or a plain string
    const rawSignatory = richOrganisation?.firmateckning;
    const signatoryText =
      typeof rawSignatory === 'string'
        ? rawSignatory
        : typeof rawSignatory?.text === 'string'
          ? rawSignatory.text
          : null;

    // Safely extract businessDescription — API may return { klartext: '...', kod: '...', fel: ..., dataproducent: ... }
    // or { text: '...' } or a plain string. Never pass the raw object to the frontend.
    const rawDesc =
      richOrganisation?.verksamhetsbeskrivning ??
      hvOrganisation?.verksamhetsbeskrivning ??
      null;
    const businessDescription =
      typeof rawDesc === 'string'
        ? rawDesc
        : typeof rawDesc?.text === 'string'
          ? rawDesc.text
          : typeof rawDesc?.klartext === 'string'
            ? rawDesc.klartext
            : null;

    return {
      organisationNumber:
        hvOrganisation?.identitetsbeteckning ??
        richOrganisation?.identitetsbeteckning ??
        '',
      legalName:
        hvOrganisation?.namn ??
        richOrganisation?.namn ??
        'Unknown company',
      companyForm:
        hvOrganisation?.organisationsform ??
        richOrganisation?.organisationsform ??
        null,
      status:
        hvOrganisation?.organisationsstatusar?.[0]?.status ??
        richOrganisation?.organisationsstatusar?.[0]?.status ??
        null,
      registeredAt:
        hvOrganisation?.registreringsdatum ??
        richOrganisation?.registreringsdatum ??
        null,
      countryCode: 'SE',
      businessDescription,
      signatoryText,
      officers: Array.isArray(officers) ? officers : [],
      shareInformation:
        richOrganisation?.aktieinformation ??
        {},
      financialReports:
        richOrganisation?.finansiellaRapporter ??
        [],
      sourcePayloadSummary: {
        hasHighValueDataset: !!highValue,
        hasRichOrganisationInformation: !!richInfo,
      },
    };
  }
}
