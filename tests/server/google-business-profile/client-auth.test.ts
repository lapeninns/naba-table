import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const gbpConfig = vi.hoisted(() => ({
  current: {
    clientId: 'client-id',
    clientSecret: 'client-secret',
    redirectUri: 'https://app.example/api/gbp/callback',
    tokenEncryptionKey: 'encryption-key',
    quotaProject: null as string | null,
    configured: true,
  },
}));

vi.mock('@/lib/env', () => ({
  env: {
    get googleBusinessProfile() {
      return gbpConfig.current;
    },
  },
}));

import {
  buildGoogleBusinessProfileAuthUrl,
  exchangeGoogleBusinessProfileCode,
  refreshGoogleBusinessProfileAccessToken,
  revokeGoogleBusinessProfileToken,
} from '@/server/google-business-profile/clientAuth';
import { GoogleBusinessProfileError } from '@/server/google-business-profile/errors';

const fetchMock = vi.fn();

function jsonResponse(payload: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => payload,
  };
}

function tokenPayload(overrides: Record<string, unknown> = {}) {
  return {
    access_token: 'access-token-1',
    expires_in: 3600,
    refresh_token: 'refresh-token-1',
    scope: 'https://www.googleapis.com/auth/business.manage openid',
    token_type: 'Bearer',
    id_token: 'id-token-1',
    ...overrides,
  };
}

async function expectGbpError(
  promise: Promise<unknown>,
  expected: { code: string; status: number },
) {
  const error = await promise.then(
    () => {
      throw new Error('expected promise to reject');
    },
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(GoogleBusinessProfileError);
  expect((error as GoogleBusinessProfileError).code).toBe(expected.code);
  expect((error as GoogleBusinessProfileError).status).toBe(expected.status);
  return error as GoogleBusinessProfileError;
}

beforeEach(() => {
  gbpConfig.current = {
    clientId: 'client-id',
    clientSecret: 'client-secret',
    redirectUri: 'https://app.example/api/gbp/callback',
    tokenEncryptionKey: 'encryption-key',
    quotaProject: null,
    configured: true,
  };
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('buildGoogleBusinessProfileAuthUrl', () => {
  it('builds an offline-consent OAuth URL scoped to business.manage @contract', () => {
    const url = new URL(buildGoogleBusinessProfileAuthUrl('state-token-1'));

    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe('client-id');
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.example/api/gbp/callback');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/business.manage');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('include_granted_scopes')).toBe('true');
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.searchParams.get('state')).toBe('state-token-1');
  });

  it('fails closed with GBP_NOT_CONFIGURED when the integration env is incomplete @contract @security', () => {
    gbpConfig.current = { ...gbpConfig.current, configured: false };
    expect(() => buildGoogleBusinessProfileAuthUrl('state')).toThrowError(
      expect.objectContaining({ code: 'GBP_NOT_CONFIGURED', status: 503 }),
    );

    gbpConfig.current = { ...gbpConfig.current, configured: true, clientSecret: null as never };
    expect(() => buildGoogleBusinessProfileAuthUrl('state')).toThrowError(
      expect.objectContaining({ code: 'GBP_NOT_CONFIGURED', status: 503 }),
    );
  });
});

