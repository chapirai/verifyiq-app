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
} from '../integrations/bolagsverket.types';
import { BvCacheService } from './bv-cache.service';
import { BvPersistenceService } from './bv-persistence.service';
import { BvFetchSnapshotEntity } from '../entities/bv-fetch-snapshot.entity';
import { RawPayloadStorageService } from './raw-payload-storage.service';

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
    private readonly bvCacheService: BvCacheService,
    private readonly bvPersistenceService: BvPersistenceService,
    private readonly rawPayloadStorageService: RawPayloadStorageService,
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
    // 1. Check cache
    if (!forceRefresh) {
      const cacheCheck = await this.bvCacheService.checkFreshness(tenantId, identitetsbeteckning);
      if (cacheCheck.isFresh && cacheCheck.snapshot) {
        this.logger.log(
          `Cache hit for ${identitetsbeteckning} (age: ${cacheCheck.ageInDays} days)`,
        );
        const cachedResult: CompleteCompanyProfile = {
          normalisedData: cacheCheck.snapshot.normalisedSummary as unknown as NormalisedCompany,
          highValueDataset: null,
          organisationInformation: [],
          documents: null,
          retrievedAt: cacheCheck.snapshot.fetchedAt.toISOString(),
        };
        return {
          result: cachedResult,
          snapshot: cacheCheck.snapshot,
          isFromCache: true,
          ageInDays: cacheCheck.ageInDays,
        };
      }
    }

    // 2. Fetch fresh data
    let fetchStatus: 'success' | 'error' | 'partial' = 'success';
    let errorMessage: string | undefined;
    let result!: CompleteCompanyProfile;
    let apiCallCount = 0;

    try {
      result = await this.getCompleteCompanyData(identitetsbeteckning);
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
      throw err;
    }

    // 3. Persist normalised data
    try {
      const org = await this.bvPersistenceService.upsertOrganisation(tenantId, result.normalisedData, {
        highValueDataset: result.highValueDataset as unknown as Record<string, unknown>,
        organisationInformation: result.organisationInformation as unknown as Record<string, unknown>,
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

      return { result, snapshot, isFromCache: false, ageInDays: null };
    } catch (persistErr) {
      this.logger.warn(`Persistence failed for ${identitetsbeteckning}: ${persistErr}`);
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
}
