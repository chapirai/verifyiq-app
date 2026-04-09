import { UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  it('returns user when required claims are present', () => {
    const guard = new JwtAuthGuard();
    const user = { sub: 'u1', tenantId: 't1', role: 'admin' };

    expect(guard.handleRequest(null, user)).toEqual(user);
  });

  it('throws when user is missing', () => {
    const guard = new JwtAuthGuard();
    expect(() => guard.handleRequest(null, null)).toThrow(UnauthorizedException);
  });

  it('throws when required claims are missing', () => {
    const guard = new JwtAuthGuard();
    expect(() => guard.handleRequest(null, { sub: 'u1' })).toThrow(UnauthorizedException);
  });
});
