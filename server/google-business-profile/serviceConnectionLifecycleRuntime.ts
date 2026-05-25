import { revokeGoogleBusinessProfileToken } from './client';
import { decryptGoogleBusinessProfileSecret } from './crypto';
import { discoverGoogleBusinessProfileLocationsForProfile } from './serviceAccessRuntime';
import { findSelectedGoogleBusinessProfileLocation } from './serviceConnectionContext';
import {
  buildDisconnectedExternalProfileUpdate,
  buildLinkedLocationExternalProfileUpdate,
} from './serviceConnectionLifecyclePayloads';
import { getGoogleBusinessProfileConnectionStateForClient } from './serviceConnectionStateRuntime';
import {
  deleteCredentialsForExternalProfile,
  ensureExternalProfile,
  getCredentialRow,
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
): Promise<GoogleBusinessProfileConnectionState> {
  const externalProfile = await ensureExternalProfile(restaurantId, client);
  const credential = await getCredentialRow(externalProfile.id, client);

  if (credential?.refresh_token_encrypted) {
    try {
      await revokeGoogleBusinessProfileToken(
        decryptGoogleBusinessProfileSecret(credential.refresh_token_encrypted),
      );
    } catch (error) {
      console.warn('[gbp] failed to revoke Google token during disconnect', error);
    }
  }

  await deleteCredentialsForExternalProfile(externalProfile.id, client);

  await updateExternalProfile(externalProfile.id, buildDisconnectedExternalProfileUpdate(), client);

  return getGoogleBusinessProfileConnectionStateForClient(restaurantId, client);
}
