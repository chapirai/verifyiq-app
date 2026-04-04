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

    // Safely extract companyForm — API may return { klartext: 'Aktiebolag', kod: 'AB', fel: null, dataproducent: '...' }
    const rawCompanyForm =
      hvOrganisation?.organisationsform ??
      richOrganisation?.organisationsform ??
      null;
    const companyForm =
      typeof rawCompanyForm === 'string'
        ? rawCompanyForm
        : typeof rawCompanyForm?.klartext === 'string'
          ? rawCompanyForm.klartext
          : typeof rawCompanyForm?.kod === 'string'
            ? rawCompanyForm.kod
            : null;

    // Safely extract status — same KodKlartext pattern
    const rawStatus =
      hvOrganisation?.organisationsstatusar?.[0]?.status ??
      richOrganisation?.organisationsstatusar?.[0]?.status ??
      null;
    const status =
      typeof rawStatus === 'string'
        ? rawStatus
        : typeof rawStatus?.klartext === 'string'
          ? rawStatus.klartext
          : typeof rawStatus?.kod === 'string'
            ? rawStatus.kod
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
      companyForm,
      status,
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
