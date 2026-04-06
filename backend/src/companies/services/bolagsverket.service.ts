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
    const actor = actorId ?? null;
    const correlation = correlationId ?? null;
    const eventContext = {
      orgNumber: identitetsbeteckning,
      forceRefresh,
    };
    let cacheCheck: Awaited<ReturnType<BvCacheService['checkFreshness']>> | null = null;
    let policyDecisionLabel: SnapshotPolicyDecision | null = null;
    let isStaleFallback = false;
    let shouldServeCache = false;

    if (forceRefresh) {
      void this.auditService.emitAuditEvent({
        tenantId,
        userId: actor,
        eventType: AuditEventType.FORCE_REFRESH,
        action: 'company.refresh',
        status: 'requested',
        resourceId: identitetsbeteckning,
        correlationId: correlation,
        metadata: eventContext,
      });
    }

    if (!forceRefresh) {
      cacheCheck = await this.bvCacheService.checkFreshness(tenantId, identitetsbeteckning);
      if (cacheCheck.snapshot) {
        const ageInHours =
          (Date.now() - cacheCheck.snapshot.fetchedAt.getTime()) / (1000 * 60 * 60);

        policyDecisionLabel = 'cache_hit';
        isStaleFallback = false;
        shouldServeCache = false;

        try {
          const policyResult = await this.cachePolicyEvaluationService.evaluate(
            tenantId,
            ageInHours,
            {
              entityType: 'company',
              entityId: identitetsbeteckning,
              correlationId,
              actorId,
              orgNumber: identitetsbeteckning,
            },
          );

          if (policyResult.isFresh) {
            shouldServeCache = true;
            policyDecisionLabel = 'cache_hit';
          } else if (policyResult.decision === 'stale_serve') {
            shouldServeCache = true;
            policyDecisionLabel = 'stale_fallback';
            isStaleFallback = true;
          }
        } catch (policyErr) {
          this.logger.warn(
            `[P02-T04] Policy evaluation failed for ${identitetsbeteckning}; falling back to default freshness check. ${policyErr}`,
          );
          shouldServeCache = cacheCheck.isFresh;
          policyDecisionLabel = cacheCheck.isFresh ? 'cache_hit' : 'fresh_fetch';
        }

        if (shouldServeCache) {
          this.logger.log(
            `Cache hit for ${identitetsbeteckning} (age: ${cacheCheck.ageInDays} days, policy: ${policyDecisionLabel})`,
          );
          const cacheEventType = isStaleFallback
            ? AuditEventType.STALE_SERVED
            : AuditEventType.CACHE_HIT;
          const cacheStatus = isStaleFallback ? 'stale_served' : 'hit';
          void this.auditService.emitAuditEvent({
            tenantId,
            userId: actor,
            eventType: cacheEventType,
            action: 'company.cache',
            status: cacheStatus,
            resourceId: identitetsbeteckning,
            correlationId: correlation,
            metadata: {
              ...eventContext,
              cacheDecision: policyDecisionLabel,
              ageInDays: cacheCheck.ageInDays,
            },
          });
          const updatedSnapshot = Object.assign(cacheCheck.snapshot, {
            policyDecision: policyDecisionLabel,
            isStaleFallback,
          });
          let cachedHvd: HighValueDatasetResponse | null = null;
          let cachedOrgInfo: OrganisationInformationResponse[] = [];
          let cachedDocuments: DocumentListResponse | null = null;
          try {
            const org = await this.bvPersistenceService.findByOrgNr(tenantId, identitetsbeteckning);
            if (org?.rawPayload) {
              cachedHvd = (org.rawPayload['highValueDataset'] as HighValueDatasetResponse) ?? null;
              const rawOrgInfo = org.rawPayload['organisationInformation'];
              cachedOrgInfo = Array.isArray(rawOrgInfo)
                ? (rawOrgInfo as OrganisationInformationResponse[])
                : [];
              cachedDocuments = (org.rawPayload['documents'] as DocumentListResponse) ?? null;
            }
          } catch (lookupErr) {
            const detail = lookupErr instanceof Error ? lookupErr.message : String(lookupErr);
            this.logger.warn(
              `[cache] Failed to rehydrate raw payload for ${identitetsbeteckning} (tenant ${tenantId}): ${detail}`,
            );
          }
          const cachedNormalisedData = cacheCheck.snapshot.normalisedSummary as unknown as NormalisedCompany;
          if (!cachedNormalisedData.documentList && cachedDocuments?.dokument?.length) {
            cachedNormalisedData.documentList = cachedDocuments.dokument;
          }
          if (!cachedNormalisedData.legalName || cachedNormalisedData.legalName === DEFAULT_COMPANY_NAME) {
            const fallbackName = resolveLegalNameFromPayload(cachedHvd, cachedOrgInfo);
            if (fallbackName) cachedNormalisedData.legalName = fallbackName;
          }
          const cachedResult: CompleteCompanyProfile = {
            normalisedData: cachedNormalisedData,
            highValueDataset: cachedHvd,
            organisationInformation: cachedOrgInfo,
            documents: cachedDocuments,
            retrievedAt: cacheCheck.snapshot.fetchedAt.toISOString(),
          };
          return {
            result: cachedResult,
            snapshot: updatedSnapshot,
            isFromCache: true,
            ageInDays: cacheCheck.ageInDays,
          };
        }
        void this.auditService.emitAuditEvent({
          tenantId,
          userId: actor,
          eventType: AuditEventType.CACHE_MISS,
          action: 'company.cache',
          status: 'refresh_required',
          resourceId: identitetsbeteckning,
          correlationId: correlation,
          metadata: {
            ...eventContext,
            cacheDecision: policyDecisionLabel,
            ageInDays: cacheCheck.ageInDays,
          },
        });
      } else {
        void this.auditService.emitAuditEvent({
          tenantId,
          userId: actor,
          eventType: AuditEventType.CACHE_MISS,
          action: 'company.cache',
          status: 'no_snapshot',
          resourceId: identitetsbeteckning,
          correlationId: correlation,
          metadata: eventContext,
        });
      }
    }

    let fetchStatus: 'success' | 'error' | 'partial' = 'success';
    let errorMessage: string | undefined;
    let result!: CompleteCompanyProfile;
    let apiCallCount = 0;
    const triggerType = forceRefresh
      ? 'force_refresh'
      : cacheCheck?.snapshot
        ? 'stale_refresh'
        : 'cache_miss';

    void this.auditService.emitAuditEvent({
      tenantId,
      userId: actor,
      eventType: AuditEventType.REFRESH_INITIATED,
      action: 'company.refresh',
      status: 'initiated',
      resourceId: identitetsbeteckning,
      correlationId: correlation,
      metadata: {
        ...eventContext,
        triggerType,
        cacheDecision: policyDecisionLabel,
        providerCall: true,
      },
    });
    void this.auditService.emitAuditEvent({
      tenantId,
      userId: actor,
      eventType: AuditEventType.PROVIDER_CALLED,
      action: 'company.provider_call',
      status: 'started',
      resourceId: identitetsbeteckning,
      correlationId: correlation,
      costImpact: { apiCallCount: ENRICH_API_CALL_COUNT },
      metadata: {
        ...eventContext,
        triggerType,
      },
    });

    try {
      result = await this.getCompleteCompanyData(identitetsbeteckning, {
        tenantId,
        actorId,
        correlationId,
      });
      apiCallCount = ENRICH_API_CALL_COUNT;
    } catch (err) {
      fetchStatus = 'error';
      errorMessage = String(err);
      this.logger.error(`Enrichment failed for ${identitetsbeteckning}: ${err}`);
      try {
        await this.bvCacheService.createSnapshot({
          tenantId,
          organisationsnummer: identitetsbeteckning,
          identifierUsed: identitetsbeteckning,
          identifierType: 'organisationsnummer',
          fetchStatus: 'error',
          isFromCache: false,
          errorMessage,
          fetchedAt: new Date(),
          apiCallCount: 0,
          correlationId: correlationId ?? null,
          actorId: actorId ?? null,
          policyDecision: forceRefresh ? 'force_refresh' : 'fresh_fetch',
          costImpactFlags: {},
          isStaleFallback: false,
        });
      } catch (snapshotErr) {
        this.logger.error(`Failed to create error snapshot for ${identitetsbeteckning}: ${snapshotErr}`);
      }
      void this.auditService.emitAuditEvent({
        tenantId,
        userId: actor,
        eventType: AuditEventType.REFRESH_COMPLETED,
        action: 'company.refresh',
        status: 'error',
        resourceId: identitetsbeteckning,
        correlationId: correlation,
        costImpact: { apiCallCount: 0 },
        metadata: {
          ...eventContext,
          triggerType,
          resultStatus: 'error',
          error: errorMessage,
        },
      });
      throw err;
    }

    try {
      const org = await this.bvPersistenceService.upsertOrganisation(tenantId, result.normalisedData, {
        highValueDataset: result.highValueDataset as unknown as Record<string, unknown>,
        organisationInformation: result.organisationInformation as unknown as Record<string, unknown>,
        documents: result.documents as unknown as Record<string, unknown>,
      });

      let rawPayloadId: string | null = null;
      try {
        const rawContent: Record<string, unknown> = {
          highValueDataset: result.highValueDataset as unknown as Record<string, unknown>,
          organisationInformation: result.organisationInformation as unknown as Record<string, unknown>,
        };
        const { rawPayload } = await this.rawPayloadStorageService.storeRawPayload({
          tenantId,
          providerSource: 'bolagsverket',
          organisationsnummer: identitetsbeteckning,
          content: rawContent,
          metadata: {
            retrievedAt: result.retrievedAt,
            apiCallCount,
            correlationId: correlationId ?? null,
            actorId: actorId ?? null,
          },
          payloadVersion: '1',
        });
        rawPayloadId = rawPayload.id;
      } catch (rawPayloadErr) {
        this.logger.warn(
          `Raw payload storage failed for ${identitetsbeteckning} (tenant ${tenantId}): ${rawPayloadErr}`,
        );
      }

      const rawPayloadSummary = {
        ...(result.normalisedData.sourcePayloadSummary as Record<string, unknown> ?? {}),
        highValueDataset: result.highValueDataset as unknown as Record<string, unknown>,
        organisationInformation: result.organisationInformation as unknown as Record<string, unknown>,
        documents: result.documents as unknown as Record<string, unknown>,
      };

      const snapshot = await this.bvCacheService.createSnapshot({
        tenantId,
        organisationId: org.id,
        organisationsnummer: identitetsbeteckning,
        identifierUsed: identitetsbeteckning,
        identifierType: 'organisationsnummer',
        fetchStatus,
        isFromCache: false,
        normalisedSummary: result.normalisedData as unknown as Record<string, unknown>,
        rawPayloadSummary,
        fetchedAt: new Date(),
        apiCallCount,
        errorMessage,
        correlationId: correlationId ?? null,
        actorId: actorId ?? null,
        policyDecision: forceRefresh ? 'force_refresh' : 'fresh_fetch',
        costImpactFlags: { apiCallCharged: true, apiCallCount },
        isStaleFallback: false,
        rawPayloadId,
      });

      const fetchedAt = new Date();
      if (result.highValueDataset) {
        this.bvPersistenceService
          .storeHvdPayload(
            tenantId,
            identitetsbeteckning,
            fetchedAt,
            result.highValueDataset as unknown as Record<string, unknown>,
            result.hvdRequestId ?? null,
            snapshot.id,
          )
          .catch((err: unknown) =>
            this.logger.warn(`HVD payload storage failed for ${identitetsbeteckning}: ${err instanceof Error ? err.message : String(err)}`),
          );
      }
      if (result.organisationInformation?.length) {
        this.bvPersistenceService
          .storeForetagsinfoPayload(
            tenantId,
            identitetsbeteckning,
            fetchedAt,
            { organisationInformation: result.organisationInformation } as Record<string, unknown>,
            result.v4RequestId ?? null,
            snapshot.id,
          )
          .catch((err: unknown) =>
            this.logger.warn(`Företagsinformation payload storage failed for ${identitetsbeteckning}: ${err instanceof Error ? err.message : String(err)}`),
          );
      }
      if (result.documents?.dokument?.length) {
        this.bvPersistenceService
          .storeDocumentList(
            tenantId,
            identitetsbeteckning,
            fetchedAt,
            result.documents.dokument,
            result.docRequestId ?? null,
            snapshot.id,
          )
          .catch((err: unknown) =>
            this.logger.warn(`Document list storage failed for ${identitetsbeteckning}: ${err instanceof Error ? err.message : String(err)}`),
          );
      }

      this._linkAndCompareSnapshot(tenantId, snapshot.id, identitetsbeteckning).catch((err) =>
        this.logger.warn(
          `[P02-T08] Post-snapshot link/compare failed for ${identitetsbeteckning}: ${err}`,
        ),
      );

      void this.auditService.emitAuditEvent({
        tenantId,
        userId: actor,
        eventType: AuditEventType.REFRESH_COMPLETED,
        action: 'company.refresh',
        status: fetchStatus,
        resourceId: identitetsbeteckning,
        correlationId: correlation,
        costImpact: { apiCallCount },
        metadata: {
          ...eventContext,
          triggerType,
          resultStatus: fetchStatus,
          snapshotId: snapshot.id,
          apiCallCount,
        },
      });

      return { result, snapshot, isFromCache: false, ageInDays: null };
    } catch (persistErr) {
      const rawPayloadSummary = {
        ...(result.normalisedData.sourcePayloadSummary as Record<string, unknown> ?? {}),
        highValueDataset: result.highValueDataset as unknown as Record<string, unknown>,
        organisationInformation: result.organisationInformation as unknown as Record<string, unknown>,
        documents: result.documents as unknown as Record<string, unknown>,
      };

      const snapshot = await this.bvCacheService.createSnapshot({
        tenantId,
        organisationsnummer: identitetsbeteckning,
        identifierUsed: identitetsbeteckning,
        identifierType: 'organisationsnummer',
        fetchStatus: 'partial',
        isFromCache: false,
        normalisedSummary: result.normalisedData as unknown as Record<string, unknown>,
        rawPayloadSummary,
        fetchedAt: new Date(),
        apiCallCount,
        errorMessage: String(persistErr),
        correlationId: correlationId ?? null,
        actorId: actorId ?? null,
        policyDecision: forceRefresh ? 'force_refresh' : 'fresh_fetch',
        costImpactFlags: { apiCallCharged: true, apiCallCount },
        isStaleFallback: false,
      });
      void this.auditService.emitAuditEvent({
        tenantId,
        userId: actor,
        eventType: AuditEventType.REFRESH_COMPLETED,
        action: 'company.refresh',
        status: 'partial',
        resourceId: identitetsbeteckning,
        correlationId: correlation,
        costImpact: { apiCallCount },
        metadata: {
          ...eventContext,
          triggerType,
          resultStatus: 'partial',
          snapshotId: snapshot.id,
          apiCallCount,
          error: String(persistErr),
        },
      });
      return { result, snapshot, isFromCache: false, ageInDays: null };
    }
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
