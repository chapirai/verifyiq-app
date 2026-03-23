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

    const signatoryText =
      richOrganisation?.firmateckning?.text ??
      richOrganisation?.firmateckning ??
      null;

    const businessDescription =
      richOrganisation?.verksamhetsbeskrivning?.text ??
      richOrganisation?.verksamhetsbeskrivning ??
      hvOrganisation?.verksamhetsbeskrivning ??
      null;

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
