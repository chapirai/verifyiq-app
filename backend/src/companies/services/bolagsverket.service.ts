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

/** Allowed tolerance when validating share-capital arithmetic (1 %). */
const SHARE_CAPITAL_TOLERANCE = 0.01;

/**
 * Number of external Bolagsverket API calls made by getCompleteCompanyData:
 * 1 × fetchHighValueDataset + 1 × fetchOrganisationInformation + 1 × fetchDocumentList.
 */
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
  /** Request ID returned by the HVD API, if available. */
  hvdRequestId?: string | null;
  /** Request ID returned by the Företagsinformation v4 API, if available. */
  v4RequestId?: string | null;
  /** Request ID returned by the document-list API, if available. */
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

  // ── Health ──────────────────────────────────────────────────────────────────

  async healthCheck(): Promise<{ status: string }> {
    return this.client.healthCheck();
  }

  async foretagsinfoHealthCheck(): Promise<{ status: string }> {
    return this.client.foretagsinfoHealthCheck();
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
    // Attach document list so it flows through to the lookup response
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

  // ── Företagsinformation (organisation data) ─────────────────────────────────
  // [NO CHANGE BELOW EXCEPT WHERE NOTED]

  // ... (rest of file unchanged until cache backfill section)

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
    // ... [unchanged code above]

          const cachedNormalisedData = cacheCheck.snapshot.normalisedSummary as unknown as NormalisedCompany;
          // Backfill documentList for cache entries that predate this field
          if (!cachedNormalisedData.documentList && cachedDocuments?.dokument?.length) {
            cachedNormalisedData.documentList = cachedDocuments.dokument;
          }
          // Backfill legal name if missing in cached snapshot
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

    // ... [unchanged code until snapshot creation]

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

      // ... [unchanged code]

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
      // ... [unchanged code]
    }
  }

  // ... [rest of file unchanged]
}
