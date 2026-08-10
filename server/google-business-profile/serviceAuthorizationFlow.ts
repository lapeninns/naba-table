import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { MembershipAccessError, requireAdminMembership } from '@/server/team/access';

import { decryptGoogleBusinessProfileSecret, encryptGoogleBusinessProfileSecret } from './crypto';
import { GoogleBusinessProfileError } from './errors';
import { deriveLegacyBoundOAuthNonce, hashOAuthNonce } from './oauthNonce';
import { resolveGoogleBusinessProfileRefreshToken } from './serviceCredentialPayloads';
import {
  assertOAuthStateBelongsToRequest,
  assertOAuthStateRecordCanBeConsumed,
  createOAuthStateNotFoundError,
  GOOGLE_BUSINESS_PROFILE_DEFAULT_RETURN_PATH,
  GOOGLE_BUSINESS_PROFILE_OAUTH_STATE_TTL_MS,
  sanitizeOAuthReturnPath,
} from './serviceOAuthState';
import {
  completeOAuthIdentity,
  createOAuthAttempt,
  findExternalProfile,
  getCredentialRow,
  readOAuthAttemptByHash,
  type DbClient,
  type ExternalProfileRow,
  type OAuthStateRow,
} from './serviceRepository';

import type { GoogleBusinessProfileIdentity, GoogleBusinessProfileTokens } from './client';

export async function saveGoogleBusinessProfileCredentials(
  params: {
    externalProfile: ExternalProfileRow;
    tokens: GoogleBusinessProfileTokens;
    identity: GoogleBusinessProfileIdentity;
    refreshedAt: string;
  },
  client: DbClient,
): Promise<void> {
  void params;
  void client;
  throw new GoogleBusinessProfileError('Legacy credential persistence is retired.', {
    code: 'GBP_LEGACY_CREDENTIAL_WRITE_RETIRED',
    status: 409,
  });
}

export async function createOAuthStateRecord(
  params: {
    restaurantId: string;
    requestedByUserId: string;
    returnPath?: string;
    expiresAt?: string;
    stateToken?: string;
  },
  client: DbClient,
): Promise<string> {
  const stateToken = params.stateToken ?? randomBytes(24).toString('base64url');
  const expiresAt =
    params.expiresAt ??
    new Date(Date.now() + GOOGLE_BUSINESS_PROFILE_OAUTH_STATE_TTL_MS).toISOString();

  const profile = await findExternalProfile(params.restaurantId, client);
  await createOAuthAttempt(
    {
      p_restaurant_id: params.restaurantId,
      p_requested_by_user_id: params.requestedByUserId,
      p_state_hash: createHash('sha256').update(stateToken).digest('hex'),
      p_nonce_hash: hashOAuthNonce(deriveLegacyBoundOAuthNonce(stateToken)),
      p_return_path: sanitizeOAuthReturnPath(
        params.returnPath ?? GOOGLE_BUSINESS_PROFILE_DEFAULT_RETURN_PATH,
      ),
      p_expires_at: expiresAt,
      p_external_profile_row_id: profile?.id ?? null,
      p_expected_external_account_id: profile?.external_account_id ?? null,
      p_expected_external_profile_id: profile?.external_profile_id ?? null,
      p_expected_external_location_id: profile?.external_location_id ?? null,
      p_connection_generation: profile?.connection_generation ?? 1,
      p_consent_epoch: profile?.consent_epoch ?? 1,
    },
    client,
  );

  return stateToken;
}

async function assertOAuthStateCanBeCompleted(
  state: OAuthStateRow,
  params: {
    requestedByUserId: string;
    expectedRestaurantId?: string;
    client: DbClient;
  },
): Promise<void> {
  assertOAuthStateBelongsToRequest(state, {
    requestedByUserId: params.requestedByUserId,
    expectedRestaurantId: params.expectedRestaurantId,
  });

  try {
    await requireAdminMembership({
      userId: params.requestedByUserId,
      restaurantId: state.restaurant_id,
      client: params.client,
    });
  } catch (error) {
    if (error instanceof MembershipAccessError) {
      throw new GoogleBusinessProfileError(
        'You no longer have permission to connect Google Business Profile for this restaurant.',
        { code: 'GBP_STATE_RESTAURANT_FORBIDDEN', status: error.status },
      );
    }
    throw error;
  }
}

export async function consumeOAuthStateRecord(
  params: {
    stateToken: string;
    requestedByUserId: string;
    expectedRestaurantId?: string;
    consumedAt: string;
  },
  client: DbClient,
): Promise<OAuthStateRow> {
  if (!params.expectedRestaurantId) {
    throw new GoogleBusinessProfileError('Google authorization callback is missing its tenant.', {
      code: 'GBP_INVALID_STATE',
      status: 400,
    });
  }
  const data = await readOAuthAttemptByHash(
    createHash('sha256').update(params.stateToken).digest('hex'),
    client,
  );
  if (!data) throw createOAuthStateNotFoundError();
  assertOAuthStateRecordCanBeConsumed(data);

  await assertOAuthStateCanBeCompleted(data, {
    requestedByUserId: params.requestedByUserId,
    expectedRestaurantId: params.expectedRestaurantId,
    client,
  });

  return data;
}

export async function completeOAuthIdentityRecord(
  params: {
    readonly state: OAuthStateRow;
    readonly stateToken: string;
    readonly requestedByUserId: string;
    readonly tokens: GoogleBusinessProfileTokens;
    readonly identity: GoogleBusinessProfileIdentity;
    readonly refreshedAt: string;
  },
  client: DbClient,
): Promise<ExternalProfileRow> {
  const targetProfileId = params.state.external_profile_row_id ?? randomUUID();
  const existing = params.state.external_profile_row_id
    ? await getCredentialRow(params.state.external_profile_row_id, client)
    : null;
  const existingRefreshToken = existing?.refresh_token_encrypted
    ? decryptGoogleBusinessProfileSecret(existing.refresh_token_encrypted, targetProfileId)
    : null;
  const refreshToken = resolveGoogleBusinessProfileRefreshToken({
    issuedRefreshToken: params.tokens.refreshToken,
    existingRefreshToken,
  });
  return completeOAuthIdentity(
    {
      p_restaurant_id: params.state.restaurant_id,
      p_state_hash: createHash('sha256').update(params.stateToken).digest('hex'),
      p_nonce_hash: hashOAuthNonce(deriveLegacyBoundOAuthNonce(params.stateToken)),
      p_requested_by_user_id: params.requestedByUserId,
      p_target_external_profile_row_id: targetProfileId,
      p_provider_user_id: params.identity.providerUserId,
      p_connected_email: params.identity.email,
      p_connected_name: params.identity.name,
      p_refresh_token_encrypted: encryptGoogleBusinessProfileSecret(refreshToken, targetProfileId),
      p_granted_scopes: params.tokens.grantedScopes,
      p_token_type: params.tokens.tokenType,
      p_refreshed_at: params.refreshedAt,
      p_identity_verified_at: params.refreshedAt,
    },
    client,
  );
}
