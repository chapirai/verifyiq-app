import { randomUUID, randomBytes, createCipheriv, createDecipheriv, createHash } from 'crypto';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { z } from 'zod';
import { IntegrationTokenEntity } from '../entities/integration-token.entity';
import { AuditService } from '../../audit/audit.service';
import { AuditEventType } from '../../audit/audit-event.entity';
import { OAuthTokenResponse } from '../integrations/bolagsverket.types';

const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1_000,
  backoffMultiplier: 2,
  maxDelayMs: 30_000,
} as const;
const DEFAULT_HVD_SCOPES = 'vardefulla-datamangder:read vardefulla-datamangder:ping';
const DEFAULT_HVD_TOKEN_URL = 'https://portal.api.bolagsverket.se/oauth2/token';

@Injectable()
export class IntegrationTokenService {
  private readonly logger = new Logger(IntegrationTokenService.name);
  private readonly encryptionKey: Buffer;

  constructor(
    @InjectRepository(IntegrationTokenEntity)
    private readonly integrationTokenRepo: Repository<IntegrationTokenEntity>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {
    const encryptionSecret =
      this.configService.get<string>('INTEGRATION_TOKEN_ENCRYPTION_KEY') ??
      this.configService.getOrThrow<string>('JWT_SECRET');
    this.encryptionKey = createHash('sha256').update(encryptionSecret).digest();
  }

  /**
   * Always fetches a fresh token from Bolagsverket OAuth endpoint.
   * Saves each token fetch as a new row in integration_tokens.
   * No caching — every lookup gets a fresh token for both hvd and org APIs.
   */
  async getTenantAccessToken(
    tenantId: string,
    auth: 'hvd' | 'org' = 'hvd',
    correlationId?: string | null,
    actorId?: string | null,
  ): Promise<string> {
    const providerKey = this.getProviderKey(auth);
    const tokenUrl = this.getTokenUrl(auth);
    const scope = this.getTokenScopes(auth);

    void this.auditService.emitAuditEvent({
      tenantId,
      userId: actorId ?? null,
      eventType: AuditEventType.REFRESH_INITIATED,
      action: 'integration.token.refresh',
      status: 'initiated',
      resourceId: providerKey,
      correlationId: correlationId ?? null,
      metadata: { providerKey, tokenUrl, scope },
    });

    try {
      const tokenResponse = await this.requestAccessToken(auth);
      const expiresAt = this.calculateExpiry(tokenResponse.expires_in);

      // Always insert a new row — each lookup is a separate instance
      const entity = this.integrationTokenRepo.create({
        tenantId,
        providerKey,
        encryptedAccessToken: this.encrypt(tokenResponse.access_token),
        encryptedRefreshToken: null,
        expiresAt: new Date(expiresAt),
        tokenType: tokenResponse.token_type ?? null,
        scope: tokenResponse.scope ?? null,
        lastRefreshedAt: new Date(),
      });
      await this.integrationTokenRepo.save(entity);

      void this.auditService.emitAuditEvent({
        tenantId,
        userId: actorId ?? null,
        eventType: AuditEventType.REFRESH_COMPLETED,
        action: 'integration.token.refresh',
        status: 'success',
        resourceId: providerKey,
        correlationId: correlationId ?? null,
        metadata: {
          providerKey,
          tokenType: tokenResponse.token_type ?? null,
          scope: tokenResponse.scope ?? null,
          expiresAt: new Date(expiresAt).toISOString(),
        },
      });

      return tokenResponse.access_token;
    } catch (error) {
      void this.auditService.emitAuditEvent({
        tenantId,
        userId: actorId ?? null,
        eventType: AuditEventType.FAILURE_STATE,
        action: 'integration.token.refresh',
        status: 'error',
        resourceId: providerKey,
        correlationId: correlationId ?? null,
        metadata: {
          providerKey,
          message: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }

  private calculateExpiry(expiresInSeconds: number): number {
    return Date.now() + expiresInSeconds * 1000;
  }

  private getProviderKey(auth: 'hvd' | 'org'): string {
    if (auth === 'hvd') {
      return `bolagsverket:hvd:${this.getTokenScopes('hvd')}`;
    }
    return `bolagsverket:org:${this.getTokenScopes('org')}`;
  }

  private getHvdTokenUrl(): string {
    return this.configService.get<string>('BV_HVD_TOKEN_URL') ?? DEFAULT_HVD_TOKEN_URL;
  }

  private getTokenClientId(auth: 'hvd' | 'org'): string {
    const key = auth === 'hvd' ? 'BV_HVD_CLIENT_ID' : 'BV_FORETAGSINFO_CLIENT_ID';
    const clientId =
      this.configService.get<string>(key) ?? this.configService.get<string>('BV_CLIENT_ID');
    if (!clientId) throw new UnauthorizedException('Bolagsverket OAuth client ID is missing');
    return clientId;
  }

  private getTokenClientSecret(auth: 'hvd' | 'org'): string {
    const key = auth === 'hvd' ? 'BV_HVD_CLIENT_SECRET' : 'BV_FORETAGSINFO_CLIENT_SECRET';
    const clientSecret =
      this.configService.get<string>(key) ?? this.configService.get<string>('BV_CLIENT_SECRET');
    if (!clientSecret) throw new UnauthorizedException('Bolagsverket OAuth client secret is missing');
    return clientSecret;
  }

  private getTokenScopes(auth: 'hvd' | 'org'): string {
    if (auth === 'hvd') {
      return this.configService.get<string>('BV_HVD_SCOPES') ?? DEFAULT_HVD_SCOPES;
    }
    return this.configService.get<string>('BV_FORETAGSINFO_SCOPES') ?? '';
  }

  private getTokenUrl(auth: 'hvd' | 'org'): string {
    if (auth === 'hvd') return this.getHvdTokenUrl();
    return this.configService.get<string>('BV_FORETAGSINFO_TOKEN_URL') ?? this.getHvdTokenUrl();
  }

  private async requestAccessToken(auth: 'hvd' | 'org'): Promise<OAuthTokenResponse> {
    const clientId = this.getTokenClientId(auth);
    const clientSecret = this.getTokenClientSecret(auth);
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    const scope = this.getTokenScopes(auth);
    if (scope) params.append('scope', scope);
    const tokenUrl = this.getTokenUrl(auth);
    const requestId = randomUUID();
    const authHeader = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;

    let attempt = 0;
    const maxTotalAttempts = RETRY_CONFIG.maxRetries + 1;
    let retryDelayMs: number = RETRY_CONFIG.initialDelayMs;
    let lastError: unknown;

    while (attempt < maxTotalAttempts) {
      try {
        const response = await firstValueFrom(
          this.httpService.post(tokenUrl, params.toString(), {
            headers: {
              Authorization: authHeader,
              Accept: 'application/json',
              'content-type': 'application/x-www-form-urlencoded',
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
          throw new UnauthorizedException(
            `Bolagsverket token response contains invalid expires_in: ${String(parsed.expires_in)}`,
          );
        }
        return {
          access_token: parsed.access_token,
          token_type: parsed.token_type,
          expires_in: expiresIn,
          scope: parsed.scope,
        };
      } catch (error: unknown) {
        const status = this.extractErrorStatus(error);
        const isRetryable = status === undefined || RETRYABLE_STATUS_CODES.has(status);
        lastError = error;
        if (isRetryable && attempt < maxTotalAttempts - 1) {
          attempt++;
          this.logger.warn(
            `Token request failed for ${auth} with ${status ?? 'network error'} – retry ${attempt}/${RETRY_CONFIG.maxRetries} in ${retryDelayMs}ms (requestId: ${requestId})`,
          );
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
          retryDelayMs = Math.min(retryDelayMs * RETRY_CONFIG.backoffMultiplier, RETRY_CONFIG.maxDelayMs);
          continue;
        }
        throw error;
      }
    }
    throw new UnauthorizedException(`Bolagsverket token request failed: ${String(lastError)}`);
  }

  private encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('base64')}.${authTag.toString('base64')}.${encrypted.toString('base64')}`;
  }

  private extractErrorStatus(error: unknown): number | undefined {
    if (typeof error !== 'object' || error === null) return undefined;
    const response = (error as { response?: { status?: unknown } }).response;
    if (!response || typeof response.status !== 'number') return undefined;
    return response.status;
  }

  private decrypt(value: string): string {
    const [ivPart, tagPart, cipherPart] = value.split('.');
    if (!ivPart || !tagPart || !cipherPart) {
      throw new UnauthorizedException('Stored integration token is malformed');
    }
    const iv = Buffer.from(ivPart, 'base64');
    const authTag = Buffer.from(tagPart, 'base64');
    const encrypted = Buffer.from(cipherPart, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  }
}
