import { env } from '@/lib/env';

import { signGoogleBusinessProfileState } from './crypto';

const GOOGLE_OAUTH_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_BUSINESS_PROFILE_SCOPE = 'https://www.googleapis.com/auth/business.manage';

export type GoogleBusinessProfileTokenResponse = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  scope: string[];
  tokenType: string | null;
};

function getRequiredConfig() {
  const config = env.integrations.googleBusinessProfile;
  const clientId = config.clientId;
  const clientSecret = config.clientSecret;
  const redirectUri = config.redirectUri;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Google Business Profile OAuth is not configured.');
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
  };
}

export function buildGoogleBusinessProfileAuthorizationUrl(input: {
  restaurantId: string;
  returnTo: string;
}) {
  const config = getRequiredConfig();
  const url = new URL(GOOGLE_OAUTH_AUTHORIZE_URL);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GOOGLE_BUSINESS_PROFILE_SCOPE);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set(
    'state',
    signGoogleBusinessProfileState({
      restaurantId: input.restaurantId,
      returnTo: input.returnTo,
      issuedAt: Date.now(),
    }),
  );

  return url.toString();
}

async function exchangeToken(params: Record<string, string>): Promise<GoogleBusinessProfileTokenResponse> {
  const config = getRequiredConfig();
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    ...params,
  });

  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    cache: 'no-store',
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        scope?: string;
        token_type?: string;
        error?: string;
        error_description?: string;
      }
    | null;

  if (!response.ok || !payload?.access_token) {
    throw new Error(
      payload?.error_description ||
        payload?.error ||
        `Google Business Profile token exchange failed (${response.status}).`,
    );
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? null,
    expiresAt:
      typeof payload.expires_in === 'number'
        ? new Date(Date.now() + payload.expires_in * 1000).toISOString()
        : null,
    scope: typeof payload.scope === 'string' ? payload.scope.split(/\s+/).filter(Boolean) : [GOOGLE_BUSINESS_PROFILE_SCOPE],
    tokenType: payload.token_type ?? null,
  };
}

export async function exchangeGoogleBusinessProfileCode(code: string) {
  return exchangeToken({
    code,
    grant_type: 'authorization_code',
  });
}

export async function refreshGoogleBusinessProfileAccessToken(refreshToken: string) {
  return exchangeToken({
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
}
