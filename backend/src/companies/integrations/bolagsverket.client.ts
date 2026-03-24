import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { randomUUID } from 'crypto';
import {
  ALL_INFORMATION_CATEGORIES,
  AktiekapitalforandringResponse,
  ArendeResponse,
  BvFiltrering,
  BvPaginering,
  BvSortering,
  DocumentListResponse,
  FinansiellaRapporterResponse,
  FirmateckningsalternativResponse,
  HighValueDatasetResponse,
  OrganisationInformationResponse,
  OrganisationsengagemangResponse,
  SortAttributeEngagemang,
  SortOrder,
} from './bolagsverket.types';

/**
 * Status codes that are safe to retry after a transient failure.
 * 408 = Request Timeout, 429 = Too Many Requests (rate limit),
 * 500/502/503/504 = transient server-side errors.
 */
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

/** Retry configuration: exponential back-off. */
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1_000,
  backoffMultiplier: 2,
  maxDelayMs: 30_000,
} as const;

const HVD_BASE_URL = 'https://gw.api.bolagsverket.se/vardefulla-datamangder/v1';
const ORG_BASE_URL = 'https://gw.api.bolagsverket.se/foretagsinformation/v4';

@Injectable()
export class BolagsverketClient {
  private readonly logger = new Logger(BolagsverketClient.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  // ── Internal helpers ──────────────────────────────────────────────────────

  private buildHeaders(): Record<string, string> {
    const clientId = this.configService.get<string>('BV_CLIENT_ID') ?? '';
    const clientSecret = this.configService.get<string>('BV_CLIENT_SECRET') ?? '';
    return {
      'content-type': 'application/json',
      'x-client-id': clientId,
      'x-client-secret': clientSecret,
      'x-request-id': randomUUID(),
    };
  }

  private mapError(status?: number, requestId?: string): never {
    const base = requestId ? ` (requestId: ${requestId})` : '';
    if (status === 400) throw new BadRequestException(`Bolagsverket rejected the request${base}`);
    if (status === 401) throw new UnauthorizedException(`Bolagsverket authentication failed${base}`);
    if (status === 403) throw new ForbiddenException(`Bolagsverket access forbidden${base}`);
    throw new InternalServerErrorException(`Bolagsverket request failed${base}`);
  }

  /** Executes an HTTP call with exponential back-off retry for transient errors. */
  private async requestWithRetry<T>(
    method: 'get' | 'post',
    url: string,
    payload?: unknown,
  ): Promise<{ responseData: T; requestId: string }> {
    let attempt = 0;
    let retryDelayMs: number = RETRY_CONFIG.initialDelayMs;

    while (true) {
      const headers = this.buildHeaders();
      const requestId = headers['x-request-id'];
      try {
        const observable =
          method === 'get'
            ? this.httpService.get<T>(url, { headers })
            : this.httpService.post<T>(url, payload, { headers });

        const response = await firstValueFrom(observable);
        return { responseData: response.data, requestId };
      } catch (error: any) {
        const status: number | undefined = error?.response?.status;
        const isRetryable = status !== undefined && RETRYABLE_STATUS_CODES.has(status);

        if (isRetryable && attempt < RETRY_CONFIG.maxRetries) {
          attempt++;
          this.logger.warn(
            `Bolagsverket ${url} failed with ${status} – retry ${attempt}/${RETRY_CONFIG.maxRetries} in ${retryDelayMs}ms`,
          );
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
          retryDelayMs = Math.min(retryDelayMs * RETRY_CONFIG.backoffMultiplier, RETRY_CONFIG.maxDelayMs);
          continue;
        }

        this.mapError(status, requestId);
      }
    }
  }

  /** Wrap a value in an array if it is not already one. */
  private ensureArray<T>(data: T | T[]): T[] {
    return Array.isArray(data) ? data : [data];
  }

  // ── Public API methods ────────────────────────────────────────────────────

  /** GET /isalive – verify API availability before making data requests. */
  async healthCheck(): Promise<{ status: string }> {
    const { responseData } = await this.requestWithRetry<string>('get', `${HVD_BASE_URL}/isalive`);
    return { status: responseData === 'OK' ? 'OK' : 'UNKNOWN' };
  }

  /** POST /vardefulla-datamangder/v1/organisationer – high-value dataset. */
  async fetchHighValueDataset(identitetsbeteckning: string): Promise<{
    requestPayload: { identitetsbeteckning: string };
    responsePayload: HighValueDatasetResponse;
    requestId: string;
  }> {
    const payload = { identitetsbeteckning };
    const { responseData, requestId } = await this.requestWithRetry<HighValueDatasetResponse>(
      'post',
      `${HVD_BASE_URL}/organisationer`,
      payload,
    );
    return { requestPayload: payload, responsePayload: responseData, requestId };
  }

  /** POST /vardefulla-datamangder/v1/dokumentlista – retrieve available documents. */
  async fetchDocumentList(identitetsbeteckning: string): Promise<{
    requestPayload: { identitetsbeteckning: string };
    responsePayload: DocumentListResponse;
    requestId: string;
  }> {
    const payload = { identitetsbeteckning };
    const { responseData, requestId } = await this.requestWithRetry<DocumentListResponse>(
      'post',
      `${HVD_BASE_URL}/dokumentlista`,
      payload,
    );
    return { requestPayload: payload, responsePayload: responseData, requestId };
  }

  /**
   * POST /foretagsinformation/v4/organisationsinformation
   * Retrieves organisation information for the specified categories.
   * Defaults to ALL available categories when none are specified.
   */
  async fetchOrganisationInformation(
    identitetsbeteckning: string,
    informationCategories: string[] = [...ALL_INFORMATION_CATEGORIES],
    tidpunkt?: string,
  ): Promise<{
    requestPayload: Record<string, unknown>;
    responsePayload: OrganisationInformationResponse[];
    requestId: string;
  }> {
    const payload: Record<string, unknown> = {
      identitetsbeteckning,
      organisationInformationsmangd: informationCategories,
    };
    if (tidpunkt) {
      payload['tidpunkt'] = tidpunkt;
    }
    const { responseData, requestId } = await this.requestWithRetry<OrganisationInformationResponse[]>(
      'post',
      `${ORG_BASE_URL}/organisationsinformation`,
      payload,
    );
    const responseArray = this.ensureArray(responseData);
    return { requestPayload: payload, responsePayload: responseArray, requestId };
  }

  /**
   * POST /foretagsinformation/v4/arenden
   * Fetch case/arende information by arende number OR by organisation + date range.
   */
  async fetchArendeInformation(
    arendenummer?: string,
    organisationIdentitetsbeteckning?: string,
    fromdatum?: string,
    tomdatum?: string,
  ): Promise<{
    requestPayload: Record<string, unknown>;
    responsePayload: ArendeResponse;
    requestId: string;
  }> {
    const payload: Record<string, unknown> = {};
    if (arendenummer) payload['arendenummer'] = arendenummer;
    if (organisationIdentitetsbeteckning) payload['organisationIdentitetsbeteckning'] = organisationIdentitetsbeteckning;
    if (fromdatum) payload['fromdatum'] = fromdatum;
    if (tomdatum) payload['tomdatum'] = tomdatum;

    const { responseData, requestId } = await this.requestWithRetry<ArendeResponse>(
      'post',
      `${ORG_BASE_URL}/arenden`,
      payload,
    );
    const responseArray = this.ensureArray(responseData);
    return { requestPayload: payload, responsePayload: responseArray, requestId };
  }

  /**
   * POST /foretagsinformation/v4/firmateckningsalternativ
   * Verify if a person/organisation has signatory authority for a given organisation.
   */
  async verifySignatoryPower(
    funktionarIdentitetsbeteckning: string,
    organisationIdentitetsbeteckning: string,
  ): Promise<{
    requestPayload: Record<string, unknown>;
    responsePayload: FirmateckningsalternativResponse;
    requestId: string;
  }> {
    const payload = { funktionarIdentitetsbeteckning, organisationIdentitetsbeteckning };
    const { responseData, requestId } = await this.requestWithRetry<FirmateckningsalternativResponse>(
      'post',
      `${ORG_BASE_URL}/firmateckningsalternativ`,
      payload,
    );
    return { requestPayload: payload, responsePayload: responseData, requestId };
  }

  /**
   * POST /foretagsinformation/v4/aktiekapitalforandringar
   * Retrieve full share capital change history for an organisation.
   */
  async fetchShareCapitalHistory(
    identitetsbeteckning: string,
    fromdatum?: string,
    tomdatum?: string,
  ): Promise<{
    requestPayload: Record<string, unknown>;
    responsePayload: AktiekapitalforandringResponse;
    requestId: string;
  }> {
    const payload: Record<string, unknown> = { identitetsbeteckning };
    if (fromdatum) payload['fromdatum'] = fromdatum;
    if (tomdatum) payload['tomdatum'] = tomdatum;

    const { responseData, requestId } = await this.requestWithRetry<AktiekapitalforandringResponse>(
      'post',
      `${ORG_BASE_URL}/aktiekapitalforandringar`,
      payload,
    );
    return { requestPayload: payload, responsePayload: responseData, requestId };
  }

  /**
   * POST /foretagsinformation/v4/organisationsengagemang
   * Find all organisations where a person/organisation holds officer positions.
   */
  async fetchOrganizationEngagements(
    identitetsbeteckning: string,
    pageNumber = 1,
    pageSize = 20,
    sortAttribute?: SortAttributeEngagemang,
    sortOrder?: SortOrder,
    filters?: BvFiltrering,
  ): Promise<{
    requestPayload: Record<string, unknown>;
    responsePayload: OrganisationsengagemangResponse;
    requestId: string;
  }> {
    const paginering: BvPaginering = { sida: pageNumber, antalPerSida: pageSize };
    const payload: Record<string, unknown> = { identitetsbeteckning, paginering };
    if (sortAttribute && sortOrder) {
      const sortering: BvSortering = { sorteringsattribut: sortAttribute, sorteringsordning: sortOrder };
      payload['sortering'] = sortering;
    }
    if (filters) {
      payload['filtrering'] = filters;
    }

    const { responseData, requestId } = await this.requestWithRetry<OrganisationsengagemangResponse>(
      'post',
      `${ORG_BASE_URL}/organisationsengagemang`,
      payload,
    );
    return { requestPayload: payload, responsePayload: responseData, requestId };
  }

  /**
   * POST /foretagsinformation/v4/finansiellarapporter
   * Retrieve financial reports for an organisation.
   */
  async fetchFinancialReports(
    identitetsbeteckning: string,
    fromdatum?: string,
    tomdatum?: string,
  ): Promise<{
    requestPayload: Record<string, unknown>;
    responsePayload: FinansiellaRapporterResponse;
    requestId: string;
  }> {
    const payload: Record<string, unknown> = { identitetsbeteckning };
    if (fromdatum) payload['fromdatum'] = fromdatum;
    if (tomdatum) payload['tomdatum'] = tomdatum;

    const { responseData, requestId } = await this.requestWithRetry<FinansiellaRapporterResponse>(
      'post',
      `${ORG_BASE_URL}/finansiellarapporter`,
      payload,
    );
    return { requestPayload: payload, responsePayload: responseData, requestId };
  }
}
