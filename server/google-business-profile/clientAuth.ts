import ky from 'ky';

import { env } from '@/lib/env';

import { readGoogleJsonResponse } from './clientTransport';
import { GoogleBusinessProfileError } from './errors';
import { googleTokenErrorSchema, googleTokenSuccessSchema } from './providerSchemas';

const GOOGLE_OAUTH_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_BUSINESS_PROFILE_SCOPES = [
  'https://www.googleapis.com/auth/business.manage',
  'openid',
  'email',
  'profile',
] as const;

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

export type GoogleBusinessProfileTokens = {
  accessToken: string;
  expiresIn: number | null;
  refreshToken: string | null;
  grantedScopes: string[];
  tokenType: string | null;
  idToken: string | null;
};

function assertConfigured() {
  const { clientId, clientSecret, redirectUri, configured } = env.googleBusinessProfile;
  if (!configured || !clientId || !clientSecret || !redirectUri) {
    throw new GoogleBusinessProfileError(
      'Google Business Profile integration is not configured for this environment.',
      { code: 'GBP_NOT_CONFIGURED', status: 503 },
    );
  }

  return { clientId, clientSecret, redirectUri };
}

function parseTokenError(payload: GoogleTokenResponse): GoogleBusinessProfileError {
  const code = payload.error ?? 'GBP_TOKEN_EXCHANGE_FAILED';
  if (code === 'invalid_grant') {
    return new GoogleBusinessProfileError(
      'Google authorization has expired or been revoked. Please reconnect Google Business Profile.',
      { code: 'GBP_REAUTH_REQUIRED', status: 409 },
    );
  }

  return new GoogleBusinessProfileError(
    payload.error_description ?? 'Google Business Profile authorization failed.',
    { code: 'GBP_TOKEN_EXCHANGE_FAILED', status: 502 },
  );
}

function mapTokenResponse(
  payload: GoogleTokenResponse,
  accessToken: string,
): GoogleBusinessProfileTokens {
  return {
    accessToken,
    expiresIn: typeof payload.expires_in === 'number' ? payload.expires_in : null,
    refreshToken: payload.refresh_token ?? null,
    grantedScopes:
      typeof payload.scope === 'string' ? payload.scope.split(/\s+/).filter(Boolean) : [],
    tokenType: payload.token_type ?? null,
    idToken: payload.id_token ?? null,
  };
}

export function buildGoogleBusinessProfileAuthUrl(state: string, nonce: string): string {
  const { clientId, redirectUri } = assertConfigured();
  const url = new URL(GOOGLE_OAUTH_AUTHORIZE_URL);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GOOGLE_BUSINESS_PROFILE_SCOPES.join(' '));
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', state);
  url.searchParams.set('nonce', nonce);
  return url.toString();
}

async function postOAuthForm(
  path: 'token' | 'revoke',
  body: URLSearchParams,
  readBody = false,
): Promise<{ readonly response: Response; readonly payload?: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new DOMException('Deadline exceeded', 'TimeoutError')),
    15_000,
  );
  try {
    const response = await ky.post(path, {
      prefix: 'https://oauth2.googleapis.com/',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      retry: 0,
      timeout: false,
      totalTimeout: 15_000,
      signal: controller.signal,
      throwHttpErrors: false,
      redirect: 'manual',
    });
    const payload = readBody
      ? await readGoogleJsonResponse(response, controller.signal)
      : undefined;
    return { response, payload };
  } finally {
    clearTimeout(timer);
  }
}

function parseTokenResponse(payload: unknown): GoogleTokenResponse {
  const success = googleTokenSuccessSchema.safeParse(payload);
  if (success.success) return success.data;
  const failure = googleTokenErrorSchema.safeParse(payload);
  if (failure.success) return failure.data;
  throw new GoogleBusinessProfileError('Google OAuth returned a malformed response.', {
    code: 'GBP_MALFORMED_RESPONSE',
    status: 502,
    kind: 'malformed_response',
  });
}

export async function exchangeGoogleBusinessProfileCode(
  code: string,
): Promise<GoogleBusinessProfileTokens> {
  const { clientId, clientSecret, redirectUri } = assertConfigured();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });

  const { response, payload: rawPayload } = await postOAuthForm('token', body, true);
  const payload = parseTokenResponse(rawPayload);
  const accessToken = payload.access_token;
  if (!response.ok || !accessToken) {
    throw parseTokenError(payload);
  }

  return mapTokenResponse(payload, accessToken);
}

export async function refreshGoogleBusinessProfileAccessToken(
  refreshToken: string,
): Promise<GoogleBusinessProfileTokens> {
  const { clientId, clientSecret } = assertConfigured();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const { response, payload: rawPayload } = await postOAuthForm('token', body, true);
  const payload = parseTokenResponse(rawPayload);
  const accessToken = payload.access_token;
  if (!response.ok || !accessToken) {
    throw parseTokenError(payload);
  }

  return mapTokenResponse(payload, accessToken);
}

export async function revokeGoogleBusinessProfileToken(token: string): Promise<void> {
  const { response } = await postOAuthForm('revoke', new URLSearchParams({ token }));

  if (!response.ok && response.status !== 400) {
    throw new GoogleBusinessProfileError('Unable to revoke Google authorization.', {
      code: 'GBP_REVOKE_FAILED',
      status: 502,
    });
  }
}
