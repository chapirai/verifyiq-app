import { ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

const makeContext = (request: Record<string, any>): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  }) as ExecutionContext;

describe('JwtAuthGuard', () => {
  it('defaults tenantId when no header is provided', () => {
    const guard = new JwtAuthGuard();
    const request: Record<string, any> = { headers: { authorization: 'Bearer token' } };

    expect(guard.canActivate(makeContext(request))).toBe(true);
    expect(request.user?.tenantId).toBe(DEFAULT_TENANT_ID);
  });

  it('uses tenantId from header when provided', () => {
    const guard = new JwtAuthGuard();
    const customTenantId = '11111111-1111-1111-1111-111111111111';
    const request: Record<string, any> = {
      headers: { authorization: 'Bearer token', 'x-tenant-id': customTenantId },
    };

    expect(guard.canActivate(makeContext(request))).toBe(true);
    expect(request.user?.tenantId).toBe(customTenantId);
  });
});
