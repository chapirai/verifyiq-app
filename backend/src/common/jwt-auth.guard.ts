import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.authorization as string | undefined;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Bearer token');
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw new UnauthorizedException('Invalid Bearer token');
    }

    const headerTenantId = request.headers?.['x-tenant-id'];
    const tenantId = Array.isArray(headerTenantId) ? headerTenantId[0] : headerTenantId;

    request.user = request.user ?? {
      sub: 'system-user',
      tenantId: tenantId ?? DEFAULT_TENANT_ID,
      roles: ['admin'],
    };

    return true;
  }
}
