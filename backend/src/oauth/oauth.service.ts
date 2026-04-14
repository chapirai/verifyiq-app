import { randomBytes } from 'crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { OauthClientEntity } from './entities/oauth-client.entity';

@Injectable()
export class OauthService {
  constructor(
    @InjectRepository(OauthClientEntity)
    private readonly oauthClientRepo: Repository<OauthClientEntity>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private generateClientId(): string {
    return `viq_cl_${randomBytes(12).toString('hex')}`;
  }

  private generateClientSecret(): string {
    return `viq_cs_${randomBytes(24).toString('hex')}`;
  }

  async listByTenant(tenantId: string, environment?: 'live' | 'sandbox') {
    const where = environment
      ? { tenantId, environment, revokedAt: IsNull() }
      : { tenantId, revokedAt: IsNull() };
    return this.oauthClientRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async createClient(params: {
    tenantId: string;
    name: string;
    scopes?: string[];
    environment?: 'live' | 'sandbox';
  }): Promise<{ client: OauthClientEntity; clientSecret: string }> {
    const clientId = this.generateClientId();
    const clientSecret = this.generateClientSecret();
    const clientSecretHash = await bcrypt.hash(clientSecret, 10);
    const client = this.oauthClientRepo.create({
      tenantId: params.tenantId,
      name: params.name,
      clientId,
      clientSecretHash,
      scopes: params.scopes ?? [],
      environment: params.environment ?? 'live',
      revokedAt: null,
      lastUsedAt: null,
    });
    const saved = await this.oauthClientRepo.save(client);
    return { client: saved, clientSecret };
  }

  async ensureSandboxClient(tenantId: string): Promise<{ client: OauthClientEntity; clientSecret: string | null }> {
    const existing = await this.oauthClientRepo.findOne({
      where: { tenantId, environment: 'sandbox', revokedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    if (existing) return { client: existing, clientSecret: null };
    const created = await this.createClient({
      tenantId,
      name: 'Sandbox OAuth client',
      environment: 'sandbox',
      scopes: ['companies:read'],
    });
    return { client: created.client, clientSecret: created.clientSecret };
  }

  async revokeClient(tenantId: string, id: string) {
    const client = await this.oauthClientRepo.findOne({
      where: { id, tenantId, revokedAt: IsNull() },
    });
    if (!client) return { success: false };
    client.revokedAt = new Date();
    await this.oauthClientRepo.save(client);
    return { success: true };
  }

  async issueClientCredentialsToken(params: {
    clientId: string;
    clientSecret: string;
    requestedScope?: string;
  }): Promise<{ access_token: string; token_type: string; expires_in: number; scope: string }> {
    const client = await this.oauthClientRepo.findOne({
      where: { clientId: params.clientId, revokedAt: IsNull() },
    });
    if (!client) throw new UnauthorizedException('invalid_client');

    const match = await bcrypt.compare(params.clientSecret, client.clientSecretHash);
    if (!match) throw new UnauthorizedException('invalid_client');

    const requested = (params.requestedScope ?? '')
      .split(' ')
      .map(s => s.trim())
      .filter(Boolean);
    const scopes = requested.length
      ? requested.filter(s => client.scopes.includes(s))
      : client.scopes;

    const payload = {
      sub: `oauth:${client.id}`,
      tenantId: client.tenantId,
      role: 'api_client',
      authType: 'oauth_client_credentials',
      environment: client.environment,
      scopes,
      clientId: client.clientId,
    };
    const expiresInSeconds = 3600;
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_SECRET'),
      expiresIn: `${expiresInSeconds}s`,
    });
    client.lastUsedAt = new Date();
    await this.oauthClientRepo.save(client);
    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: expiresInSeconds,
      scope: scopes.join(' '),
    };
  }

  async revokeByClientCredentials(clientId: string, clientSecret: string) {
    const client = await this.oauthClientRepo.findOne({
      where: { clientId, revokedAt: IsNull() },
    });
    if (!client) return { revoked: false };
    const match = await bcrypt.compare(clientSecret, client.clientSecretHash);
    if (!match) throw new UnauthorizedException('invalid_client');
    client.revokedAt = new Date();
    await this.oauthClientRepo.save(client);
    return { revoked: true };
  }
}
