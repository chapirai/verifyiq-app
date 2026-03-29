import { of } from 'rxjs';
import { IntegrationTokenService } from './integration-token.service';
import { AuditEventType } from '../../audit/audit-event.entity';

describe('IntegrationTokenService', () => {
  const baseConfig = {
    JWT_SECRET: 'a-very-long-jwt-secret-for-tests',
    BV_HVD_CLIENT_ID: 'hvd-client',
    BV_HVD_CLIENT_SECRET: 'hvd-secret',
    BV_HVD_TOKEN_URL: 'https://auth.example.com/oauth/token',
    BV_HVD_SCOPES: 'scope:read',
  };

  const makeService = () => {
    const tokenRepo = {
      findOne: jest.fn(),
      create: jest.fn((input) => ({ ...input })),
      save: jest.fn(async (entity) => ({ id: 'token-1', ...entity })),
    };
    const httpService = {
      get: jest.fn(() =>
        of({
          data: { access_token: 'fresh-token', expires_in: 3600, token_type: 'Bearer', scope: 'scope:read' },
        }),
      ),
    };
    const configService = {
      get: jest.fn((key: string, defaultValue?: string) => (baseConfig as Record<string, string>)[key] ?? defaultValue),
      getOrThrow: jest.fn((key: string) => (baseConfig as Record<string, string>)[key]),
    };
    const auditService = {
      emitAuditEvent: jest.fn().mockResolvedValue(null),
    };

    const service = new IntegrationTokenService(
      tokenRepo as any,
      httpService as any,
      configService as any,
      auditService as any,
    );

    return { service, tokenRepo, httpService, auditService };
  };

  it('returns existing valid tenant token without refresh', async () => {
    const { service, tokenRepo, httpService } = makeService();
    const encrypted = (service as any).encrypt('cached-token');
    tokenRepo.findOne.mockResolvedValue({
      tenantId: 'tenant-1',
      providerKey: 'bolagsverket:hvd:scope:read',
      encryptedAccessToken: encrypted,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const token = await service.getTenantAccessToken('tenant-1', 'hvd');

    expect(token).toBe('cached-token');
    expect(httpService.get).not.toHaveBeenCalled();
  });

  it('refreshes and persists token when expired', async () => {
    const { service, tokenRepo, httpService, auditService } = makeService();
    tokenRepo.findOne.mockResolvedValue({
      tenantId: 'tenant-1',
      providerKey: 'bolagsverket:hvd:scope:read',
      encryptedAccessToken: 'old',
      expiresAt: new Date(Date.now() - 1000),
    });

    const token = await service.getTenantAccessToken('tenant-1', 'hvd', 'corr-1', 'actor-1');

    expect(token).toBe('fresh-token');
    expect(httpService.get).toHaveBeenCalledTimes(1);
    expect(tokenRepo.save).toHaveBeenCalledTimes(1);
    expect(auditService.emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: AuditEventType.REFRESH_COMPLETED,
        resourceId: 'bolagsverket:hvd:scope:read',
      }),
    );
  });

  it('de-duplicates parallel refresh requests for same tenant/provider', async () => {
    const { service, tokenRepo, httpService } = makeService();
    tokenRepo.findOne.mockResolvedValue(null);
    httpService.get.mockReturnValue(
      of({
        data: { access_token: 'parallel-fresh-token', expires_in: 3600, token_type: 'Bearer', scope: 'scope:read' },
      }),
    );

    const first = service.getTenantAccessToken('tenant-1', 'hvd');
    const second = service.getTenantAccessToken('tenant-1', 'hvd');
    const [token1, token2] = await Promise.all([first, second]);

    expect(token1).toBe('parallel-fresh-token');
    expect(token2).toBe('parallel-fresh-token');
    expect(httpService.get).toHaveBeenCalledTimes(1);
  });
});
