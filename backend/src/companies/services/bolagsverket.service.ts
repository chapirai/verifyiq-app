import { Injectable, Logger } from '@nestjs/common';
import { BolagsverketClient } from '../integrations/bolagsverket.client';
import { BolagsverketMapper, NormalisedCompany } from '../integrations/bolagsverket.mapper';
import {
  AktiekapitalforandringResponse,
  ArendeResponse,
  BvOfficer,
  DocumentListResponse,
  FinansiellaRapporterResponse,
  FirmateckningsalternativResponse,
  HighValueDatasetResponse,
  OrganisationInformationResponse,
  OrganisationsengagemangResponse,
} from '../integrations/bolagsverket.types';

export interface CompleteCompanyProfile {
  normalisedData: NormalisedCompany;
  highValueDataset: HighValueDatasetResponse | null;
  organisationInformation: OrganisationInformationResponse[];
  documents: DocumentListResponse | null;
  retrievedAt: string;
}

export interface OfficerProfile {
  namn: string | null;
  personId: string | null;
  roller: Array<{ rollkod?: string; rollbeskrivning?: string; rollstatus?: string }>;
  fodelseAr: string | null;
  nationalitet: string | null;
}

export interface FinancialSnapshot {
  shareCapital: Record<string, unknown>;
  financialYear: Record<string, unknown> | null;
  financialReports: Array<Record<string, unknown>>;
  documents: DocumentListResponse | null;
}

export interface DataValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
}

@Injectable()
export class BolagsverketService {
  private readonly logger = new Logger(BolagsverketService.name);

  constructor(
    private readonly client: BolagsverketClient,
    private readonly mapper: BolagsverketMapper,
  ) {}

  // ── Health ──────────────────────────────────────────────────────────────────

  async healthCheck(): Promise<{ status: string }> {
    return this.client.healthCheck();
  }

  // ── Complete company profile ─────────────────────────────────────────────────

  /**
   * Fetch high-value dataset + all organisational information in parallel,
   * then normalise into a single profile.
   */
  async getCompleteCompanyData(identitetsbeteckning: string): Promise<CompleteCompanyProfile> {
    const [hvdResult, richResult, docResult] = await Promise.allSettled([
      this.client.fetchHighValueDataset(identitetsbeteckning),
      this.client.fetchOrganisationInformation(identitetsbeteckning),
      this.client.fetchDocumentList(identitetsbeteckning),
    ]);

    const highValueDataset =
      hvdResult.status === 'fulfilled' ? hvdResult.value.responsePayload : null;
    const organisationInformation =
      richResult.status === 'fulfilled' ? richResult.value.responsePayload : [];
    const documents =
      docResult.status === 'fulfilled' ? docResult.value.responsePayload : null;

    if (hvdResult.status === 'rejected') {
      this.logger.warn(`fetchHighValueDataset failed for ${identitetsbeteckning}: ${hvdResult.reason}`);
    }
    if (richResult.status === 'rejected') {
      this.logger.warn(`fetchOrganisationInformation failed for ${identitetsbeteckning}: ${richResult.reason}`);
    }
    if (docResult.status === 'rejected') {
      this.logger.warn(`fetchDocumentList failed for ${identitetsbeteckning}: ${docResult.reason}`);
    }

    const normalisedData = this.mapper.map(highValueDataset, organisationInformation);

    return {
      normalisedData,
      highValueDataset,
      organisationInformation,
      documents,
      retrievedAt: new Date().toISOString(),
    };
  }

  // ── Officers ────────────────────────────────────────────────────────────────

  async getOfficerInformation(
    identitetsbeteckning: string,
    officerType: 'all' | 'signatories' | 'board' = 'all',
  ): Promise<OfficerProfile[]> {
    const { responsePayload } = await this.client.fetchOrganisationInformation(identitetsbeteckning, [
      'FUNKTIONARER',
      'FIRMATECKNING',
    ]);
    const orgInfo = responsePayload[0];
    const officers: BvOfficer[] = orgInfo?.funktionarer ?? [];

    let filtered = officers;
    if (officerType === 'signatories') {
      filtered = officers.filter((o) =>
        o.roller?.some((r) => r.rollkod === 'FIRMATECKNARE' || r.rollkod === 'FT'),
      );
    } else if (officerType === 'board') {
      filtered = officers.filter((o) =>
        o.roller?.some((r) =>
          ['STYRELSEORDFORANDE', 'STYRELSELEDAMOT', 'STYRELSESUPPLEANT'].includes(r.rollkod ?? ''),
        ),
      );
    }

    return filtered.map((o) => ({
      namn: o.namn ?? null,
      personId: o.personId ?? o.identitetsbeteckning ?? null,
      roller: o.roller ?? [],
      fodelseAr: o.fodelseAr ?? null,
      nationalitet: o.nationalitet ?? null,
    }));
  }

  // ── Financial snapshot ──────────────────────────────────────────────────────

