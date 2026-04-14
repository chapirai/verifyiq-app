import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRED_SCOPES_KEY } from '../decorators/required-scopes.decorator';

@Injectable()
export class ScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredScopes =
      this.reflector.getAllAndOverride<string[]>(REQUIRED_SCOPES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    if (!requiredScopes.length) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user ?? {};
    const role = user.role as string | undefined;
    if (!role || role !== 'api_client') return true;

    const scopes = Array.isArray(user.scopes) ? user.scopes : [];
    const ok = requiredScopes.every(s => scopes.includes(s));
    if (!ok) throw new ForbiddenException('insufficient_scope');
    return true;
  }
}
