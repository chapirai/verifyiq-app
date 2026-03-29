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
import { z } from 'zod';
import { AxiosRequestConfig } from 'axios';
import { sanitizeBolagsverketFilename } from './bolagsverket.utils';
import {
  ALL_INFORMATION_CATEGORIES,
  AktiekapitalforandringResponse,
  ArendeResponse,
  BvApiError,
  BvFiltrering,
  BvPaginering,
  BvSortering,
  DocumentListResponse,
  FinansiellaRapporterResponse,
  FirmateckningsalternativResponse,
  HighValueDatasetResponse,
  OrganisationInformationResponse,
  OrganisationsengagemangResponse,
  OAuthTokenResponse,
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
const DEFAULT_HVD_SCOPES = 'vardefulla-datamangder:read vardefulla-datamangder:ping';
const DEFAULT_FORETAGSINFO_SCOPE = 'foretagsinformation:read';
/**
 * Bolagsverket's OAuth2 token endpoint lives on portal.api.bolagsverket.se,
 * which is separate from the data-gateway host (gw.api.bolagsverket.se).
 */
const DEFAULT_TOKEN_URL = 'https://portal.api.bolagsverket.se/oauth2/token';
const DEFAULT_HVD_DOCUMENT_PATH = '/dokument';
const TOKEN_REFRESH_SKEW_MS = 60_000;

/** Shape of a cached access token entry. */
interface TokenCacheEntry {
  accessToken: string;
  expiresAt: number;
  scope?: string;
  tokenType?: string;
}

@Injectable()
export class BolagsverketClient {
  private readonly logger = new Logger(BolagsverketClient.name);
  /** Token cache for Värdefulla Datamängder (HVD) API. */
  private hvdTokenCache: TokenCacheEntry | null = null;
  private tokenRequest: Promise<string> | null = null;
  /** Token cache for Företagsinformation API when OAuth2 is used. */
  private foretagsinfoTokenCache: TokenCacheEntry | null = null;
  private foretagsinfoTokenRequest: Promise<string> | null = null;
  private warnedLegacyAuth = false;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  // ── Internal helpers ──────────────────────────────────────────────────────

  private normalizeBaseUrl(url: string): string {
    return url.endsWith('/') ? url.slice(0, -1) : url;
  }

  private buildUrl(baseUrl: string, path: string): string {
    const normalizedBase = this.normalizeBaseUrl(baseUrl);
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${normalizedBase}${normalizedPath}`;
  }

  private getHvdBaseUrl(): string {
    return this.configService.get<string>('BV_HVD_BASE_URL') ?? HVD_BASE_URL;
  }

  private getOrganisationBaseUrl(): string {
    return this.configService.get<string>('BV_FORETAGSINFO_BASE_URL') ?? ORG_BASE_URL;
  }

  private getHvdTokenUrl(): string {
    const configured = this.configService.get<string>('BV_HVD_TOKEN_URL');
    if (configured) return configured;
    // Fall back to the shared Bolagsverket token endpoint on the portal subdomain.
    // NOTE: The token endpoint is on portal.api.bolagsverket.se, NOT on the data
    // gateway host (gw.api.bolagsverket.se). Using BV_HVD_BASE_URL would produce
    // the wrong URL, so we always default to DEFAULT_TOKEN_URL here.
    return DEFAULT_TOKEN_URL;
  }

  private getHvdRevokeUrl(): string | null {
    return this.configService.get<string>('BV_HVD_REVOKE_URL') ?? null;
  }

  private getHvdScopes(): string {
    return this.configService.get<string>('BV_HVD_SCOPES') ?? DEFAULT_HVD_SCOPES;
  }

  private getHvdClientId(): string {
    const clientId =
      this.configService.get<string>('BV_HVD_CLIENT_ID') ??
      this.configService.get<string>('BV_CLIENT_ID');
    if (!clientId) {
      throw new UnauthorizedException('Bolagsverket OAuth client ID is missing');
    }
    return clientId;
  }

  private getHvdClientSecret(): string {
    const clientSecret =
      this.configService.get<string>('BV_HVD_CLIENT_SECRET') ??
      this.configService.get<string>('BV_CLIENT_SECRET');
    if (!clientSecret) {
      throw new UnauthorizedException('Bolagsverket OAuth client secret is missing');
    }
    return clientSecret;
  }

  /**
   * Returns the OAuth2 token URL to use for Företagsinformation.
   * Defaults to the shared Bolagsverket portal token endpoint.
   */
  private getForetagsinfoTokenUrl(): string {
    return (
      this.configService.get<string>('BV_FORETAGSINFO_TOKEN_URL') ??
      this.configService.get<string>('BV_HVD_TOKEN_URL') ??
      DEFAULT_TOKEN_URL
    );
  }

  private getForetagsinfoScope(): string {
    return this.configService.get<string>('BV_FORETAGSINFO_SCOPE') ?? DEFAULT_FORETAGSINFO_SCOPE;
  }

  private getForetagsinfoClientId(): string {
    const clientId =
      this.configService.get<string>('BV_FORETAGSINFO_CLIENT_ID') ??
      this.configService.get<string>('BV_HVD_CLIENT_ID') ??
      this.configService.get<string>('BV_CLIENT_ID');
    if (!clientId) {
      throw new UnauthorizedException('Bolagsverket Företagsinformation OAuth client ID is missing');
    }
    return clientId;
  }

  private getForetagsinfoClientSecret(): string {
    const clientSecret =
      this.configService.get<string>('BV_FORETAGSINFO_CLIENT_SECRET') ??
      this.configService.get<string>('BV_HVD_CLIENT_SECRET') ??
      this.configService.get<string>('BV_CLIENT_SECRET');
    if (!clientSecret) {
      throw new UnauthorizedException('Bolagsverket Företagsinformation OAuth client secret is missing');
    }
    return clientSecret;
  }

  private resolveForetagsinfoAuthHeader(): { name: string; value: string } | null {
    const headerName = this.configService.get<string>('BV_FORETAGSINFO_AUTH_HEADER') ?? 'Authorization';
    const authValue = this.configService.get<string>('BV_FORETAGSINFO_AUTH_VALUE');
    if (authValue) {
      return { name: headerName, value: authValue };
    }
    const bearerToken = this.configService.get<string>('BV_FORETAGSINFO_BEARER_TOKEN');
    if (bearerToken) {
      return { name: headerName, value: `Bearer ${bearerToken}` };
    }
    return null;
  }

  private async buildHvdHeaders(extraHeaders: Record<string, string> = {}): Promise<Record<string, string>> {
    const token = await this.getAccessToken();
    return {
      'content-type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-request-id': randomUUID(),
      ...extraHeaders,
    };
  }

  /**
   * Build headers for Företagsinformation requests.
   *
   * Priority order:
   *  1. BV_FORETAGSINFO_AUTH_VALUE (or BV_FORETAGSINFO_BEARER_TOKEN) – static token
   *  2. OAuth2 client credentials when BV_FORETAGSINFO_CLIENT_ID or BV_HVD_CLIENT_ID
   *     is configured (dynamic token fetch with foretagsinformation:read scope)
   *  3. Legacy x-client-id / x-client-secret headers (deprecated; only when BV_CLIENT_ID
   *     is set without any HVD/Foretagsinfo OAuth credentials)
   */
  private async buildForetagsinfoHeaders(extraHeaders: Record<string, string> = {}): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-request-id': randomUUID(),
      ...extraHeaders,
    };

    // 1. Static bearer / custom auth header takes priority.
    const authHeader = this.resolveForetagsinfoAuthHeader();
    if (authHeader) {
      headers[authHeader.name] = authHeader.value;
      return headers;
    }

    // 2. OAuth2 dynamic token when explicit HVD or Foretagsinfo OAuth credentials exist.
    //    BV_CLIENT_ID is intentionally excluded here so that legacy deployments that
    //    only set BV_CLIENT_ID/BV_CLIENT_SECRET continue to use the legacy path.
    const hasOAuthCreds =
      this.configService.get<string>('BV_FORETAGSINFO_CLIENT_ID') ??
      this.configService.get<string>('BV_HVD_CLIENT_ID');
    if (hasOAuthCreds) {
      const token = await this.getAccessTokenForForetagsinfo();
      headers['Authorization'] = `Bearer ${token}`;
      return headers;
    }

    // 3. Legacy fallback.
    const clientId = this.configService.get<string>('BV_CLIENT_ID') ?? '';
    const clientSecret = this.configService.get<string>('BV_CLIENT_SECRET') ?? '';
    if (clientId && clientSecret) {
      if (!this.warnedLegacyAuth) {
        this.warnedLegacyAuth = true;
        this.logger.warn(
          'Företagsinformation auth token not configured; falling back to legacy x-client-id/x-client-secret headers.',
        );
      }
      headers['x-client-id'] = clientId;
      headers['x-client-secret'] = clientSecret;
    }

    return headers;
  }

  private mapError(status?: number, requestId?: string, details?: BvApiError | string): never {
    const detailMessage = typeof details === 'string' ? details : details?.detail || details?.title || details?.code;
    const detailSuffix = detailMessage ? `: ${detailMessage}` : '';
    const base = requestId ? ` (requestId: ${requestId})` : '';
    if (status === 400) throw new BadRequestException(`Bolagsverket rejected the request${base}${detailSuffix}`);
    if (status === 401) throw new UnauthorizedException(`Bolagsverket authentication failed${base}${detailSuffix}`);
    if (status === 403) throw new ForbiddenException(`Bolagsverket access forbidden${base}${detailSuffix}`);
    throw new InternalServerErrorException(`Bolagsverket request failed${base}${detailSuffix}`);
  }

  private async requestWithRetry<T>(
    method: 'get' | 'post',
    url: string,
    payload?: unknown,
    options?: {
      auth?: 'hvd' | 'org';
      responseType?: AxiosRequestConfig['responseType'];
      extraHeaders?: Record<string, string>;
    },
  ): Promise<{ responseData: T; requestId: string; responseHeaders?: Record<string, string> }> {
    let attempt = 0;
    let retryDelayMs: number = RETRY_CONFIG.initialDelayMs;

    while (true) {
      const headers =
        options?.auth === 'org'
          ? await this.buildForetagsinfoHeaders(options?.extraHeaders)
          : await this.buildHvdHeaders(options?.extraHeaders);
      const requestId = headers['x-request-id'];
      try {
        const config: AxiosRequestConfig = {
          headers,
          responseType: options?.responseType,
        };
        const observable =
          method === 'get'
            ? this.httpService.get<T>(url, config)
            : this.httpService.post<T>(url, payload, config);

        const response = await firstValueFrom(observable);
        return { responseData: response.data, requestId, responseHeaders: response.headers as Record<string, string> };
      } catch (error: any) {
        const status: number | undefined = error?.response?.status;
        const isRetryable = status !== undefined && RETRYABLE_STATUS_CODES.has(status);

        if (status === 401 && options?.auth === 'hvd' && attempt === 0) {
          attempt++;
          this.invalidateToken();
          continue;
        }
        if (status === 401 && options?.auth === 'org' && attempt === 0) {
          attempt++;
          this.invalidateForetagsinfoToken();
          continue;
        }
        if (isRetryable && attempt < RETRY_CONFIG.maxRetries) {
          attempt++;
          this.logger.warn(
            `Bolagsverket ${url} failed with ${status} – retry ${attempt}/${RETRY_CONFIG.maxRetries} in ${retryDelayMs}ms`,
          );
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
          retryDelayMs = Math.min(retryDelayMs * RETRY_CONFIG.backoffMultiplier, RETRY_CONFIG.maxDelayMs);
          continue;
        }

        this.mapError(status, requestId, error?.response?.data);
      }
    }
  }

  private invalidateToken(): void {
    this.hvdTokenCache = null;
    this.tokenRequest = null;
  }

  private invalidateForetagsinfoToken(): void {
    this.foretagsinfoTokenCache = null;
    this.foretagsinfoTokenRequest = null;
  }

  private isTokenValid(): boolean {
    if (!this.hvdTokenCache) return false;
    return Date.now() < this.hvdTokenCache.expiresAt;
  }

  private isForetagsinfoTokenValid(): boolean {
    if (!this.foretagsinfoTokenCache) return false;
    return Date.now() < this.foretagsinfoTokenCache.expiresAt;
  }

  /**
   * Builds a Basic Auth header value from client credentials.
   * Bolagsverket's token endpoint uses HTTP Basic Auth (RFC 6749 §2.3.1).
   */
  private buildBasicAuthHeader(clientId: string, clientSecret: string): string {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    return `Basic ${credentials}`;
  }

  /**
   * Helper to fetch an OAuth2 token with client_credentials grant.
   * Uses HTTP Basic Auth for credentials (confirmed working with Bolagsverket production).
   */
  private async fetchOAuthToken(
    tokenUrl: string,
    clientId: string,
    clientSecret: string,
    scope: string,
  ): Promise<OAuthTokenResponse> {
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('scope', scope);

    const response = await firstValueFrom(
      this.httpService.post(tokenUrl, params.toString(), {
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          Authorization: this.buildBasicAuthHeader(clientId, clientSecret),
          'x-request-id': randomUUID(),
        },
      }),
    );

    const tokenSchema = z.object({
      access_token: z.string().min(1),
      token_type: z.string().optional(),
      expires_in: z.union([z.number(), z.string()]),
      scope: z.string().optional(),
    });
    const parsed = tokenSchema.parse(response.data);
    const expiresIn = Number(parsed.expires_in);
    if (!Number.isFinite(expiresIn) || expiresIn <= 0) {
      throw new InternalServerErrorException(
        `Bolagsverket token response contains invalid expires_in: ${String(parsed.expires_in)}`,
      );
    }

    return {
      access_token: parsed.access_token,
      token_type: parsed.token_type,
      expires_in: expiresIn,
      scope: parsed.scope,
    };
  }

  private async requestAccessToken(): Promise<OAuthTokenResponse> {
    const clientId = this.getHvdClientId();
    const clientSecret = this.getHvdClientSecret();
    return this.fetchOAuthToken(this.getHvdTokenUrl(), clientId, clientSecret, this.getHvdScopes());
  }

  async getAccessToken(): Promise<string> {
    if (this.isTokenValid()) {
      return this.hvdTokenCache!.accessToken;
    }

    if (this.tokenRequest) {
      return this.tokenRequest;
    }

    this.tokenRequest = (async () => {
      try {
        const tokenResponse = await this.requestAccessToken();
        const expiresInMs = tokenResponse.expires_in * 1000;
        const skewMs = Math.min(TOKEN_REFRESH_SKEW_MS, Math.floor(expiresInMs * 0.1));
        const expiresAt = Date.now() + Math.max(expiresInMs - skewMs, 0);
        this.hvdTokenCache = {
          accessToken: tokenResponse.access_token,
          expiresAt,
          scope: tokenResponse.scope,
          tokenType: tokenResponse.token_type,
        };
        return tokenResponse.access_token;
      } finally {
        this.tokenRequest = null;
      }
    })();

    return this.tokenRequest;
  }

  /**
   * Fetch (and cache) an OAuth2 token for the Företagsinformation API.
   * Uses the foretagsinformation:read scope by default.
   */
  async getAccessTokenForForetagsinfo(): Promise<string> {
    if (this.isForetagsinfoTokenValid()) {
      return this.foretagsinfoTokenCache!.accessToken;
    }

    if (this.foretagsinfoTokenRequest) {
      return this.foretagsinfoTokenRequest;
    }

    this.foretagsinfoTokenRequest = (async () => {
      try {
        const tokenResponse = await this.fetchOAuthToken(
          this.getForetagsinfoTokenUrl(),
          this.getForetagsinfoClientId(),
          this.getForetagsinfoClientSecret(),
          this.getForetagsinfoScope(),
        );
        const expiresInMs = tokenResponse.expires_in * 1000;
        const skewMs = Math.min(TOKEN_REFRESH_SKEW_MS, Math.floor(expiresInMs * 0.1));
        const expiresAt = Date.now() + Math.max(expiresInMs - skewMs, 0);
        this.foretagsinfoTokenCache = {
          accessToken: tokenResponse.access_token,
          expiresAt,
          scope: tokenResponse.scope,
          tokenType: tokenResponse.token_type,
        };
        return tokenResponse.access_token;
      } finally {
        this.foretagsinfoTokenRequest = null;
      }
    })();

    return this.foretagsinfoTokenRequest;
  }

  async revokeAccessToken(): Promise<{ revoked: boolean; error?: string }> {
    const revokeUrl = this.getHvdRevokeUrl();
    if (!revokeUrl) {
      return { revoked: false, error: 'Revocation endpoint is not configured' };
    }
    if (!this.hvdTokenCache) {
      return { revoked: false, error: 'No access token available to revoke' };
    }

    const params = new URLSearchParams();
    params.append('token', this.hvdTokenCache.accessToken);
    params.append('token_type_hint', 'access_token');
    try {
      await firstValueFrom(
        this.httpService.post(revokeUrl, params.toString(), {
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
            'x-request-id': randomUUID(),
          },
        }),
      );
      this.invalidateToken();
      return { revoked: true };
    } catch (err: any) {
      return { revoked: false, error: String(err) };
    }
  }

  /** Wrap a value in an array if it is not already one. */
  private ensureArray<T>(data: T | T[]): T[] {
    return Array.isArray(data) ? data : [data];
  }

  // ── Public API methods ────────────────────────────────────────────────────

  /** GET /isalive – verify API availability before making data requests. */
  async healthCheck(): Promise<{ status: string }> {
    const { responseData } = await this.requestWithRetry<string>('get', this.buildUrl(this.getHvdBaseUrl(), '/isalive'), undefined, {
      auth: 'hvd',
    });
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
      this.buildUrl(this.getHvdBaseUrl(), '/organisationer'),
      payload,
      { auth: 'hvd' },
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
      this.buildUrl(this.getHvdBaseUrl(), '/dokumentlista'),
      payload,
      { auth: 'hvd' },
    );
    return { requestPayload: payload, responsePayload: responseData, requestId };
  }

  /** GET/POST /vardefulla-datamangder/v1/dokument – download document ZIP. */
  async fetchDocument(dokumentId: string): Promise<{
    requestPayload: { dokumentId: string } | null;
    responsePayload: Buffer;
    requestId: string;
    contentType: string;
    fileName?: string;
  }> {
    const documentPath = this.configService.get<string>('BV_HVD_DOCUMENT_PATH') ?? DEFAULT_HVD_DOCUMENT_PATH;
    const isPathTemplate = documentPath.includes('{dokumentId}');
    const resolvedPath = isPathTemplate
      ? documentPath.replace('{dokumentId}', encodeURIComponent(dokumentId))
      : documentPath;
    const url = this.buildUrl(this.getHvdBaseUrl(), resolvedPath);
    const payload = isPathTemplate ? null : { dokumentId };

    const { responseData, requestId, responseHeaders } = await this.requestWithRetry<ArrayBuffer>(
      payload ? 'post' : 'get',
      url,
      payload ?? undefined,
      {
        auth: 'hvd',
        responseType: 'arraybuffer',
        extraHeaders: { Accept: 'application/zip' },
      },
    );

    const buffer = Buffer.from(responseData);
    const contentType = responseHeaders?.['content-type'] ?? 'application/zip';
    const disposition = responseHeaders?.['content-disposition'];
    const utf8Match = disposition?.match(/filename\*\s*=\s*UTF-8''?([^;]+)/i);
    const quotedMatch = disposition?.match(/filename\s*=\s*"([^"]+)"/i);
    const unquotedMatch = disposition?.match(/filename\s*=\s*([^;]+)/i);
    const rawFileName = utf8Match?.[1] ?? quotedMatch?.[1] ?? unquotedMatch?.[1];
    const safeFileName = sanitizeBolagsverketFilename(rawFileName);

    return {
      requestPayload: payload,
      responsePayload: buffer,
      requestId,
      contentType,
      fileName: safeFileName,
    };
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
      this.buildUrl(this.getOrganisationBaseUrl(), '/organisationsinformation'),
      payload,
      { auth: 'org' },
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
      this.buildUrl(this.getOrganisationBaseUrl(), '/arenden'),
      payload,
      { auth: 'org' },
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
      this.buildUrl(this.getOrganisationBaseUrl(), '/firmateckningsalternativ'),
      payload,
      { auth: 'org' },
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
      this.buildUrl(this.getOrganisationBaseUrl(), '/aktiekapitalforandringar'),
      payload,
      { auth: 'org' },
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
      this.buildUrl(this.getOrganisationBaseUrl(), '/organisationsengagemang'),
      payload,
      { auth: 'org' },
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
      this.buildUrl(this.getOrganisationBaseUrl(), '/finansiellarapporter'),
      payload,
      { auth: 'org' },
    );
    return { requestPayload: payload, responsePayload: responseData, requestId };
  }
}
