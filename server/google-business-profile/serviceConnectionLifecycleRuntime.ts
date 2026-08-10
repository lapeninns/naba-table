import { revokeGoogleBusinessProfileToken } from './client';
import { decryptGoogleBusinessProfileSecret } from './crypto';
import { GoogleBusinessProfileError } from './errors';
import { discoverGoogleBusinessProfileLocationsForProfile } from './serviceAccessRuntime';
import { findSelectedGoogleBusinessProfileLocation } from './serviceConnectionContext';
import { buildLinkedLocationExternalProfileUpdate } from './serviceConnectionLifecyclePayloads';
import { getGoogleBusinessProfileConnectionStateForClient } from './serviceConnectionStateRuntime';
import {
  disconnectConnectionFenced,
  ensureExternalProfile,
  getCredentialRow,
  transitionConnectionFenced,
  updateExternalProfile,
  type DbClient,
} from './serviceRepository';

import type { GoogleBusinessProfileAvailableLocation } from './client';
import type {
  GoogleBusinessProfileConnectionState,
  LinkGoogleBusinessProfileLocationInput,
} from './serviceConnectionStateTypes';

export async function getGoogleBusinessProfileAvailableLocationsForClient(
  restaurantId: string,
  client: DbClient,
  options: { forceRefresh?: boolean } = {},
): Promise<GoogleBusinessProfileAvailableLocation[]> {
  const state = await getGoogleBusinessProfileConnectionStateForClient(restaurantId, client, {
    includeAvailableLocations: true,
    forceRefreshLocations: options.forceRefresh,
  });
  return state.availableLocations;
}

export async function linkGoogleBusinessProfileLocationForClient(
  restaurantId: string,
  input: LinkGoogleBusinessProfileLocationInput,
  client: DbClient,
): Promise<GoogleBusinessProfileConnectionState> {
  const externalProfile = await ensureExternalProfile(restaurantId, client);
  const { availableLocations } = await discoverGoogleBusinessProfileLocationsForProfile(
    externalProfile,
    client,
  );
  const selected = findSelectedGoogleBusinessProfileLocation(availableLocations, input);

  await updateExternalProfile(
    externalProfile.id,
    buildLinkedLocationExternalProfileUpdate(selected),
    client,
  );

  return getGoogleBusinessProfileConnectionStateForClient(restaurantId, client);
}

export async function disconnectGoogleBusinessProfileConnectionForClient(
  restaurantId: string,
  client: DbClient,
  options?: {
    readonly actorUserId: string;
    readonly teardownNotifications: () => Promise<void>;
    readonly onRevocationUncertain: (context: {
      readonly restaurantId: string;
      readonly externalProfileRowId: string;
    }) => Promise<void>;
  },
): Promise<GoogleBusinessProfileConnectionState> {
  if (!options) {
    throw new GoogleBusinessProfileError('Disconnect requires a fenced operator context.', {
      code: 'GBP_DISCONNECT_CONTEXT_REQUIRED',
      status: 409,
    });
  }
  const externalProfile = await ensureExternalProfile(restaurantId, client);
  const credential = await getCredentialRow(externalProfile.id, client);

  await transitionConnectionFenced(
    {
      p_restaurant_id: restaurantId,
      p_external_profile_row_id: externalProfile.id,
      p_expected_account_id: externalProfile.external_account_id,
      p_expected_profile_id: externalProfile.external_profile_id,
      p_expected_location_id: externalProfile.external_location_id,
      p_connection_generation: externalProfile.connection_generation,
      p_consent_epoch: externalProfile.consent_epoch,
      p_next_state: 'revoking',
      p_reason_code: 'operator_disconnect',
      p_actor_user_id: options.actorUserId,
    },
    client,
  );
  await options.teardownNotifications();

  if (credential?.refresh_token_encrypted) {
    try {
      await revokeGoogleBusinessProfileToken(
        decryptGoogleBusinessProfileSecret(credential.refresh_token_encrypted, externalProfile.id),
      );
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      await options.onRevocationUncertain({
        restaurantId,
        externalProfileRowId: externalProfile.id,
      });
      return getGoogleBusinessProfileConnectionStateForClient(restaurantId, client);
    }
  }

  await disconnectConnectionFenced(
    {
      p_restaurant_id: restaurantId,
      p_external_profile_row_id: externalProfile.id,
      p_expected_account_id: externalProfile.external_account_id,
      p_expected_profile_id: externalProfile.external_profile_id,
      p_expected_location_id: externalProfile.external_location_id,
      p_connection_generation: externalProfile.connection_generation,
      p_consent_epoch: externalProfile.consent_epoch + 1,
      p_reason_code: 'provider_revoked',
      p_actor_user_id: options.actorUserId,
    },
    client,
  );

  return getGoogleBusinessProfileConnectionStateForClient(restaurantId, client);
}
