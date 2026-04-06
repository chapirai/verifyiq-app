import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { BolagsverketClient } from '../integrations/bolagsverket.client';
import { BolagsverketMapper, DEFAULT_COMPANY_NAME, NormalisedCompany } from '../integrations/bolagsverket.mapper';
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
  PersonResponse,
} from '../integrations/bolagsverket.types';
import { sanitizeBolagsverketFilename } from '../integrations/bolagsverket.utils';
import { BvCacheService } from './bv-cache.service';
import { BvPersistenceService } from './bv-persistence.service';
import { BvFetchSnapshotEntity, SnapshotPolicyDecision } from '../entities/bv-fetch-snapshot.entity';
import { RawPayloadStorageService } from './raw-payload-storage.service';
import { CachePolicyEvaluationService } from './cache-policy-evaluation.service';
import { SnapshotChainService } from './snapshot-chain.service';
import { SnapshotComparisonService } from './snapshot-comparison.service';
import { AuditEventType } from '../../audit/audit-event.entity';
import { AuditService } from '../../audit/audit.service';

const SHARE_CAPITAL_TOLERANCE = 0.01;
const ENRICH_API_CALL_COUNT = 3;

function extractLegalNameFromHvd(hvd?: HighValueDatasetResponse | null): string | null {
  const org = hvd?.organisation ?? hvd?.organisationer?.[0];
  if (!org) return null;
  return (
    org.namn ??
    org.organisationsnamnLista?.find((n) => !n.fel && n.namn)?.namn ??
    null
  );
}

function extractLegalNameFromV4(info?: OrganisationInformationResponse[] | null): string | null {
  const org = info?.[0];
  if (!org) return null;
  return (
    org.namn ??
    org.samtligaOrganisationsnamn?.find((n) => !n.fel && n.namn)?.namn ??
    null
  );
}

function resolveLegalNameFromPayload(
  hvd?: HighValueDatasetResponse | null,
  orgInfo?: OrganisationInformationResponse[] | null,
): string | null {
  return extractLegalNameFromHvd(hvd) ?? extractLegalNameFromV4(orgInfo);
}

export interface CompleteCompanyProfile {
  normalisedData: NormalisedCompany;
  highValueDataset: HighValueDatasetResponse | null;
  organisationInformation: OrganisationInformationResponse[];
  documents: DocumentListResponse | null;
  retrievedAt: string;
  hvdRequestId?: string | null;
  v4RequestId?: string | null;
  docRequestId?: string | null;
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

export interface DocumentDownload {
  data: Buffer;
  contentType: string;
  fileName: string;
  requestId: string;
}

export interface DataValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
}

interface BvRequestContext {
  tenantId: string;
  actorId?: string | null;
  correlationId?: string | null;
}

@Injectable()
export class BolagsverketService {
  private readonly logger = new Logger(BolagsverketService.name);

  constructor(
    private readonly client: BolagsverketClient,
    private readonly mapper: BolagsverketMapper,
    private readonly bvCacheService: BvCacheService,
    private readonly bvPersistenceService: BvPersistenceService,
    private readonly rawPayloadStorageService: RawPayloadStorageService,
    private readonly cachePolicyEvaluationService: CachePolicyEvaluationService,
    private readonly snapshotChainService: SnapshotChainService,
    private readonly snapshotComparisonService: SnapshotComparisonService,
    private readonly auditService: AuditService,
  ) {}

  async healthCheck(): Promise<{ status: string }> {
    return this.client.healthCheck();
  }

  async foretagsinfoHealthCheck(): Promise<{ status: string }> {
    return this.client.foretagsinfoHealthCheck();
  }

  async isAlive(): Promise<{ status: string }> {
    return this.healthCheck();
  }

  async getAccessToken(): Promise<string> {
    return this.client.getAccessToken();
  }

  getTokenCacheStatus() {
    return this.client.getTokenCacheStatus();
  }

  async revokeAccessToken(): Promise<{ revoked: boolean; error?: string }> {
    return this.client.revokeAccessToken();
  }

  async getHighValueCompanyInformation(
    identitetsbeteckning: string,
    context?: BvRequestContext,
  ): Promise<HighValueDatasetResponse> {
    const { responsePayload } = await this.client.fetchHighValueDataset(identitetsbeteckning, context);
    return responsePayload;
  }

  async getDocument(dokumentId: string, context?: BvRequestContext): Promise<DocumentDownload> {
    const result = await this.client.fetchDocument(dokumentId, context);
    const safeDocumentId = sanitizeBolagsverketFilename(dokumentId) ?? 'document';
    return {
      data: result.responsePayload,
      contentType: result.contentType,
      fileName: result.fileName ?? `bolagsverket-${safeDocumentId}.zip`,
      requestId: result.requestId,
    };
  }

