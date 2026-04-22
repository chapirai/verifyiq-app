import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { IsNull, Repository } from 'typeorm';
import { ApiKeyEntity } from '../../api-keys/entities/api-key.entity';

@Injectable()
export class PublicApiKeyGuard implements CanActivate {
  constructor(
    @InjectRepository(ApiKeyEntity)
    private readonly apiKeyRepo: Repository<ApiKeyEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Record<string, unknown>>();
    const headers = (req.headers ?? {}) as Record<string, string | string[] | undefined>;
    const raw = headers['x-api-key'];
    const key = Array.isArray(raw) ? raw[0] : raw;
    if (!key || typeof key !== 'string') {
      throw new UnauthorizedException('Missing x-api-key');
    }
    const keyHash = createHash('sha256').update(key).digest('hex');
    const apiKey = await this.apiKeyRepo.findOne({
      where: { keyHash, revokedAt: IsNull() },
    });
    if (!apiKey) throw new UnauthorizedException('Invalid API key');
    apiKey.lastUsedAt = new Date();
    await this.apiKeyRepo.save(apiKey);
    req['apiTenantId'] = apiKey.tenantId;
    req['apiKeyEnvironment'] = apiKey.environment;
    req['apiKeyId'] = apiKey.id;
    return true;
  }
}

