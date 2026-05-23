import { env } from '@/lib/env';

import { readGoogleBusinessProfileBusinessInfo } from './business-info';
import { discoverGoogleBusinessProfileLocationsForProfile } from './serviceAccessRuntime';
import { buildConnectionState } from './serviceConnectionContext';
import { findExternalProfile, getCredentialRow, type DbClient } from './serviceRepository';

import type { GoogleBusinessProfileConnectionState } from './serviceConnectionStateTypes';

export type GoogleBusinessProfileConnectionStateOptions = {
  includeAvailableLocations?: boolean;
  forceRefreshLocations?: boolean;
};

function isGoogleBusinessProfileConfigured(): boolean {
  return env.googleBusinessProfile.configured;
}

export async function getGoogleBusinessProfileConnectionStateForClient(
  restaurantId: string,
  client: DbClient,
  options: GoogleBusinessProfileConnectionStateOptions = {},
): Promise<GoogleBusinessProfileConnectionState> {
  const businessInfo = await readGoogleBusinessProfileBusinessInfo(restaurantId, client);
  const externalProfile = await findExternalProfile(restaurantId, client);

  if (!externalProfile) {
    return buildConnectionState({
      isConfigured: isGoogleBusinessProfileConfigured(),
      externalProfile: null,
      credential: null,
      availableLocations: [],
      businessInfo,
    });
  }

  const credential = await getCredentialRow(externalProfile.id, client);

  if (!isGoogleBusinessProfileConfigured() || !credential || !options.includeAvailableLocations) {
    return buildConnectionState({
      isConfigured: isGoogleBusinessProfileConfigured(),
      externalProfile,
      credential,
      availableLocations: [],
      businessInfo,
    });
  }

  try {
    const discovery = await discoverGoogleBusinessProfileLocationsForProfile(
      externalProfile,
      client,
      {
        forceRefresh: options.forceRefreshLocations,
      },
    );
    const refreshedExternalProfile = await findExternalProfile(restaurantId, client);
    return buildConnectionState({
      isConfigured: isGoogleBusinessProfileConfigured(),
      externalProfile: refreshedExternalProfile ?? externalProfile,
      credential: discovery.credential,
      availableLocations: discovery.availableLocations,
      businessInfo,
    });
  } catch {
    const refreshedExternalProfile = await findExternalProfile(restaurantId, client);
    const refreshedCredential = refreshedExternalProfile
      ? await getCredentialRow(refreshedExternalProfile.id, client)
      : null;
    return buildConnectionState({
      isConfigured: isGoogleBusinessProfileConfigured(),
      externalProfile: refreshedExternalProfile ?? externalProfile,
      credential: refreshedCredential ?? credential,
      availableLocations: [],
      businessInfo,
    });
  }
}
