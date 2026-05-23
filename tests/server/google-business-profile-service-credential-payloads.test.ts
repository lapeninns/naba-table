import { describe, expect, it } from 'vitest';

import { GoogleBusinessProfileError } from '@/server/google-business-profile/errors';
import {
  buildGoogleBusinessProfileCredentialRefreshUpdate,
  buildGoogleBusinessProfileCredentialUpsert,
  buildRefreshedGoogleBusinessProfileCredentialRow,
  createGoogleBusinessProfileRefreshTokenMissingError,
  resolveGoogleBusinessProfileRefreshToken,
  resolveRefreshedCredentialGrantedScopes,
  resolveRefreshedCredentialTokenType,
} from '@/server/google-business-profile/serviceCredentialPayloads';

import type {
  GoogleBusinessProfileIdentity,
  GoogleBusinessProfileTokens,
} from '@/server/google-business-profile/client';
import type { Database } from '@/types/supabase';

type CredentialRow = Database['public']['Tables']['restaurant_external_profile_credentials']['Row'];

function tokens(overrides: Partial<GoogleBusinessProfileTokens> = {}): GoogleBusinessProfileTokens {
  return {
    accessToken: 'access-token',
    expiresIn: 3600,
    refreshToken: 'refresh-token',
    grantedScopes: ['https://www.googleapis.com/auth/business.manage'],
    tokenType: 'Bearer',
    idToken: null,
    ...overrides,
  };
}

function identity(
  overrides: Partial<GoogleBusinessProfileIdentity> = {},
): GoogleBusinessProfileIdentity {
  return {
    providerUserId: 'google-user-1',
    email: 'owner@example.com',
    name: 'Owner',
    ...overrides,
  };
}

function credential(overrides: Partial<CredentialRow> = {}): CredentialRow {
  return {
    external_profile_id: 'profile-1',
    provider_user_id: 'google-user-1',
    connected_google_email: 'owner@example.com',
    connected_google_name: 'Owner',
    refresh_token_encrypted: 'enc:old-refresh-token',
    granted_scopes: ['existing-scope'],
    token_type: 'ExistingBearer',
    last_refreshed_at: '2026-05-20T10:00:00.000Z',
    last_error: 'previous error',
    ...overrides,
  } as CredentialRow;
}

describe('google business profile service credential payloads', () => {
  it('resolves issued refresh tokens before existing stored refresh tokens', () => {
    expect(
      resolveGoogleBusinessProfileRefreshToken({
        issuedRefreshToken: 'new-refresh-token',
        existingRefreshToken: 'old-refresh-token',
      }),
    ).toBe('new-refresh-token');

    expect(
      resolveGoogleBusinessProfileRefreshToken({
        issuedRefreshToken: null,
        existingRefreshToken: 'old-refresh-token',
      }),
    ).toBe('old-refresh-token');
  });

  it('throws a stable error when no refresh token is available', () => {
    expect(createGoogleBusinessProfileRefreshTokenMissingError()).toMatchObject({
      code: 'GBP_REFRESH_TOKEN_MISSING',
      status: 409,
      message:
        'Google did not provide a refresh token. Please try reconnecting and grant offline access.',
    });

    expect(() =>
      resolveGoogleBusinessProfileRefreshToken({
        issuedRefreshToken: null,
        existingRefreshToken: null,
      }),
    ).toThrow(GoogleBusinessProfileError);
  });

  it('builds OAuth credential upsert payloads without access token persistence', () => {
    const payload = buildGoogleBusinessProfileCredentialUpsert({
      externalProfileId: 'profile-1',
      tokens: tokens(),
      identity: identity(),
      refreshTokenEncrypted: 'enc:refresh-token',
      refreshedAt: '2026-05-21T10:00:00.000Z',
    });

    expect(payload).toEqual({
      external_profile_id: 'profile-1',
      provider_user_id: 'google-user-1',
      connected_google_email: 'owner@example.com',
      connected_google_name: 'Owner',
      refresh_token_encrypted: 'enc:refresh-token',
      granted_scopes: ['https://www.googleapis.com/auth/business.manage'],
      token_type: 'Bearer',
      last_refreshed_at: '2026-05-21T10:00:00.000Z',
      last_error: null,
    });
    expect(payload).not.toHaveProperty('access_token_encrypted');
    expect(payload).not.toHaveProperty('access_token_expires_at');
  });

  it('uses refreshed scopes and token type when Google returns them', () => {
    const refreshedTokens = tokens({
      grantedScopes: ['scope-a', 'scope-b'],
      tokenType: 'NewBearer',
    });
    const existingCredential = credential();

    expect(
      resolveRefreshedCredentialGrantedScopes({
        refreshedTokens,
        credential: existingCredential,
      }),
    ).toEqual(['scope-a', 'scope-b']);
    expect(
      resolveRefreshedCredentialTokenType({
        refreshedTokens,
        credential: existingCredential,
      }),
    ).toBe('NewBearer');
  });

  it('falls back to existing scopes and token type when refresh omits them', () => {
    const refreshedTokens = tokens({
      grantedScopes: [],
      tokenType: null,
    });
    const existingCredential = credential();

    expect(
      buildGoogleBusinessProfileCredentialRefreshUpdate({
        credential: existingCredential,
        refreshedTokens,
        refreshTokenEncrypted: 'enc:old-refresh-token',
        refreshedAt: '2026-05-21T10:00:00.000Z',
      }),
    ).toEqual({
      refresh_token_encrypted: 'enc:old-refresh-token',
      granted_scopes: ['existing-scope'],
      token_type: 'ExistingBearer',
      last_refreshed_at: '2026-05-21T10:00:00.000Z',
      last_error: null,
    });
  });

  it('builds refreshed credential rows matching the persisted refresh payload', () => {
    const existingCredential = credential();

    expect(
      buildRefreshedGoogleBusinessProfileCredentialRow({
        credential: existingCredential,
        refreshedTokens: tokens({
          grantedScopes: ['scope-a'],
          tokenType: 'Bearer',
        }),
        refreshTokenEncrypted: 'enc:new-refresh-token',
        refreshedAt: '2026-05-21T10:00:00.000Z',
      }),
    ).toEqual({
      ...existingCredential,
      refresh_token_encrypted: 'enc:new-refresh-token',
      granted_scopes: ['scope-a'],
      token_type: 'Bearer',
      last_refreshed_at: '2026-05-21T10:00:00.000Z',
      last_error: null,
    });
  });
});
