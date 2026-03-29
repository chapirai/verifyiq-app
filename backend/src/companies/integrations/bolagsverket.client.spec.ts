import { of, throwError } from 'rxjs';
import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { BolagsverketClient } from './bolagsverket.client';

describe('BolagsverketClient', () => {
  const tokenUrl = 'https://auth.example.com/oauth2/token';
  const baseConfig = {
    BV_HVD_CLIENT_ID: 'client-id',
    BV_HVD_CLIENT_SECRET: 'client-secret',
    BV_HVD_TOKEN_URL: tokenUrl,
    BV_HVD_SCOPES: 'vardefulla-datamangder:read vardefulla-datamangder:ping',
  };

  const makeClient = (
    postMock: jest.Mock,
    getMock: jest.Mock = jest.fn(),
    extraConfig: Record<string, string> = {},
  ) => {
    const httpService = { post: postMock, get: getMock };
    const config = { ...baseConfig, ...extraConfig };
    const configService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        const value = (config as Record<string, string>)[key];
        return value ?? defaultValue;
      }),
    };
    return new BolagsverketClient(httpService as any, configService as any);
  };

  const makeTokenMock = (token = 'token-1') =>
    jest.fn((url: string) => {
      if (url === tokenUrl) return of({ data: { access_token: token, expires_in: 3600 } });
      throw new Error(`Unexpected POST to: ${url}`);
    });

  // ── OAuth token caching ────────────────────────────────────────────────────

  describe('getAccessToken', () => {
    it('caches the access token until expiry', async () => {
      const postMock = makeTokenMock();
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
        if (url === tokenUrl) return of({ data: tokenResponses.shift() });
        throw new Error(`Unexpected POST to: ${url}`);
      });

      const client = makeClient(postMock);
      const nowSpy = jest.spyOn(Date, 'now');
      nowSpy.mockReturnValueOnce(1_000);
      const token1 = await client.getAccessToken();
      nowSpy.mockReturnValueOnce(10_000_000);
      nowSpy.mockReturnValueOnce(10_000_000);
      const token2 = await client.getAccessToken();
      nowSpy.mockRestore();

      expect(token1).toBe('token-1');
      expect(token2).toBe('token-2');
      expect(postMock).toHaveBeenCalledTimes(2);
    });
  });

  // ── Token revocation ───────────────────────────────────────────────────────

  describe('revokeAccessToken', () => {
    it('returns revoked=false when no revoke URL is configured', async () => {
      const postMock = makeTokenMock();
      const client = makeClient(postMock);
      await client.getAccessToken();
      const result = await client.revokeAccessToken();
      expect(result.revoked).toBe(false);
      expect(result.error).toMatch(/not configured/i);
    });

    it('revokes the token when a revoke URL is configured', async () => {
      const revokeUrl = 'https://auth.example.com/oauth2/revoke';
      const postMock = jest.fn((url: string) => {
        if (url === tokenUrl) return of({ data: { access_token: 'token-1', expires_in: 3600 } });
        if (url === revokeUrl) return of({ data: {} });
        throw new Error(`Unexpected POST to: ${url}`);
      });
      const client = makeClient(postMock, jest.fn(), { BV_HVD_REVOKE_URL: revokeUrl });
      await client.getAccessToken();
      const result = await client.revokeAccessToken();
      expect(result.revoked).toBe(true);
      expect(postMock).toHaveBeenCalledWith(revokeUrl, expect.any(String), expect.any(Object));
    });

    it('returns revoked=false with an error when revocation request fails', async () => {
      const revokeUrl = 'https://auth.example.com/oauth2/revoke';
      const postMock = jest.fn((url: string) => {
        if (url === tokenUrl) return of({ data: { access_token: 'token-1', expires_in: 3600 } });
        if (url === revokeUrl) return throwError(() => new Error('network error'));
        throw new Error(`Unexpected POST to: ${url}`);
      });
      const client = makeClient(postMock, jest.fn(), { BV_HVD_REVOKE_URL: revokeUrl });
      await client.getAccessToken();
      const result = await client.revokeAccessToken();
      expect(result.revoked).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('returns revoked=false when no access token is cached', async () => {
      const revokeUrl = 'https://auth.example.com/oauth2/revoke';
      const postMock = jest.fn();
      const client = makeClient(postMock, jest.fn(), { BV_HVD_REVOKE_URL: revokeUrl });
      const result = await client.revokeAccessToken();
      expect(result.revoked).toBe(false);
      expect(result.error).toMatch(/no access token/i);
    });
  });

  // ── Företagsinformation auth ───────────────────────────────────────────────

  describe('fetchOrganisationInformation (Företagsinformation auth)', () => {
    const orgUrl = 'https://gw.api.bolagsverket.se/foretagsinformation/v4/organisationsinformation';

    it('uses BV_FORETAGSINFO_BEARER_TOKEN as Authorization header', async () => {
      const getMock = jest.fn();
      const postMock = jest.fn((url: string) => {
        if (url === tokenUrl) return of({ data: { access_token: 'hvd-token', expires_in: 3600 } });
        if (url === orgUrl) return of({ data: [{ identitetsbeteckning: '5560000001' }] });
        throw new Error(`Unexpected POST to: ${url}`);
      });
      const client = makeClient(postMock, getMock, {
        BV_FORETAGSINFO_BEARER_TOKEN: 'org-bearer-token',
      });

      await client.fetchOrganisationInformation('5560000001');

      const orgCall = (postMock.mock.calls as unknown as [string, unknown, { headers: Record<string, string> }][]).find(
        ([url]) => url === orgUrl,
      );
      expect(orgCall).toBeDefined();
      const headers = orgCall![2].headers;
      expect(headers['Authorization']).toBe('Bearer org-bearer-token');
    });

    it('uses BV_FORETAGSINFO_AUTH_VALUE verbatim as the auth header value', async () => {
      const postMock = jest.fn((url: string) => {
        if (url === tokenUrl) return of({ data: { access_token: 'hvd-token', expires_in: 3600 } });
        if (url === orgUrl) return of({ data: [{}] });
        throw new Error(`Unexpected POST to: ${url}`);
      });
      const client = makeClient(postMock, jest.fn(), {
        BV_FORETAGSINFO_AUTH_VALUE: 'ApiKey my-api-key-123',
      });

      await client.fetchOrganisationInformation('5560000001');

      const orgCall = (postMock.mock.calls as unknown as [string, unknown, { headers: Record<string, string> }][]).find(
        ([url]) => url === orgUrl,
      );
      const headers = orgCall![2].headers;
      expect(headers['Authorization']).toBe('ApiKey my-api-key-123');
    });

    it('uses a custom header name when BV_FORETAGSINFO_AUTH_HEADER is set', async () => {
      const postMock = jest.fn((url: string) => {
        if (url === tokenUrl) return of({ data: { access_token: 'hvd-token', expires_in: 3600 } });
        if (url === orgUrl) return of({ data: [{}] });
        throw new Error(`Unexpected POST to: ${url}`);
      });
      const client = makeClient(postMock, jest.fn(), {
        BV_FORETAGSINFO_AUTH_HEADER: 'X-Custom-Auth',
        BV_FORETAGSINFO_AUTH_VALUE: 'custom-value',
      });

      await client.fetchOrganisationInformation('5560000001');

      const orgCall = (postMock.mock.calls as unknown as [string, unknown, { headers: Record<string, string> }][]).find(
        ([url]) => url === orgUrl,
      );
      const headers = orgCall![2].headers;
      expect(headers['X-Custom-Auth']).toBe('custom-value');
      expect(headers['Authorization']).toBeUndefined();
    });

    it('falls back to legacy x-client-id/x-client-secret when no token is configured', async () => {
      const postMock = jest.fn((url: string) => {
        if (url === tokenUrl) return of({ data: { access_token: 'hvd-token', expires_in: 3600 } });
        if (url === orgUrl) return of({ data: [{}] });
        throw new Error(`Unexpected POST to: ${url}`);
      });
      const client = makeClient(postMock, jest.fn(), {
        BV_CLIENT_ID: 'legacy-client-id',
        BV_CLIENT_SECRET: 'legacy-client-secret',
      });

      await client.fetchOrganisationInformation('5560000001');

      const orgCall = (postMock.mock.calls as unknown as [string, unknown, { headers: Record<string, string> }][]).find(
        ([url]) => url === orgUrl,
      );
      const headers = orgCall![2].headers;
      expect(headers['x-client-id']).toBe('legacy-client-id');
      expect(headers['x-client-secret']).toBe('legacy-client-secret');
    });
  });

  // ── Document download ──────────────────────────────────────────────────────

  describe('fetchDocument', () => {
    const hvdBaseUrl = 'https://gw.api.bolagsverket.se/vardefulla-datamangder/v1';
    const defaultDocumentUrl = `${hvdBaseUrl}/dokument`;

    const makeDocumentClient = (
      responseHeaders: Record<string, string> = {},
      extraConfig: Record<string, string> = {},
    ) => {
      const postMock = jest.fn((url: string) => {
        if (url === tokenUrl) return of({ data: { access_token: 'token-1', expires_in: 3600 } });
        if (url === defaultDocumentUrl)
          return of({ data: Buffer.from('ZIP-CONTENT'), headers: { 'content-type': 'application/zip', ...responseHeaders } });
        throw new Error(`Unexpected POST to: ${url}`);
      });
      return { client: makeClient(postMock, jest.fn(), extraConfig), postMock };
    };

    it('returns a Buffer with content-type and no fileName when no Content-Disposition header', async () => {
      const { client } = makeDocumentClient();
      const result = await client.fetchDocument('doc-123');
      expect(result.responsePayload).toBeInstanceOf(Buffer);
      expect(result.contentType).toBe('application/zip');
      expect(result.fileName).toBeUndefined();
    });

    it('parses a quoted Content-Disposition filename', async () => {
      const { client } = makeDocumentClient({
        'content-disposition': 'attachment; filename="rapport_2024.zip"',
      });
      const result = await client.fetchDocument('doc-123');
      expect(result.fileName).toBe('rapport_2024.zip');
    });

    it('parses a UTF-8 RFC 5987 Content-Disposition filename', async () => {
      const { client } = makeDocumentClient({
        'content-disposition': "attachment; filename*=UTF-8''rapport%202024.zip",
      });
      const result = await client.fetchDocument('doc-123');
      expect(result.fileName).toBe('rapport 2024.zip');
    });

    it('parses an unquoted Content-Disposition filename', async () => {
      const { client } = makeDocumentClient({
        'content-disposition': 'attachment; filename=rapport.zip',
      });
      const result = await client.fetchDocument('doc-123');
      expect(result.fileName).toBe('rapport.zip');
    });

    it('uses a GET request when BV_HVD_DOCUMENT_PATH contains {dokumentId}', async () => {
      const getMock = jest.fn((url: string) => {
        if (url === `${hvdBaseUrl}/dokument/doc-456`)
          return of({ data: Buffer.alloc(0), headers: { 'content-type': 'application/zip' } });
        throw new Error(`Unexpected GET to: ${url}`);
      });
      const postMock = makeTokenMock();
      const client = makeClient(postMock, getMock, {
        BV_HVD_DOCUMENT_PATH: '/dokument/{dokumentId}',
      });

      const result = await client.fetchDocument('doc-456');
      expect(getMock).toHaveBeenCalledWith(
        `${hvdBaseUrl}/dokument/doc-456`,
        expect.objectContaining({ responseType: 'arraybuffer' }),
      );
      expect(result.requestPayload).toBeNull();
    });
  });

  // ── Error mapping ──────────────────────────────────────────────────────────

  describe('error mapping', () => {
    it('throws BadRequestException on HTTP 400', async () => {
      const postMock = jest.fn((url: string) => {
        if (url === tokenUrl) return of({ data: { access_token: 'token-1', expires_in: 3600 } });
        return throwError(() => ({ response: { status: 400, data: { detail: 'bad input' } } }));
      });
      const client = makeClient(postMock);
      await expect(client.fetchOrganisationInformation('invalid')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws UnauthorizedException on HTTP 401', async () => {
      const postMock = jest.fn((url: string) => {
        if (url === tokenUrl) return of({ data: { access_token: 'token-1', expires_in: 3600 } });
        return throwError(() => ({ response: { status: 401 } }));
      });
      const client = makeClient(postMock, jest.fn(), { BV_FORETAGSINFO_BEARER_TOKEN: 'tok' });
      await expect(client.fetchOrganisationInformation('5560000001')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws ForbiddenException on HTTP 403', async () => {
      const postMock = jest.fn((url: string) => {
        if (url === tokenUrl) return of({ data: { access_token: 'token-1', expires_in: 3600 } });
        return throwError(() => ({ response: { status: 403 } }));
      });
      const client = makeClient(postMock, jest.fn(), { BV_FORETAGSINFO_BEARER_TOKEN: 'tok' });
      await expect(client.fetchOrganisationInformation('5560000001')).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