  async getFinancialSnapshot(identitetsbeteckning: string): Promise<FinancialSnapshot> {
    const [richResult, docResult] = await Promise.allSettled([
      this.client.fetchOrganisationInformation(identitetsbeteckning, [
        'AKTIEINFORMATION',
        'RAKENSKAPSÅR',
        'FINANSIELLA_RAPPORTER',
      ]),
      this.client.fetchDocumentList(identitetsbeteckning),
    ]);

    const orgInfo =
      richResult.status === 'fulfilled' ? richResult.value.responsePayload[0] : null;
    const documents =
      docResult.status === 'fulfilled' ? docResult.value.responsePayload : null;

    return {
      shareCapital: (orgInfo?.aktieinformation as Record<string, unknown>) ?? {},
      financialYear: (orgInfo?.rakenskapsAr as Record<string, unknown> | undefined) ?? null,
      financialReports: (orgInfo?.finansiellaRapporter as Array<Record<string, unknown>>) ?? [],
      documents,
    };
  }

  // ── Signatory power ──────────────────────────────────────────────────────────

  async verifySignatoryPower(
    funktionarIdentitetsbeteckning: string,
    organisationIdentitetsbeteckning: string,
  ): Promise<FirmateckningsalternativResponse> {
    const { responsePayload } = await this.client.verifySignatoryPower(
      funktionarIdentitetsbeteckning,
      organisationIdentitetsbeteckning,
    );
    return responsePayload;
  }

  // ── Share capital history ────────────────────────────────────────────────────

  async getShareCapitalHistory(
    identitetsbeteckning: string,
    fromdatum?: string,
    tomdatum?: string,
  ): Promise<AktiekapitalforandringResponse> {
    const { responsePayload } = await this.client.fetchShareCapitalHistory(
      identitetsbeteckning,
      fromdatum,
      tomdatum,
    );
    return responsePayload;
  }

  // ── Cases / arenden ──────────────────────────────────────────────────────────

  async getCaseInformation(
    arendenummer?: string,
    organisationIdentitetsbeteckning?: string,
    fromdatum?: string,
    tomdatum?: string,
  ): Promise<ArendeResponse> {
    const { responsePayload } = await this.client.fetchArendeInformation(
      arendenummer,
      organisationIdentitetsbeteckning,
      fromdatum,
      tomdatum,
    );
    return responsePayload;
  }

  // ── Engagements ──────────────────────────────────────────────────────────────

  async getOrganizationEngagements(
    identitetsbeteckning: string,
    pageNumber = 1,
    pageSize = 20,
  ): Promise<OrganisationsengagemangResponse> {
    const { responsePayload } = await this.client.fetchOrganizationEngagements(
      identitetsbeteckning,
      pageNumber,
      pageSize,
    );
    return responsePayload;
  }

  // ── Financial reports ────────────────────────────────────────────────────────

  async getFinancialReports(
    identitetsbeteckning: string,
    fromdatum?: string,
    tomdatum?: string,
  ): Promise<FinansiellaRapporterResponse> {
    const { responsePayload } = await this.client.fetchFinancialReports(
      identitetsbeteckning,
      fromdatum,
      tomdatum,
    );
    return responsePayload;
  }

  // ── Document list ────────────────────────────────────────────────────────────

  async getDocumentList(identitetsbeteckning: string): Promise<DocumentListResponse> {
    const { responsePayload } = await this.client.fetchDocumentList(identitetsbeteckning);
    return responsePayload;
  }

  // ── Data validation ──────────────────────────────────────────────────────────

  /**
   * Validate data integrity rules for a normalised company record.
   * Returns a summary with errors and warnings.
   */
  validateCompanyData(company: NormalisedCompany): DataValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!company.organisationNumber) {
      errors.push('Missing organisationNumber');
    }
    if (!company.legalName || company.legalName === 'Unknown company') {
      warnings.push('Legal name is missing or unknown');
    }

    // Share capital integrity: antalAktier * kvotvarde ≈ aktiekapital
    const share = company.shareInformation as {
      antalAktier?: number;
      kvotvarde?: number;
      aktiekapital?: number;
    };
    if (share?.antalAktier && share?.kvotvarde && share?.aktiekapital) {
      const computed = share.antalAktier * share.kvotvarde;
      const diff = Math.abs(computed - share.aktiekapital);
      if (diff / share.aktiekapital > 0.01) {
        warnings.push(
          `Share capital mismatch: ${share.antalAktier} × ${share.kvotvarde} = ${computed}, but registered aktiekapital = ${share.aktiekapital}`,
        );
      }
    }

    // Financial year sequence
    const fy = company.financialYear as {
      rakenskapsarInleds?: string;
      rakenskapsarAvslutas?: string;
    } | null;
    if (fy?.rakenskapsarInleds && fy?.rakenskapsarAvslutas) {
      if (new Date(fy.rakenskapsarInleds) >= new Date(fy.rakenskapsarAvslutas)) {
        errors.push(
          `Financial year start (${fy.rakenskapsarInleds}) is not before end (${fy.rakenskapsarAvslutas})`,
        );
      }
    }

    // Partial data flag
    const partial = (company.sourcePayloadSummary?.['partialDataFields'] as string[]) ?? [];
    if (partial.length > 0) {
      warnings.push(`Partial data detected in fields: ${partial.join(', ')}`);
    }

    return { isValid: errors.length === 0, errors, warnings };
  }
}