  async getCompleteCompanyData(
    identitetsbeteckning: string,
    context?: BvRequestContext,
  ): Promise<CompleteCompanyProfile> {
    const [hvdResult, richResult, docResult] = await Promise.allSettled([
      this.client.fetchHighValueDataset(identitetsbeteckning, context),
      this.client.fetchOrganisationInformation(identitetsbeteckning, undefined, undefined, context),
      this.client.fetchDocumentList(identitetsbeteckning, context),
    ]);

    const highValueDataset =
      hvdResult.status === 'fulfilled' ? hvdResult.value.responsePayload : null;
    const organisationInformation =
      richResult.status === 'fulfilled' ? richResult.value.responsePayload : [];
    const documents =
      docResult.status === 'fulfilled' ? docResult.value.responsePayload : null;

    const failedDatasets: string[] = [];
    if (hvdResult.status === 'rejected') {
      this.logger.warn(`fetchHighValueDataset failed for ${identitetsbeteckning}: ${hvdResult.reason}`);
      failedDatasets.push(`highValueDataset: ${hvdResult.reason}`);
    }
    if (richResult.status === 'rejected') {
      this.logger.warn(`fetchOrganisationInformation failed for ${identitetsbeteckning}: ${richResult.reason}`);
      failedDatasets.push(`organisationInformation: ${richResult.reason}`);
    }
    if (docResult.status === 'rejected') {
      this.logger.warn(`fetchDocumentList failed for ${identitetsbeteckning}: ${docResult.reason}`);
      failedDatasets.push(`documentList: ${docResult.reason}`);
    }

    if (failedDatasets.length === 3) {
      throw new BadGatewayException(
        `All Bolagsverket API calls failed for ${identitetsbeteckning}: ${failedDatasets.join('; ')}`,
      );
    }

    if (failedDatasets.length > 0) {
      this.logger.warn(
        `Partial Bolagsverket data for ${identitetsbeteckning}: ${failedDatasets.length}/3 datasets unavailable`,
      );
    }

    const normalisedData = this.mapper.map(highValueDataset, organisationInformation, identitetsbeteckning);
    normalisedData.documentList = documents?.dokument?.length ? documents.dokument : null;

    const docRequestId = docResult.status === 'fulfilled' ? (docResult.value.requestId ?? null) : null;

    return {
      normalisedData,
      highValueDataset,
      organisationInformation,
      documents,
      retrievedAt: new Date().toISOString(),
      hvdRequestId: hvdResult.status === 'fulfilled' ? (hvdResult.value.requestId ?? null) : null,
      v4RequestId: richResult.status === 'fulfilled' ? (richResult.value.requestId ?? null) : null,
      docRequestId,
    };
  }

  async getCompanyInformation(
    identitetsbeteckning: string,
    informationCategories?: string[],
    tidpunkt?: string,
    context?: BvRequestContext,
  ): Promise<OrganisationInformationResponse[]> {
    const { responsePayload } = await this.client.fetchOrganisationInformation(
      identitetsbeteckning,
      informationCategories,
      tidpunkt,
      context,
    );
    return responsePayload;
  }

  async getPersonInformation(
    identitetsbeteckning: string,
    context?: BvRequestContext,
  ): Promise<PersonResponse> {
    const { responsePayload } = await this.client.fetchPersonInformation(
      identitetsbeteckning,
      context,
    );
    return responsePayload;
  }

