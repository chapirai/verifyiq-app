import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { BolagsverketClient } from '../integrations/bolagsverket.client';
import { BolagsverketMapper, DEFAULT_COMPANY_NAME, NormalisedCompany } from '../integrations/bolagsverket.mapper';
import {
  AktiekapitalforandringResponse,
  ArendeResponse,
  BvOfficer,
  BvDokumentListaRequest,
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
import { randomUUID } from 'crypto';

/** Allowed tolerance when validating share-capital arithmetic (1 %). */
const SHARE_CAPITAL_TOLERANCE = 0.01;

/**
 * Number of external Bolagsverket API calls made by getCompleteCompanyData:
 * 1 × fetchHighValueDataset + 1 × fetchOrganisationInformation + 1 × fetchDocumentList.
 */
const ENRICH_API_CALL_COUNT = 3;

export interface CompleteCompanyProfile {
  normalisedData: NormalisedCompany;
  highValueDataset: HighValueDatasetResponse | null;
  organisationInformation: OrganisationInformationResponse[];
  documents: DocumentListResponse | null;
  retrievedAt: string;
  /** Request ID returned by the HVD API, if available. */
  hvdRequestId?: string | null;
  /** Request ID returned by the Företagsinformation v4 API, if available. */
  v4RequestId?: string | null;
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

  // ── Health ──────────────────────────────────────────────────────────────────

  async healthCheck(): Promise<{ status: string }> {
    return this.client.healthCheck();
  }

  async foretagsinfoHealthCheck(): Promise<{ status: string }> {
    return this.client.foretagsinfoHealthCheck();
  }

  async hvdIsAlive(context?: BvRequestContext): Promise<{ status: string }> {
    const response = await this.client.healthCheck();
    if (context?.tenantId) {
      void this.bvPersistenceService.storeEndpointPayload({
        tenantId: context.tenantId,
        organisationNumber: 'system',
        source: 'hvd.isalive',
        requestPayload: {},
        responsePayload: response as unknown as Record<string, unknown>,
        requestId: randomUUID(),
      });
    }
    return response;
  }

  async fiIsAlive(context?: BvRequestContext): Promise<{ status: string }> {
    const response = await this.client.foretagsinfoHealthCheck();
    if (context?.tenantId) {
      void this.bvPersistenceService.storeEndpointPayload({
        tenantId: context.tenantId,
        organisationNumber: 'system',
        source: 'fi.isalive',
        requestPayload: {},
        responsePayload: response as unknown as Record<string, unknown>,
        requestId: randomUUID(),
      });
    }
    return response;
  }

  async isAlive(): Promise<{ status: string }> {
    return this.healthCheck();
  }

  // ── Värdefulla datamängder (OAuth) ──────────────────────────────────────────

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
    const { responsePayload, requestId } = await this.client.fetchHighValueDataset(identitetsbeteckning, context);
    if (context?.tenantId) {
      void this.bvPersistenceService.storeEndpointPayload({
        tenantId: context.tenantId,
        organisationNumber: identitetsbeteckning,
        source: 'hvd.organisationer',
        requestPayload: { identitetsbeteckning },
        responsePayload: responsePayload as unknown as Record<string, unknown>,
        requestId: requestId ?? randomUUID(),
      });
    }
    return responsePayload;
  }

  /** dokumentId must be taken from the dokumentlista response only (unique per file; not configured in env). */
  async getDocument(dokumentId: string, context?: BvRequestContext): Promise<DocumentDownload> {
    const result = await this.client.fetchDocument(dokumentId, context);
    if (context?.tenantId) {
      void this.bvPersistenceService.storeEndpointPayload({
        tenantId: context.tenantId,
        organisationNumber: 'unknown',
        source: 'hvd.dokument',
        requestPayload: { dokumentId },
        responsePayload: {
          dokumentId,
          fileName: result.fileName,
          contentType: result.contentType,
          requestId: result.requestId,
        },
        requestId: result.requestId ?? randomUUID(),
      });
    }
    const safeDocumentId = sanitizeBolagsverketFilename(dokumentId) ?? 'document';
    return {
      data: result.responsePayload,
      contentType: result.contentType,
      fileName: result.fileName ?? `bolagsverket-${safeDocumentId}.zip`,
      requestId: result.requestId,
    };
  }

  // ── Complete company profile ─────────────────────────────────────────────────

  /**
   * Fetch high-value dataset + all organisational information in parallel,
   * then normalise into a single profile.
   */
  async getCompleteCompanyData(
    identitetsbeteckning: string,
    context?: BvRequestContext,
  ): Promise<CompleteCompanyProfile> {
    const [hvdResult, richResult, docResult] = await Promise.allSettled([
      this.client.fetchHighValueDataset(identitetsbeteckning, context),
      this.client.fetchOrganisationInformation(identitetsbeteckning, undefined, undefined, context),
      this.client.fetchDocumentList({ identitetsbeteckning }, context),
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

    return {
      normalisedData,
      highValueDataset,
      organisationInformation,
      documents,
      retrievedAt: new Date().toISOString(),
      hvdRequestId: hvdResult.status === 'fulfilled' ? (hvdResult.value.requestId ?? null) : null,
      v4RequestId: richResult.status === 'fulfilled' ? (richResult.value.requestId ?? null) : null,
    };
  }

  // ── Företagsinformation (organisation data) ─────────────────────────────────

  async getCompanyInformation(
    identitetsbeteckning: string,
    informationCategories?: string[],
    tidpunkt?: string,
    context?: BvRequestContext,
    namnskyddslopnummer?: string,
  ): Promise<OrganisationInformationResponse[]> {
    const { responsePayload, requestId } = await this.client.fetchOrganisationInformation(
      identitetsbeteckning,
      informationCategories,
      tidpunkt,
      context,
      namnskyddslopnummer,
    );
    if (context?.tenantId) {
      void this.bvPersistenceService.storeEndpointPayload({
        tenantId: context.tenantId,
        organisationNumber: identitetsbeteckning,
        source: 'fi.organisationer',
        requestPayload: { identitetsbeteckning, informationCategories, tidpunkt, namnskyddslopnummer },
        responsePayload: { organisationInformation: responsePayload } as Record<string, unknown>,
        requestId: requestId ?? randomUUID(),
      });
    }
    return responsePayload;
  }

  async getPersonInformation(
    identitetsbeteckning: string,
    context?: BvRequestContext,
    personInformationsmangd?: string[],
  ): Promise<PersonResponse> {
    const { responsePayload, requestId } = await this.client.fetchPersonInformation(
      identitetsbeteckning,
      context,
      personInformationsmangd,
    );
    if (context?.tenantId) {
      void this.bvPersistenceService.storeEndpointPayload({
        tenantId: context.tenantId,
        organisationNumber: identitetsbeteckning,
        source: 'fi.personer',
        requestPayload: { identitetsbeteckning, personInformationsmangd },
        responsePayload: responsePayload as unknown as Record<string, unknown>,
        requestId: requestId ?? randomUUID(),
      });
    }
    return responsePayload;
  }

  // ── Officers ────────────────────────────────────────────────────────────────

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

  // ── Financial snapshot ──────────────────────────────────────────────────────

  async getFinancialSnapshot(
    dokumentListaRequest: BvDokumentListaRequest,
    context?: BvRequestContext,
  ): Promise<FinancialSnapshot> {
    const identitetsbeteckning = dokumentListaRequest.identitetsbeteckning;
    const [richResult, docResult] = await Promise.allSettled([
      this.client.fetchOrganisationInformation(identitetsbeteckning, [
        'AKTIEINFORMATION',
        'RAKENSKAPSÅR',
        'FINANSIELLA_RAPPORTER',
      ], undefined, context),
      this.client.fetchDocumentList(dokumentListaRequest, context),
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

  async getSignatoryOptions(
    funktionarIdentitetsbeteckning: string,
    organisationIdentitetsbeteckning: string,
    context?: BvRequestContext,
  ): Promise<FirmateckningsalternativResponse> {
    const { responsePayload, requestId } = await this.client.verifySignatoryPower(
      funktionarIdentitetsbeteckning,
      organisationIdentitetsbeteckning,
      context,
    );
    if (context?.tenantId) {
      void this.bvPersistenceService.storeEndpointPayload({
        tenantId: context.tenantId,
        organisationNumber: organisationIdentitetsbeteckning,
        source: 'fi.firmateckningsalternativ',
        requestPayload: { funktionarIdentitetsbeteckning, organisationIdentitetsbeteckning },
        responsePayload: responsePayload as unknown as Record<string, unknown>,
        requestId: requestId ?? randomUUID(),
      });
    }
    return responsePayload;
  }

  // ── Share capital history ────────────────────────────────────────────────────

  async getShareCapitalChanges(
    identitetsbeteckning: string,
    fromdatum?: string,
    tomdatum?: string,
    context?: BvRequestContext,
  ): Promise<AktiekapitalforandringResponse> {
    const { responsePayload, requestId } = await this.client.fetchShareCapitalHistory(
      identitetsbeteckning,
      fromdatum,
      tomdatum,
      context,
    );
    if (context?.tenantId) {
      void this.bvPersistenceService.storeEndpointPayload({
        tenantId: context.tenantId,
        organisationNumber: identitetsbeteckning,
        source: 'fi.aktiekapitalforandringar',
        requestPayload: { identitetsbeteckning, fromdatum, tomdatum },
        responsePayload: responsePayload as unknown as Record<string, unknown>,
        requestId: requestId ?? randomUUID(),
      });
    }
    return responsePayload;
  }

  // ── Cases / arenden ──────────────────────────────────────────────────────────

  async getCases(
    arendenummer?: string,
    organisationIdentitetsbeteckning?: string,
    fromdatum?: string,
    tomdatum?: string,
    context?: BvRequestContext,
  ): Promise<ArendeResponse> {
    const { responsePayload, requestId } = await this.client.fetchArendeInformation(
      arendenummer,
      organisationIdentitetsbeteckning,
      fromdatum,
      tomdatum,
      context,
    );
    if (context?.tenantId) {
      void this.bvPersistenceService.storeEndpointPayload({
        tenantId: context.tenantId,
        organisationNumber: organisationIdentitetsbeteckning ?? arendenummer ?? 'unknown',
        source: 'fi.arenden',
        requestPayload: { arendenummer, organisationIdentitetsbeteckning, fromdatum, tomdatum },
        responsePayload: responsePayload as unknown as Record<string, unknown>,
        requestId: requestId ?? randomUUID(),
      });
    }
    return responsePayload;
  }

  // ── Engagements ──────────────────────────────────────────────────────────────

  async getOrganisationEngagements(
    identitetsbeteckning: string,
    pageNumber = 1,
    pageSize = 20,
    context?: BvRequestContext,
  ): Promise<OrganisationsengagemangResponse> {
    const { responsePayload, requestId } = await this.client.fetchOrganizationEngagements(
      identitetsbeteckning,
      pageNumber,
      pageSize,
      undefined,
      undefined,
      undefined,
      context,
    );
    if (context?.tenantId) {
      void this.bvPersistenceService.storeEndpointPayload({
        tenantId: context.tenantId,
        organisationNumber: identitetsbeteckning,
        source: 'fi.organisationsengagemang',
        requestPayload: { identitetsbeteckning, pageNumber, pageSize },
        responsePayload: responsePayload as unknown as Record<string, unknown>,
        requestId: requestId ?? randomUUID(),
      });
    }
    return responsePayload;
  }

  // ── Financial reports ────────────────────────────────────────────────────────

  async getFinancialReports(
    identitetsbeteckning: string,
    fromdatum?: string,
    tomdatum?: string,
    context?: BvRequestContext,
  ): Promise<FinansiellaRapporterResponse> {
    const { responsePayload, requestId } = await this.client.fetchFinancialReports(
      identitetsbeteckning,
      fromdatum,
      tomdatum,
      context,
    );
    if (context?.tenantId) {
      void this.bvPersistenceService.storeEndpointPayload({
        tenantId: context.tenantId,
        organisationNumber: identitetsbeteckning,
        source: 'fi.finansiella-rapporter',
        requestPayload: { identitetsbeteckning, fromdatum, tomdatum },
        responsePayload: responsePayload as unknown as Record<string, unknown>,
        requestId: requestId ?? randomUUID(),
      });
    }
    return responsePayload;
  }

  // ── Document list ────────────────────────────────────────────────────────────

  async getDocumentList(
    request: BvDokumentListaRequest,
    context?: BvRequestContext,
  ): Promise<DocumentListResponse> {
    const identitetsbeteckning = request.identitetsbeteckning;
    const { responsePayload, requestId, requestPayload } = await this.client.fetchDocumentList(request, context);
    if (context?.tenantId) {
      const documents = (responsePayload?.dokument ?? []) as Array<{
        dokumentId?: string;
        filformat?: string;
        rapporteringsperiodTom?: string;
        registreringstidpunkt?: string;
        dokumenttyp?: string;
      }>;
      void this.bvPersistenceService.storeDocumentList(
        context.tenantId,
        identitetsbeteckning,
        new Date(),
        documents,
        requestId ?? null,
        null,
      );
      void this.bvPersistenceService.storeEndpointPayload({
        tenantId: context.tenantId,
        organisationNumber: identitetsbeteckning,
        source: 'hvd.dokumentlista',
        requestPayload: requestPayload as unknown as Record<string, unknown>,
        responsePayload: responsePayload as unknown as Record<string, unknown>,
        requestId: requestId ?? randomUUID(),
      });
    }
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
    if (!company.legalName || company.legalName === DEFAULT_COMPANY_NAME) {
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
      if (diff / share.aktiekapital > SHARE_CAPITAL_TOLERANCE) {
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

  // ── Enrichment (cache-aware) ─────────────────────────────────────────────────

  /**
   * Fetch and persist a complete company profile, using cache when available.
   * Skips the Bolagsverket API if a fresh snapshot (< 30 days) already exists.
   *
   * @param correlationId  Request-scoped correlation ID for lineage tracing.
   * @param actorId        ID of the user/service that initiated the lookup.
   */
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

    // 1. Check cache — then evaluate against the configured policy
    if (!forceRefresh) {
      cacheCheck = await this.bvCacheService.checkFreshness(tenantId, identitetsbeteckning);
      if (cacheCheck.snapshot) {
        // Compute age in fractional hours for precise policy evaluation
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
          // decision === 'refresh_required' | 'provider_call' → fall through to live fetch
        } catch (policyErr) {
          // Policy evaluation failure: fall back to the hard-coded TTL behaviour
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
          // Update the snapshot record to reflect the current policy decision
          const updatedSnapshot = Object.assign(cacheCheck.snapshot, {
            policyDecision: policyDecisionLabel,
            isStaleFallback,
          });
          // Re-hydrate HVD + OrgInfo from the stored raw payload so the frontend
          // can render both API sections even when data is served from cache.
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
          const cachedResult: CompleteCompanyProfile = {
            normalisedData: cacheCheck.snapshot.normalisedSummary as unknown as NormalisedCompany,
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

    // 2. Fetch fresh data
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

    // 3. Persist normalised data
    try {
      const org = await this.bvPersistenceService.upsertOrganisation(tenantId, result.normalisedData, {
        highValueDataset: result.highValueDataset as unknown as Record<string, unknown>,
        organisationInformation: result.organisationInformation as unknown as Record<string, unknown>,
        documents: result.documents as unknown as Record<string, unknown>,
      });

      // 4. Store raw payload with checksum-based deduplication (P02-T02)
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
          // snapshotId will be backfilled after snapshot creation below
        });
        rawPayloadId = rawPayload.id;
      } catch (rawPayloadErr) {
        // Storage failure is non-blocking — snapshot creation continues
        this.logger.warn(
          `Raw payload storage failed for ${identitetsbeteckning} (tenant ${tenantId}): ${rawPayloadErr}`,
        );
      }

      // 5. Create snapshot record
      const snapshot = await this.bvCacheService.createSnapshot({
        tenantId,
        organisationId: org.id,
        organisationsnummer: identitetsbeteckning,
        identifierUsed: identitetsbeteckning,
        identifierType: 'organisationsnummer',
        fetchStatus,
        isFromCache: false,
        normalisedSummary: result.normalisedData as unknown as Record<string, unknown>,
        rawPayloadSummary: (result.normalisedData.sourcePayloadSummary as Record<string, unknown>) ?? {},
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

      // 5a. Store full HVD and Företagsinformation payloads in dedicated tables (best-effort).
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

      // 6. Link snapshot into version chain and trigger comparison (P02-T08)
      // Both operations are best-effort: failures must NOT block snapshot creation.
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
      const snapshot = await this.bvCacheService.createSnapshot({
        tenantId,
        organisationsnummer: identitetsbeteckning,
        identifierUsed: identitetsbeteckning,
        identifierType: 'organisationsnummer',
        fetchStatus: 'partial',
        isFromCache: false,
        normalisedSummary: result.normalisedData as unknown as Record<string, unknown>,
        rawPayloadSummary: (result.normalisedData.sourcePayloadSummary as Record<string, unknown>) ?? {},
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

  /**
   * Look up all organisations where a person holds officer positions,
   * with cache-aware freshness checking.
   *
   * @param correlationId  Request-scoped correlation ID for lineage tracing.
   * @param actorId        ID of the user/service that initiated the lookup.
   */
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
      await this.client.fetchOrganizationEngagements(personnummer);

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

  // ── P02-T08: Post-snapshot chain link and comparison ────────────────────────

  /**
   * Link a newly-created snapshot into the version chain, then trigger a
   * comparison against its predecessor.
   *
   * Runs asynchronously after snapshot creation — failures here must never
   * propagate to the caller.
   */
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
