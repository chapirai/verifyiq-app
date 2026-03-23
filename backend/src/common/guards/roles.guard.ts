import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const role = req.user?.role as string | undefined;

    if (!role) {
      return true;
    }

    const allowed = ['admin', 'compliance', 'reviewer', 'analyst'];
    return allowed.includes(role);
  }
}