  async getOfficerInformation(
    identitetsbeteckning: string,
    officerType: 'all' | 'signatories' | 'board' = 'all',
    context?: BvRequestContext,
  ): Promise<OfficerProfile[]> {
    const { responsePayload } = await this.client.fetchOrganisationInformation(
      identitetsbeteckning,
      ['FUNKTIONARER', 'FIRMATECKNING'],
      undefined,
      context,
    );
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

  async getSignatoryOptions(
    funktionarIdentitetsbeteckning: string,
    organisationIdentitetsbeteckning: string,
    context?: BvRequestContext,
  ): Promise<FirmateckningsalternativResponse> {
    const { responsePayload } = await this.client.verifySignatoryPower(
      funktionarIdentitetsbeteckning,
      organisationIdentitetsbeteckning,
      context,
    );
    return responsePayload;
  }

  async getShareCapitalChanges(
    identitetsbeteckning: string,
    fromdatum?: string,
    tomdatum?: string,
    context?: BvRequestContext,
  ): Promise<AktiekapitalforandringResponse> {
    const { responsePayload } = await this.client.fetchShareCapitalHistory(
      identitetsbeteckning,
      fromdatum,
      tomdatum,
      context,
    );
    return responsePayload;
  }

  async getCases(
    arendenummer?: string,
    organisationIdentitetsbeteckning?: string,
    fromdatum?: string,
    tomdatum?: string,
    context?: BvRequestContext,
  ): Promise<ArendeResponse> {
    const { responsePayload } = await this.client.fetchArendeInformation(
      arendenummer,
      organisationIdentitetsbeteckning,
      fromdatum,
      tomdatum,
      context,
    );
    return responsePayload;
  }

  async getOrganisationEngagements(
    identitetsbeteckning: string,
    pageNumber = 1,
    pageSize = 20,
    context?: BvRequestContext,
  ): Promise<OrganisationsengagemangResponse> {
    const { responsePayload } = await this.client.fetchOrganizationEngagements(
      identitetsbeteckning,
      pageNumber,
      pageSize,
      undefined,
      undefined,
      undefined,
      context,
    );
    return responsePayload;
  }

  async getFinancialReports(
    identitetsbeteckning: string,
    fromdatum?: string,
    tomdatum?: string,
    context?: BvRequestContext,
  ): Promise<FinansiellaRapporterResponse> {
    const { responsePayload } = await this.client.fetchFinancialReports(
      identitetsbeteckning,
      fromdatum,
      tomdatum,
      context,
    );
    return responsePayload;
  }

  async getDocumentList(
    identitetsbeteckning: string,
    context?: BvRequestContext,
  ): Promise<DocumentListResponse> {
    const { responsePayload } = await this.client.fetchDocumentList(identitetsbeteckning, context);
    return responsePayload;
  }

  async getFinancialSnapshot(
    identitetsbeteckning: string,
    context?: BvRequestContext,
  ): Promise<FinancialSnapshot> {
    const [richResult, docResult] = await Promise.allSettled([
      this.client.fetchOrganisationInformation(identitetsbeteckning, [
        'AKTIEINFORMATION',
        'RAKENSKAPSÅR',
        'FINANSIELLA_RAPPORTER',
      ], undefined, context),
      this.client.fetchDocumentList(identitetsbeteckning, context),
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

  validateCompanyData(company: NormalisedCompany): DataValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!company.organisationNumber) {
      errors.push('Missing organisationNumber');
    }
    if (!company.legalName || company.legalName === DEFAULT_COMPANY_NAME) {
      warnings.push('Legal name is missing or unknown');
    }

    const share = company.shareInformation as {
      antalAktier?: number;
      kvotvarde?: number;
      aktiekapital?: number;
    };
    if (share?.antalAktier && share?.kvotvarde && share?.aktiekapital) {
      const computed = share.antalAktier * share.kvotvarde;
      const diff = Math.abs(computed - share.aktiekapital);
      if (diff / share.aktiekapital > SHARE_CAPITAL_TOLERANCE) {
        warnings.push(
          `Share capital mismatch: ${share.antalAktier} × ${share.kvotvarde} = ${computed}, but registered aktiekapital = ${share.aktiekapital}`,
        );
      }
    }

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

    const partial = (company.sourcePayloadSummary?.['partialDataFields'] as string[]) ?? [];
    if (partial.length > 0) {
      warnings.push(`Partial data detected in fields: ${partial.join(', ')}`);
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  async enrichAndSave(
    tenantId: string,
    identitetsbeteckning: string,
    forceRefresh = false,
    correlationId?: string | null,
    actorId?: string | null,
  ): Promise<{
    result: CompleteCompanyProfile;
    snapshot: BvFetchSnapshotEntity;
    isFromCache: boolean;
    ageInDays: number | null;
  }> {
    // ... (unchanged code from your current file) ...
    // KEEP your existing enrichAndSave implementation here.
    // This block is omitted only to keep this response readable.
  }

  async enrichPersonEngagements(
    tenantId: string,
    personnummer: string,
    forceRefresh = false,
    correlationId?: string | null,
    actorId?: string | null,
  ): Promise<{
    engagements: OrganisationsengagemangResponse;
    snapshot: BvFetchSnapshotEntity;
    isFromCache: boolean;
    ageInDays: number | null;
  }> {
    if (!forceRefresh) {
      const cacheCheck = await this.bvCacheService.checkFreshness(tenantId, personnummer);
      if (cacheCheck.isFresh && cacheCheck.snapshot) {
        return {
          engagements: cacheCheck.snapshot.normalisedSummary as unknown as OrganisationsengagemangResponse,
          snapshot: cacheCheck.snapshot,
          isFromCache: true,
          ageInDays: cacheCheck.ageInDays,
        };
      }
    }

    const { responsePayload: engagements } =
      await this.client.fetchOrganizationEngagements(personnummer, 1, 20, undefined, undefined, undefined, {
        tenantId,
        actorId,
        correlationId,
      });

    const snapshot = await this.bvCacheService.createSnapshot({
      tenantId,
      organisationsnummer: personnummer,
      identifierUsed: personnummer,
      identifierType: 'personnummer',
      fetchStatus: 'success',
      isFromCache: false,
      normalisedSummary: engagements as unknown as Record<string, unknown>,
      rawPayloadSummary: {},
      fetchedAt: new Date(),
      apiCallCount: 1,
      correlationId: correlationId ?? null,
      actorId: actorId ?? null,
      policyDecision: forceRefresh ? 'force_refresh' : 'fresh_fetch',
      costImpactFlags: { apiCallCharged: true, apiCallCount: 1 },
      isStaleFallback: false,
    });

    return { engagements, snapshot, isFromCache: false, ageInDays: null };
  }

  private async _linkAndCompareSnapshot(
    tenantId: string,
    snapshotId: string,
    organisationsnummer: string,
  ): Promise<void> {
    const linked = await this.snapshotChainService.linkSnapshot(
      tenantId,
      snapshotId,
      organisationsnummer,
    );
    await this.snapshotComparisonService.compareSnapshots(
      tenantId,
      linked.id,
      linked.previousSnapshotId ?? null,
    );
  }
}
