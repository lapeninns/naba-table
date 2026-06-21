import { logger } from '@/lib/logger';

import {
  buildGoogleBusinessProfileAuthUrl,
  exchangeGoogleBusinessProfileCode,
  fetchGoogleBusinessProfileIdentity,
} from './client';
import {
  consumeOAuthStateRecord,
  createOAuthStateRecord,
  saveGoogleBusinessProfileCredentials,
} from './serviceAuthorizationFlow';
import {
  buildAuthorizationCompletedExternalProfileUpdate,
  buildAuthorizationFailureExternalProfileUpdate,
  buildAuthorizationPendingExternalProfileUpdate,
} from './serviceConnectionLifecyclePayloads';
import { sanitizeOAuthReturnPath } from './serviceOAuthState';
import { ensureExternalProfile, updateExternalProfile, type DbClient } from './serviceRepository';

import type { GoogleBusinessProfileIdentity } from './client';

const gbpAuthorizationLogger = logger.child({ module: 'gbp' });

export type GoogleBusinessProfileAuthorizationRuntimeClock = () => string;

const nowIso: GoogleBusinessProfileAuthorizationRuntimeClock = () => new Date().toISOString();

export async function createGoogleBusinessProfileAuthorizationForClient(params: {
  restaurantId: string;
  requestedByUserId: string;
  returnPath?: string;
  client: DbClient;
}): Promise<{ authorizationUrl: string; stateToken: string }> {
  const externalProfile = await ensureExternalProfile(params.restaurantId, params.client);
  const stateToken = await createOAuthStateRecord(
    {
      restaurantId: params.restaurantId,
      requestedByUserId: params.requestedByUserId,
      returnPath: params.returnPath,
    },
    params.client,
  );

  await updateExternalProfile(
    externalProfile.id,
    buildAuthorizationPendingExternalProfileUpdate(),
    params.client,
  );

  return {
    authorizationUrl: buildGoogleBusinessProfileAuthUrl(stateToken),
    stateToken,
  };
}

export async function createGoogleBusinessProfileAuthorizationUrlForClient(params: {
  restaurantId: string;
  requestedByUserId: string;
  returnPath?: string;
  client: DbClient;
}): Promise<string> {
  const result = await createGoogleBusinessProfileAuthorizationForClient(params);
  return result.authorizationUrl;
}

export async function completeGoogleBusinessProfileAuthorizationForClient(params: {
  stateToken: string;
  code: string;
  requestedByUserId: string;
  expectedRestaurantId?: string;
  client: DbClient;
  clock?: GoogleBusinessProfileAuthorizationRuntimeClock;
}): Promise<{ restaurantId: string; returnPath: string }> {
  const resolveNow = params.clock ?? nowIso;
  const state = await consumeOAuthStateRecord(
    {
      stateToken: params.stateToken,
      requestedByUserId: params.requestedByUserId,
      expectedRestaurantId: params.expectedRestaurantId,
      consumedAt: resolveNow(),
    },
    params.client,
  );
  const externalProfile = await ensureExternalProfile(state.restaurant_id, params.client);

  try {
    const tokens = await exchangeGoogleBusinessProfileCode(params.code);
    let identity: GoogleBusinessProfileIdentity = {
      providerUserId: null,
      email: null,
      name: null,
    };

    try {
      identity = await fetchGoogleBusinessProfileIdentity(tokens.accessToken);
    } catch (error) {
      gbpAuthorizationLogger.warn('oauth identity lookup skipped', {
        restaurantId: state.restaurant_id,
        error,
      });
    }

    await saveGoogleBusinessProfileCredentials(
      {
        externalProfile,
        tokens,
        identity,
        refreshedAt: resolveNow(),
      },
      params.client,
    );
    await updateExternalProfile(
      externalProfile.id,
      buildAuthorizationCompletedExternalProfileUpdate(externalProfile),
      params.client,
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Google Business Profile authorization failed unexpectedly.';

    gbpAuthorizationLogger.error('oauth completion failed', {
      restaurantId: state.restaurant_id,
      returnPath: sanitizeOAuthReturnPath(state.return_path),
      error,
    });

    await updateExternalProfile(
      externalProfile.id,
      buildAuthorizationFailureExternalProfileUpdate(message),
      params.client,
    );
    throw error;
  }

  return {
    restaurantId: state.restaurant_id,
    returnPath: sanitizeOAuthReturnPath(state.return_path),
  };
}
