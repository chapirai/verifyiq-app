import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { Repository } from 'typeorm';
import { SubscriptionEntity } from '../../billing/entities/subscription.entity';

export type ApiQuotaBucket = string;

@Injectable()
export class ApiQuotaService {
  private readonly redis: Redis;
  private redisUnavailableLoggedAt = 0;

  constructor(
    @InjectRepository(SubscriptionEntity)
    private readonly subscriptionRepo: Repository<SubscriptionEntity>,
    private readonly config: ConfigService,
  ) {
    this.redis = new Redis({
      host: this.config.getOrThrow<string>('REDIS_HOST'),
      port: this.config.getOrThrow<number>('REDIS_PORT'),
      password: this.config.get<string>('REDIS_PASSWORD') || undefined,
      tls:
        String(this.config.get<string>('REDIS_TLS', 'false')).toLowerCase() === 'true'
          ? { rejectUnauthorized: false }
          : undefined,
      lazyConnect: true,
      connectTimeout: 15_000,
      keepAlive: 10_000,
      reconnectOnError: () => true,
      maxRetriesPerRequest: 2,
      retryStrategy: (times: number) => Math.min(2000, Math.max(100, times * 100)),
    });
    this.redis.on('error', (err: unknown) => {
      const now = Date.now();
      if (now - this.redisUnavailableLoggedAt > 60_000) {
        this.redisUnavailableLoggedAt = now;
        console.warn(
          `[ApiQuotaService] Redis connection issue (quota fallback to permissive mode): ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    });
  }

  private async ensureRedisConnected(): Promise<boolean> {
    if (this.redis.status !== 'ready' && this.redis.status !== 'connect') {
      try {
        await this.redis.connect();
      } catch {
        return false;
      }
    }
    return true;
  }

  private async planCodeForTenant(tenantId: string): Promise<'free' | 'basic' | 'pro'> {
    const sub = await this.subscriptionRepo.findOne({ where: { tenantId } });
    const raw = (sub?.planCode ?? 'free').toLowerCase();
    if (raw === 'pro') return 'pro';
    if (raw === 'basic') return 'basic';
    return 'free';
  }

  private dailyLimitForPlan(planCode: 'free' | 'basic' | 'pro'): number {
    const free =
      Number(this.config.get<string>('API_RATE_LIMIT_FREE_PER_DAY') ?? '') ||
      Number(this.config.get<string>('AR_RATE_LIMIT_FREE_PER_DAY') ?? '500');
    const basic =
      Number(this.config.get<string>('API_RATE_LIMIT_BASIC_PER_DAY') ?? '') ||
      Number(this.config.get<string>('AR_RATE_LIMIT_BASIC_PER_DAY') ?? '5000');
    const pro =
      Number(this.config.get<string>('API_RATE_LIMIT_PRO_PER_DAY') ?? '') ||
      Number(this.config.get<string>('AR_RATE_LIMIT_PRO_PER_DAY') ?? '50000');
    const byPlan: Record<'free' | 'basic' | 'pro', number> = {
      free,
      basic,
      pro,
    };
    return Math.max(1, byPlan[planCode]);
  }

  private redisKey(
    bucket: string,
    environment: string,
    tenantId: string,
    clientKey: string,
    day: string,
  ): string {
    if (bucket === 'financial-api') {
      return `quota:financial-api:${environment}:${tenantId}:${clientKey}:${day}`;
    }
    return `quota:api:${bucket}:${environment}:${tenantId}:${clientKey}:${day}`;
  }

  async consumeQuota(params: {
    tenantId: string;
    environment: 'live' | 'sandbox';
    clientKey: string;
    bucket: ApiQuotaBucket;
  }): Promise<{ allowed: boolean; limit: number; remaining: number; plan: string }> {
    const redisReady = await this.ensureRedisConnected();
    const plan = await this.planCodeForTenant(params.tenantId);
    const limit = this.dailyLimitForPlan(plan);
    if (!redisReady) {
      return { allowed: true, limit, remaining: limit, plan };
    }
    const day = new Date().toISOString().slice(0, 10);
    const key = this.redisKey(params.bucket, params.environment, params.tenantId, params.clientKey, day);
    const used = await this.redis.incr(key);
    if (used === 1) await this.redis.expire(key, 60 * 60 * 24 + 120);
    const remaining = Math.max(0, limit - used);
    return { allowed: used <= limit, limit, remaining, plan };
  }

  async readQuota(params: {
    tenantId: string;
    environment: 'live' | 'sandbox';
    clientKey: string;
    bucket: ApiQuotaBucket;
  }): Promise<{ limit: number; remaining: number; used: number; plan: string }> {
    const redisReady = await this.ensureRedisConnected();
    const plan = await this.planCodeForTenant(params.tenantId);
    const limit = this.dailyLimitForPlan(plan);
    if (!redisReady) {
      return { limit, remaining: limit, used: 0, plan };
    }
    const day = new Date().toISOString().slice(0, 10);
    const key = this.redisKey(params.bucket, params.environment, params.tenantId, params.clientKey, day);
    const raw = await this.redis.get(key);
    const used = Math.max(0, Number(raw ?? 0) || 0);
    const remaining = Math.max(0, limit - used);
    return { limit, remaining, used, plan };
  }
}
