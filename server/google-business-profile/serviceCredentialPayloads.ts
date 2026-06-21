import { GoogleBusinessProfileError } from './errors';

import type { GoogleBusinessProfileIdentity, GoogleBusinessProfileTokens } from './client';
import type { Database } from '@/types/supabase';

type CredentialRow = Database['public']['Tables']['restaurant_external_profile_credentials']['Row'];
type CredentialInsert =
  Database['public']['Tables']['restaurant_external_profile_credentials']['Insert'];
type CredentialUpdate =
  Database['public']['Tables']['restaurant_external_profile_credentials']['Update'];

export function createGoogleBusinessProfileRefreshTokenMissingError(): GoogleBusinessProfileError {
  return new GoogleBusinessProfileError(
    'Google did not provide a refresh token. Please try reconnecting and grant offline access.',
    { code: 'GBP_REFRESH_TOKEN_MISSING', status: 409 },
  );
}

export function resolveGoogleBusinessProfileRefreshToken(params: {
  issuedRefreshToken: string | null;
  existingRefreshToken: string | null;
}): string {
  const refreshToken = params.issuedRefreshToken ?? params.existingRefreshToken;
  if (!refreshToken) {
    throw createGoogleBusinessProfileRefreshTokenMissingError();
  }
  return refreshToken;
}

export function buildGoogleBusinessProfileCredentialUpsert(params: {
  externalProfileId: string;
  tokens: GoogleBusinessProfileTokens;
  identity: GoogleBusinessProfileIdentity;
  refreshTokenEncrypted: string;
  refreshedAt: string;
}): CredentialInsert {
  return {
    external_profile_id: params.externalProfileId,
    provider_user_id: params.identity.providerUserId,
    connected_google_email: params.identity.email,
    connected_google_name: params.identity.name,
    refresh_token_encrypted: params.refreshTokenEncrypted,
    granted_scopes: params.tokens.grantedScopes,
    token_type: params.tokens.tokenType,
    last_refreshed_at: params.refreshedAt,
    last_error: null,
  };
}

export function resolveRefreshedCredentialGrantedScopes(params: {
  refreshedTokens: GoogleBusinessProfileTokens;
  credential: Pick<CredentialRow, 'granted_scopes'>;
}): string[] {
  return params.refreshedTokens.grantedScopes.length > 0
    ? params.refreshedTokens.grantedScopes
    : params.credential.granted_scopes;
}

export function resolveRefreshedCredentialTokenType(params: {
  refreshedTokens: GoogleBusinessProfileTokens;
  credential: Pick<CredentialRow, 'token_type'>;
}): string | null {
  return params.refreshedTokens.tokenType ?? params.credential.token_type;
}

export function buildGoogleBusinessProfileCredentialRefreshUpdate(params: {
  credential: Pick<CredentialRow, 'granted_scopes' | 'token_type'>;
  refreshedTokens: GoogleBusinessProfileTokens;
  refreshTokenEncrypted: string;
  refreshedAt: string;
}): CredentialUpdate {
  return {
    refresh_token_encrypted: params.refreshTokenEncrypted,
    granted_scopes: resolveRefreshedCredentialGrantedScopes(params),
    token_type: resolveRefreshedCredentialTokenType(params),
    last_refreshed_at: params.refreshedAt,
    last_error: null,
  };
}

export function buildRefreshedGoogleBusinessProfileCredentialRow(params: {
  credential: CredentialRow;
  refreshedTokens: GoogleBusinessProfileTokens;
  refreshTokenEncrypted: string;
  refreshedAt: string;
}): CredentialRow {
  return {
    ...params.credential,
    refresh_token_encrypted: params.refreshTokenEncrypted,
    granted_scopes: resolveRefreshedCredentialGrantedScopes(params),
    token_type: resolveRefreshedCredentialTokenType(params),
    last_refreshed_at: params.refreshedAt,
    last_error: null,
  };
}
