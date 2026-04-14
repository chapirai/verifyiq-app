import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { API_QUOTA_BUCKET_KEY } from '../constants/api-quota-metadata';
import { ApiQuotaService } from '../services/api-quota.service';

@Injectable()
export class ApiQuotaInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly apiQuota: ApiQuotaService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const bucket = this.reflector.getAllAndOverride<string>(API_QUOTA_BUCKET_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!bucket) {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const user = req.user ?? {};

    const tenantId = user.tenantId as string | undefined;
    if (!tenantId) {
      throw new BadRequestException('tenant_required');
    }

    const environment = (
      typeof user.environment === 'string' ? user.environment : 'live'
    ) as 'live' | 'sandbox';
    const clientKey =
      (typeof user.clientId === 'string' ? user.clientId : null) ??
      (typeof user.sub === 'string' ? user.sub : 'user');

    const quota = await this.apiQuota.consumeQuota({
      tenantId,
      environment,
      clientKey,
      bucket,
    });

    res.setHeader('X-RateLimit-Limit', String(quota.limit));
    res.setHeader('X-RateLimit-Remaining', String(quota.remaining));
    res.setHeader('X-Plan', quota.plan);
    res.setHeader('X-Environment', environment);

    if (!quota.allowed) {
      res.status(429);
      return of({
        error: 'rate_limit_exceeded',
        message: 'Daily quota exceeded for this plan/environment.',
      });
    }

    return next.handle();
  }
}
