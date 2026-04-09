import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: unknown, user: any): any {
    if (err || !user) {
      throw err ?? new UnauthorizedException('Invalid or missing access token');
    }
    if (!user.sub || !user.tenantId || !user.role) {
      throw new UnauthorizedException('Access token is missing required claims');
    }
    return user;
  }
}
