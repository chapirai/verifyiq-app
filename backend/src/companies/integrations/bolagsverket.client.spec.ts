import { of } from 'rxjs';
import { BolagsverketClient } from './bolagsverket.client';

describe('BolagsverketClient', () => {
  const tokenUrl = 'https://auth.example.com/oauth2/token';
  const baseConfig = {
    BV_HVD_CLIENT_ID: 'client-id',
    BV_HVD_CLIENT_SECRET: 'client-secret',
    BV_HVD_TOKEN_URL: tokenUrl,
    BV_HVD_SCOPES: 'vardefulla-datamangder:read vardefulla-datamangder:ping',
  };

  const makeClient = (postMock: jest.Mock) => {
    const httpService = {
      post: postMock,
      get: jest.fn(),
    };
    const configService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        const value = (baseConfig as Record<string, string>)[key];
        return value ?? defaultValue;
      }),
    };
    return new BolagsverketClient(httpService as any, configService as any);
  };

  it('caches the access token until expiry', async () => {
    const postMock = jest.fn((url: string) => {
      if (url === tokenUrl) {
        return of({ data: { access_token: 'token-1', expires_in: 3600 } });
      }
      throw new Error(`Unexpected token URL: ${url}`);
    });

    const client = makeClient(postMock);
    const token1 = await client.getAccessToken();
    const token2 = await client.getAccessToken();

    expect(token1).toBe('token-1');
    expect(token2).toBe('token-1');
    expect(postMock).toHaveBeenCalledTimes(1);
  });

  it('refreshes the access token when expired', async () => {
    const tokenResponses = [
      { access_token: 'token-1', expires_in: 3600 },
      { access_token: 'token-2', expires_in: 3600 },
    ];
    const postMock = jest.fn((url: string) => {
      if (url === tokenUrl) {
        return of({ data: tokenResponses.shift() });
      }
      throw new Error(`Unexpected token URL: ${url}`);
    });

    const client = makeClient(postMock);
    const token1 = await client.getAccessToken();
    (client as any).hvdTokenCache.expiresAt = Date.now() - 1;
    const token2 = await client.getAccessToken();

    expect(token1).toBe('token-1');
    expect(token2).toBe('token-2');
    expect(postMock).toHaveBeenCalledTimes(2);
  });
});
