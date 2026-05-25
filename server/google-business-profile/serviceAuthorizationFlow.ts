import { randomBytes } from 'node:crypto';

import { MembershipAccessError, requireAdminMembership } from '@/server/team/access';

import { decryptGoogleBusinessProfileSecret, encryptGoogleBusinessProfileSecret } from './crypto';
import { GoogleBusinessProfileError } from './errors';
import {
  buildGoogleBusinessProfileCredentialUpsert,
  resolveGoogleBusinessProfileRefreshToken,
} from './serviceCredentialPayloads';
import {
  assertOAuthStateBelongsToRequest,
  assertOAuthStateRecordCanBeConsumed,
  buildGoogleBusinessProfileOAuthStateConsumedUpdate,
  buildGoogleBusinessProfileOAuthStateInsert,
  createOAuthStateAlreadyUsedError,
  createOAuthStateNotFoundError,
  GOOGLE_BUSINESS_PROFILE_DEFAULT_RETURN_PATH,
  GOOGLE_BUSINESS_PROFILE_OAUTH_STATE_TTL_MS,
} from './serviceOAuthState';
import {
  getCredentialRow,
  insertOAuthState,
  markOAuthStateConsumed,
  readOAuthStateByToken,
  upsertCredential,
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
  const existing = await getCredentialRow(params.externalProfile.id, client);
  const existingRefreshToken = existing?.refresh_token_encrypted
    ? decryptGoogleBusinessProfileSecret(existing.refresh_token_encrypted)
    : null;
  const refreshToken = resolveGoogleBusinessProfileRefreshToken({
    issuedRefreshToken: params.tokens.refreshToken,
    existingRefreshToken,
  });

  await upsertCredential(
    buildGoogleBusinessProfileCredentialUpsert({
      externalProfileId: params.externalProfile.id,
      tokens: params.tokens,
      identity: params.identity,
      refreshTokenEncrypted: encryptGoogleBusinessProfileSecret(refreshToken),
      refreshedAt: params.refreshedAt,
    }),
    client,
  );
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

  await insertOAuthState(
    buildGoogleBusinessProfileOAuthStateInsert({
      restaurantId: params.restaurantId,
      requestedByUserId: params.requestedByUserId,
      stateToken,
      returnPath: params.returnPath ?? GOOGLE_BUSINESS_PROFILE_DEFAULT_RETURN_PATH,
      expiresAt,
    }),
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
  const data = await readOAuthStateByToken(params.stateToken, client);
  if (!data) {
    throw createOAuthStateNotFoundError();
  }

  assertOAuthStateRecordCanBeConsumed(data);

  await assertOAuthStateCanBeCompleted(data, {
    requestedByUserId: params.requestedByUserId,
    expectedRestaurantId: params.expectedRestaurantId,
    client,
  });

  const consumed = await markOAuthStateConsumed(
    {
      stateId: data.id,
      payload: buildGoogleBusinessProfileOAuthStateConsumedUpdate(params.consumedAt),
    },
    client,
  );

  if (!consumed) {
    throw createOAuthStateAlreadyUsedError();
  }

  return data;
}
