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
import { IntegrationTokenService } from '../services/integration-token.service';
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
  PersonResponse,
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
const DEFAULT_HVD_TOKEN_URL = 'https://portal.api.bolagsverket.se/oauth2/token';
const DEFAULT_HVD_REVOKE_URL = 'https://portal.api.bolagsverket.se/oauth2/revoke';
const DEFAULT_HVD_DOCUMENT_PATH = '/dokument';
const TOKEN_REFRESH_SKEW_MS = 60_000;
const BEARER_PREFIX_PATTERN = /^Bearer\s+/i;

@Injectable()
export class BolagsverketClient {
  private readonly logger = new Logger(BolagsverketClient.name);
  private tokenCaches = new Map<string, {
    accessToken: string;
    expiresAt: number;
    scope?: string;
    tokenType?: string;
  }>();
  private tokenRequests = new Map<string, Promise<string>>();
  private tokenMetrics = {
    cacheHits: 0,
    cacheMisses: 0,
    refreshes: 0,
    requestFailures: 0,
  };
  private warnedLegacyAuth = false;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly integrationTokenService: IntegrationTokenService,
  ) {}

  private getTenantIdFromContext(context?: {
    tenantId?: string;
    actorId?: string | null;
    correlationId?: string | null;
  }): string | null {
    return context?.tenantId ?? null;
  }

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
    return DEFAULT_HVD_TOKEN_URL;
  }

  private getHvdRevokeUrl(): string | null {
    return this.configService.get<string>('BV_HVD_REVOKE_URL') ?? DEFAULT_HVD_REVOKE_URL;
  }

  private getHvdScopes(): string {
    return this.configService.get<string>('BV_HVD_SCOPES') ?? DEFAULT_HVD_SCOPES;
  }

  private getTokenClientId(auth: 'hvd' | 'org'): string {
    const authSpecificKey = auth === 'hvd' ? 'BV_HVD_CLIENT_ID' : 'BV_FORETAGSINFO_CLIENT_ID';
    const clientId = this.configService.get<string>(authSpecificKey) ?? this.configService.get<string>('BV_CLIENT_ID');
    if (!clientId) {
      throw new UnauthorizedException('Bolagsverket OAuth client ID is missing');
    }
    return clientId;
  }

  private getTokenClientSecret(auth: 'hvd' | 'org'): string {
    const authSpecificKey = auth === 'hvd' ? 'BV_HVD_CLIENT_SECRET' : 'BV_FORETAGSINFO_CLIENT_SECRET';
    const clientSecret = this.configService.get<string>(authSpecificKey) ?? this.configService.get<string>('BV_CLIENT_SECRET');
    if (!clientSecret) {
      throw new UnauthorizedException('Bolagsverket OAuth client secret is missing');
    }
    return clientSecret;
  }

  private getTokenScopes(auth: 'hvd' | 'org'): string {
    if (auth === 'hvd') return this.getHvdScopes();
    return this.configService.get<string>('BV_FORETAGSINFO_SCOPES') ?? '';
  }

  private getTokenUrl(auth: 'hvd' | 'org'): string {
    if (auth === 'hvd') return this.getHvdTokenUrl();
    return this.configService.get<string>('BV_FORETAGSINFO_TOKEN_URL') ?? this.getHvdTokenUrl();
  }

  private getTokenCacheKey(auth: 'hvd' | 'org'): string {
    return `${auth}:${this.getTokenScopes(auth)}`;
  }

  private resolveForetagsinfoAuthHeader(): { name: string; value: string } | null {
    const headerName = this.configService.get<string>('BV_FORETAGSINFO_AUTH_HEADER') ?? 'Authorization';
    const authValue = this.configService.get<string>('BV_FORETAGSINFO_AUTH_VALUE');
    if (authValue) {
      return { name: headerName, value: authValue };
    }
    const bearerToken = (
      this.configService.get<string>('BV_FORETAGSINFO_BEARER_TOKEN')
      ?? this.configService.get<string>('BV_FORETAGSINFO_AUTH_TOKEN')
      ?? this.configService.get<string>('BV_FORETAGSINFO_TOKEN')
    )?.trim();
    if (bearerToken) {
      const normalizedValue = BEARER_PREFIX_PATTERN.test(bearerToken)
        ? bearerToken.replace(BEARER_PREFIX_PATTERN, 'Bearer ')
        : `Bearer ${bearerToken}`;
      return { name: headerName, value: normalizedValue };
    }
    return null;
  }

  private isForetagsinfoOAuthEnabled(): boolean {
    const raw = this.configService.get<string>('BV_FORETAGSINFO_USE_OAUTH');
    return typeof raw === 'string' && raw.toLowerCase() === 'true';
  }

  private async buildHvdHeaders(
    extraHeaders: Record<string, string> = {},
    context?: { tenantId?: string; actorId?: string | null; correlationId?: string | null },
  ): Promise<Record<string, string>> {
    const token = await this.getAccessToken('hvd', context);
    return {
      'content-type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-request-id': randomUUID(),
      ...extraHeaders,
    };
  }

  private async buildForetagsinfoHeaders(
    extraHeaders: Record<string, string> = {},
    context?: { tenantId?: string; actorId?: string | null; correlationId?: string | null },
  ): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-request-id': randomUUID(),
      ...extraHeaders,
    };

    const tenantId = this.getTenantIdFromContext(context);
    if (tenantId || this.isForetagsinfoOAuthEnabled()) {
      const token = await this.getAccessToken('org', context);
      headers['Authorization'] = `Bearer ${token}`;
      return headers;
    }

    const authHeader = this.resolveForetagsinfoAuthHeader();
    if (authHeader) {
      headers[authHeader.name] = authHeader.value;
      return headers;
    }

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
    const normalized = this.normalizeApiErrorDetails(status, requestId, details);
    const detailMessage = normalized.detail || normalized.title || normalized.code;
    const detailSuffix = detailMessage ? `: ${detailMessage}` : '';
    const base = normalized.requestId ? ` (requestId: ${normalized.requestId})` : '';
    this.logger.error(
      `Bolagsverket upstream error${base}`,
      JSON.stringify({
        status: normalized.status,
        title: normalized.title,
        detail: normalized.detail,
        code: normalized.code,
        requestId: normalized.requestId,
      }),
    );
    const mappedStatus = normalized.status ?? status;
    if (mappedStatus === 400) throw new BadRequestException(`Bolagsverket rejected the request${base}${detailSuffix}`);
    if (mappedStatus === 401) throw new UnauthorizedException(`Bolagsverket authentication failed${base}${detailSuffix}`);
    if (mappedStatus === 403) throw new ForbiddenException(`Bolagsverket access forbidden${base}${detailSuffix}`);
    throw new InternalServerErrorException(`Bolagsverket request failed${base}${detailSuffix}`);
  }

  private normalizeApiErrorDetails(status?: number, requestId?: string, details?: BvApiError | string) {
    if (typeof details === 'string') {
      return { status, detail: details, requestId };
    }
    return {
      status: details?.status ?? status,
      title: details?.title,
      detail: details?.detail,
      code: details?.code,
      requestId: details?.requestId ?? requestId,
    };
  }

  private async requestWithRetry<T>(
    method: 'get' | 'post',
    url: string,
    payload?: unknown,
    options?: {
      auth?: 'hvd' | 'org';
      responseType?: AxiosRequestConfig['responseType'];
      extraHeaders?: Record<string, string>;
      context?: { tenantId?: string; actorId?: string | null; correlationId?: string | null };
    },
  ): Promise<{ responseData: T; requestId: string; responseHeaders?: Record<string, string> }> {
    let attempt = 0;
    let retryDelayMs: number = RETRY_CONFIG.initialDelayMs;

    while (true) {
      const headers = options?.auth === 'org'
        ? await this.buildForetagsinfoHeaders(options?.extraHeaders, options?.context)
        : await this.buildHvdHeaders(options?.extraHeaders, options?.context);
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
    this.tokenCaches.clear();
    this.tokenRequests.clear();
  }

  private isTokenValid(cacheKey: string): boolean {
    const tokenCache = this.tokenCaches.get(cacheKey);
    if (!tokenCache) return false;
    return Date.now() < tokenCache.expiresAt;
  }

  private async requestAccessToken(auth: 'hvd' | 'org'): Promise<OAuthTokenResponse> {
    const clientId = this.getTokenClientId(auth);
    const clientSecret = this.getTokenClientSecret(auth);
    if (!clientId || !clientSecret) {
      throw new UnauthorizedException('Bolagsverket OAuth client credentials are missing');
    }

    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    const scope = this.getTokenScopes(auth);
    if (scope) params.append('scope', scope);
    const tokenUrl = this.getTokenUrl(auth);
    const requestId = randomUUID();
    const authHeader = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;

    let attempt = 0;
    const maxAttempts = RETRY_CONFIG.maxRetries + 1;
    let retryDelayMs: number = RETRY_CONFIG.initialDelayMs;
    let lastError: unknown;

    while (attempt < maxAttempts) {
      try {
        const response = await firstValueFrom(
          this.httpService.post(tokenUrl, params.toString(), {
            headers: {
              Authorization: authHeader,
              Accept: 'application/json',
              'Content-Type': 'application/x-www-form-urlencoded',
              'x-request-id': requestId,
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
      } catch (error: any) {
        const status = error?.response?.status as number | undefined;
        const isRetryable = status === undefined || RETRYABLE_STATUS_CODES.has(status);
        lastError = error;
        if (isRetryable && attempt < maxAttempts - 1) {
          attempt++;
          this.logger.warn(
            `Bolagsverket token request failed for ${auth} with ${status ?? 'network error'} – retry ${attempt}/${RETRY_CONFIG.maxRetries} in ${retryDelayMs}ms (requestId: ${requestId})`,
          );
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
          retryDelayMs = Math.min(retryDelayMs * RETRY_CONFIG.backoffMultiplier, RETRY_CONFIG.maxDelayMs);
          continue;
        }
        this.tokenMetrics.requestFailures++;
        this.mapError(status, requestId, error?.response?.data);
      }
    }
    throw new InternalServerErrorException(`Bolagsverket token request failed: ${String(lastError)}`);
  }

  /**
   * Returns a cached OAuth token for the selected integration target.
   * - `hvd`: Värdefulla Datamängder token settings (`BV_HVD_*`).
   * - `org`: Företagsinformation OAuth mode settings (`BV_FORETAGSINFO_*`).
   */
  async getAccessToken(
    auth: 'hvd' | 'org' = 'hvd',
    context?: { tenantId?: string; actorId?: string | null; correlationId?: string | null },
  ): Promise<string> {
    const tenantId = this.getTenantIdFromContext(context);
    if (tenantId) {
      return this.integrationTokenService.getTenantAccessToken(
        tenantId,
        auth,
        context?.correlationId ?? null,
        context?.actorId ?? null,
      );
    }

    const cacheKey = this.getTokenCacheKey(auth);
    if (this.isTokenValid(cacheKey)) {
      this.tokenMetrics.cacheHits++;
      return this.tokenCaches.get(cacheKey)!.accessToken;
    }
    this.tokenMetrics.cacheMisses++;

    const ongoingRequest = this.tokenRequests.get(cacheKey);
    if (ongoingRequest) {
      return ongoingRequest;
    }

    const tokenRequest = (async () => {
      try {
        const tokenResponse = await this.requestAccessToken(auth);
        const expiresInMs = tokenResponse.expires_in * 1000;
        const skewMs = Math.min(TOKEN_REFRESH_SKEW_MS, Math.floor(expiresInMs * 0.1));
        const expiresAt = Date.now() + Math.max(expiresInMs - skewMs, 0);
        this.tokenMetrics.refreshes++;
        this.tokenCaches.set(cacheKey, {
          accessToken: tokenResponse.access_token,
          expiresAt,
          scope: tokenResponse.scope,
          tokenType: tokenResponse.token_type,
        });
        return tokenResponse.access_token;
      } finally {
        this.tokenRequests.delete(cacheKey);
      }
    })();

    this.tokenRequests.set(cacheKey, tokenRequest);
    return tokenRequest;
  }

  getTokenCacheStatus(): {
    entries: Array<{ cacheKey: string; expiresAt: number; expiresInMs: number; scope?: string; tokenType?: string }>;
    metrics: { cacheHits: number; cacheMisses: number; refreshes: number; requestFailures: number };
  } {
    const now = Date.now();
    const entries = [...this.tokenCaches.entries()].map(([cacheKey, token]) => ({
      cacheKey,
      expiresAt: token.expiresAt,
      expiresInMs: Math.max(token.expiresAt - now, 0),
      scope: token.scope,
      tokenType: token.tokenType,
    }));
    return {
      entries,
      metrics: { ...this.tokenMetrics },
    };
  }

  async revokeAccessToken(): Promise<{ revoked: boolean; error?: string }> {
    const revokeUrl = this.getHvdRevokeUrl();
    if (!revokeUrl) {
      return { revoked: false, error: 'Revocation endpoint is not configured' };
    }
    const hvdCacheKey = this.getTokenCacheKey('hvd');
    const hvdToken = this.tokenCaches.get(hvdCacheKey);
    if (!hvdToken) {
      return { revoked: false, error: 'No access token available to revoke' };
    }

    const params = new URLSearchParams();
    params.append('token', hvdToken.accessToken);
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
  async fetchHighValueDataset(
    identitetsbeteckning: string,
    context?: { tenantId?: string; actorId?: string | null; correlationId?: string | null },
  ): Promise<{
    requestPayload: { identitetsbeteckning: string };
    responsePayload: HighValueDatasetResponse;
    requestId: string;
  }> {
    const payload = { identitetsbeteckning };
    const { responseData, requestId } = await this.requestWithRetry<HighValueDatasetResponse>(
      'post',
      this.buildUrl(this.getHvdBaseUrl(), '/organisationer'),
      payload,
      { auth: 'hvd', context },
    );
    return { requestPayload: payload, responsePayload: responseData, requestId };
  }

  /** POST /vardefulla-datamangder/v1/dokumentlista – retrieve available documents. */
  async fetchDocumentList(
    identitetsbeteckning: string,
    context?: { tenantId?: string; actorId?: string | null; correlationId?: string | null },
  ): Promise<{
    requestPayload: { identitetsbeteckning: string };
    responsePayload: DocumentListResponse;
    requestId: string;
  }> {
    const payload = { identitetsbeteckning };
    const { responseData, requestId } = await this.requestWithRetry<DocumentListResponse>(
      'post',
      this.buildUrl(this.getHvdBaseUrl(), '/dokumentlista'),
      payload,
      { auth: 'hvd', context },
    );
    return { requestPayload: payload, responsePayload: responseData, requestId };
  }

  /** GET/POST /vardefulla-datamangder/v1/dokument – download document ZIP. */
  async fetchDocument(
    dokumentId: string,
    context?: { tenantId?: string; actorId?: string | null; correlationId?: string | null },
  ): Promise<{
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
        context,
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
    context?: { tenantId?: string; actorId?: string | null; correlationId?: string | null },
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
      { auth: 'org', context },
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
    context?: { tenantId?: string; actorId?: string | null; correlationId?: string | null },
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
      { auth: 'org', context },
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
    context?: { tenantId?: string; actorId?: string | null; correlationId?: string | null },
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
      { auth: 'org', context },
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
    context?: { tenantId?: string; actorId?: string | null; correlationId?: string | null },
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
      { auth: 'org', context },
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
    context?: { tenantId?: string; actorId?: string | null; correlationId?: string | null },
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
      { auth: 'org', context },
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
    context?: { tenantId?: string; actorId?: string | null; correlationId?: string | null },
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
      { auth: 'org', context },
    );
    return { requestPayload: payload, responsePayload: responseData, requestId };
  }

  /**
   * POST /foretagsinformation/v4/personer
   * Retrieve person information by personal identity number (personnummer).
   */
  async fetchPersonInformation(
    identitetsbeteckning: string,
    context?: { tenantId?: string; actorId?: string | null; correlationId?: string | null },
  ): Promise<{
    requestPayload: Record<string, unknown>;
    responsePayload: PersonResponse;
    requestId: string;
  }> {
    const payload: Record<string, unknown> = { identitetsbeteckning };
    const { responseData, requestId } = await this.requestWithRetry<PersonResponse>(
      'post',
      this.buildUrl(this.getOrganisationBaseUrl(), '/personer'),
      payload,
      { auth: 'org', context },
    );
    const responseArray = this.ensureArray(responseData);
    return { requestPayload: payload, responsePayload: responseArray, requestId };
  }
}