describe('exchangeGoogleBusinessProfileCode', () => {
  it('posts the authorization code as form data and maps the full token payload @contract @external-mock', async () => {
    fetchMock.mockResolvedValue(jsonResponse(tokenPayload()));

    const tokens = await exchangeGoogleBusinessProfileCode('auth-code-1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://oauth2.googleapis.com/token');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/x-www-form-urlencoded' });
    const body = init.body as URLSearchParams;
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('auth-code-1');
    expect(body.get('client_id')).toBe('client-id');
    expect(body.get('client_secret')).toBe('client-secret');
    expect(body.get('redirect_uri')).toBe('https://app.example/api/gbp/callback');

    expect(tokens).toEqual({
      accessToken: 'access-token-1',
      expiresIn: 3600,
      refreshToken: 'refresh-token-1',
      grantedScopes: ['https://www.googleapis.com/auth/business.manage', 'openid'],
      tokenType: 'Bearer',
      idToken: 'id-token-1',
    });
  });

  it('normalises partial token payloads to null and empty defaults @contract @external-mock', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        access_token: 'access-token-1',
        expires_in: '3600',
        scope: '   ',
      }),
    );

    const tokens = await exchangeGoogleBusinessProfileCode('auth-code-1');

    expect(tokens).toEqual({
      accessToken: 'access-token-1',
      expiresIn: null,
      refreshToken: null,
      grantedScopes: [],
      tokenType: null,
      idToken: null,
    });
  });

  it('treats a 200 body without access_token as a token exchange failure @contract @external-mock', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ token_type: 'Bearer' }));

    await expectGbpError(exchangeGoogleBusinessProfileCode('auth-code-1'), {
      code: 'GBP_TOKEN_EXCHANGE_FAILED',
      status: 502,
    });
  });

  it('maps invalid_grant to a 409 reauth-required error @contract @external-mock', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: 'invalid_grant', error_description: 'Token has been revoked.' }, {
        ok: false,
        status: 400,
      }),
    );

    const error = await expectGbpError(exchangeGoogleBusinessProfileCode('auth-code-1'), {
      code: 'GBP_REAUTH_REQUIRED',
      status: 409,
    });
    expect(error.message).toContain('reconnect Google Business Profile');
  });

  it('surfaces provider error descriptions on other 4xx token failures as 502 upstream errors @contract @external-mock', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { error: 'invalid_client', error_description: 'The OAuth client was not found.' },
        { ok: false, status: 401 },
      ),
    );

    const error = await expectGbpError(exchangeGoogleBusinessProfileCode('auth-code-1'), {
      code: 'GBP_TOKEN_EXCHANGE_FAILED',
      status: 502,
    });
    expect(error.message).toBe('The OAuth client was not found.');
  });

  it('does not call Google at all when the integration is unconfigured @contract @security', async () => {
    gbpConfig.current = { ...gbpConfig.current, configured: false };

    await expectGbpError(exchangeGoogleBusinessProfileCode('auth-code-1'), {
      code: 'GBP_NOT_CONFIGURED',
      status: 503,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('refreshGoogleBusinessProfileAccessToken', () => {
  it('exchanges the refresh token for a new access token @contract @external-mock', async () => {
    fetchMock.mockResolvedValue(jsonResponse(tokenPayload({ refresh_token: undefined })));

    const tokens = await refreshGoogleBusinessProfileAccessToken('refresh-token-1');

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://oauth2.googleapis.com/token');
    const body = init.body as URLSearchParams;
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('refresh-token-1');
    expect(body.get('redirect_uri')).toBeNull();
    expect(tokens.accessToken).toBe('access-token-1');
    expect(tokens.refreshToken).toBeNull();
  });

  it('surfaces an expired refresh token as reauth-required after a single attempt @contract @external-mock @security', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: 'invalid_grant' }, { ok: false, status: 400 }),
    );

    await expectGbpError(refreshGoogleBusinessProfileAccessToken('stale-refresh-token'), {
      code: 'GBP_REAUTH_REQUIRED',
      status: 409,
    });
    // One request only: a failed refresh must not loop or self-retry.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('propagates network-level failures without wrapping them @contract @external-mock', async () => {
    const networkError = new TypeError('fetch failed');
    fetchMock.mockRejectedValue(networkError);

    await expect(refreshGoogleBusinessProfileAccessToken('refresh-token-1')).rejects.toBe(
      networkError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('revokeGoogleBusinessProfileToken', () => {
  it('posts the token to the revoke endpoint @contract @external-mock', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));

    await expect(revokeGoogleBusinessProfileToken('refresh-token-1')).resolves.toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://oauth2.googleapis.com/revoke');
    expect((init.body as URLSearchParams).get('token')).toBe('refresh-token-1');
  });

  it('treats a 400 revoke response as already revoked @contract @external-mock', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, { ok: false, status: 400 }));

    await expect(revokeGoogleBusinessProfileToken('refresh-token-1')).resolves.toBeUndefined();
  });

  it('maps 5xx revoke failures to GBP_REVOKE_FAILED @contract @external-mock', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, { ok: false, status: 500 }));

    await expectGbpError(revokeGoogleBusinessProfileToken('refresh-token-1'), {
      code: 'GBP_REVOKE_FAILED',
      status: 502,
    });
  });
});
