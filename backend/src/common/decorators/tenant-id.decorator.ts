import { BadRequestException, createParamDecorator, ExecutionContext } from '@nestjs/common';

export const TenantId = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  const tenantId =
    request.user?.tenantId ??
    request.headers?.['x-tenant-id'] ??
    request.headers?.['X-Tenant-Id'];

  const normalizedTenantId = Array.isArray(tenantId) ? tenantId[0] : tenantId;

  if (!normalizedTenantId) {
    throw new BadRequestException('Tenant id is required');
  }

  return normalizedTenantId;
});
