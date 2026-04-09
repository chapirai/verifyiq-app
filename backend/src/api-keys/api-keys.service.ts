import { createHash, randomBytes } from 'crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ApiKeyEntity } from './entities/api-key.entity';

@Injectable()
export class ApiKeysService {
  constructor(
    @InjectRepository(ApiKeyEntity)
    private readonly apiKeyRepository: Repository<ApiKeyEntity>,
  ) {}

  private generateRawKey(): string {
    return `viq_${randomBytes(24).toString('hex')}`;
  }

  private hashKey(rawKey: string): string {
    return createHash('sha256').update(rawKey).digest('hex');
  }

  async listByTenant(tenantId: string): Promise<ApiKeyEntity[]> {
    return this.apiKeyRepository.find({
      where: { tenantId, revokedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  async createKey(tenantId: string, name: string): Promise<{ key: string; apiKey: ApiKeyEntity }> {
    const rawKey = this.generateRawKey();
    const keyHash = this.hashKey(rawKey);
    const keyPrefix = rawKey.slice(0, 12);
    const apiKey = this.apiKeyRepository.create({
      tenantId,
      name,
      keyPrefix,
      keyHash,
      revokedAt: null,
      lastUsedAt: null,
    });
    const saved = await this.apiKeyRepository.save(apiKey);
    return { key: rawKey, apiKey: saved };
  }

  async revokeKey(tenantId: string, id: string): Promise<{ success: boolean }> {
    const key = await this.apiKeyRepository.findOne({ where: { id, tenantId, revokedAt: IsNull() } });
    if (!key) {
      throw new NotFoundException('API key not found');
    }
    key.revokedAt = new Date();
    await this.apiKeyRepository.save(key);
    return { success: true };
  }
}
