import {
  listGoogleBusinessProfileAccounts,
  listGoogleBusinessProfileLocations,
  refreshGoogleBusinessProfileAccessToken,
  type GoogleBusinessProfileAvailableLocation,
} from './client';
import { decryptGoogleBusinessProfileSecret, encryptGoogleBusinessProfileSecret } from './crypto';
import { GoogleBusinessProfileError, isGoogleBusinessProfileError } from './errors';
import {
  buildAuthorizationCompletedExternalProfileUpdate,
  buildReauthRequiredExternalProfileUpdate,
} from './serviceConnectionLifecyclePayloads';
import {
  buildGoogleBusinessProfileCredentialRefreshUpdate,
  buildRefreshedGoogleBusinessProfileCredentialRow,
} from './serviceCredentialPayloads';
import {
  getCredentialRow,
  updateCredentialRefresh,
  updateExternalProfile,
  type CredentialRow,
  type DbClient,
  type ExternalProfileRow,
} from './serviceRepository';

const LOCATION_DISCOVERY_CACHE_TTL_MS = 10 * 60 * 1000;

type LocationDiscoveryCacheEntry = {
  expiresAt: number;
  credential: CredentialRow;
  availableLocations: GoogleBusinessProfileAvailableLocation[];
};

const locationDiscoveryCache = new Map<string, LocationDiscoveryCacheEntry>();

function nowIso(): string {
  return new Date().toISOString();
}

function locationDiscoveryCacheKey(externalProfile: ExternalProfileRow): string {
  return [
    externalProfile.id,
    externalProfile.connection_status ?? 'unknown',
    externalProfile.external_location_id ?? 'no-location',
    externalProfile.updated_at ?? 'no-updated-at',
  ].join(':');
}

export async function getUsableGoogleBusinessProfileAccessToken(
  externalProfile: ExternalProfileRow,
  client: DbClient,
): Promise<{
  accessToken: string;
  credential: CredentialRow;
}> {
  const credential = await getCredentialRow(externalProfile.id, client);
  if (!credential) {
    throw new GoogleBusinessProfileError(
      'Google Business Profile is not connected for this restaurant.',
      { code: 'GBP_NOT_CONNECTED', status: 404 },
    );
  }

  try {
    const refreshed = await refreshGoogleBusinessProfileAccessToken(
      decryptGoogleBusinessProfileSecret(credential.refresh_token_encrypted),
    );

    const updatedRefreshTokenEncrypted = refreshed.refreshToken
      ? encryptGoogleBusinessProfileSecret(refreshed.refreshToken)
      : credential.refresh_token_encrypted;
    const refreshedAt = nowIso();

    await updateCredentialRefresh(
      externalProfile.id,
      buildGoogleBusinessProfileCredentialRefreshUpdate({
        credential,
        refreshedTokens: refreshed,
        refreshTokenEncrypted: updatedRefreshTokenEncrypted,
        refreshedAt,
      }),
      client,
    );

    if (externalProfile.connection_status === 'reauth_required') {
      await updateExternalProfile(
        externalProfile.id,
        buildAuthorizationCompletedExternalProfileUpdate(externalProfile),
        client,
      );
    }

    return {
      accessToken: refreshed.accessToken,
      credential: buildRefreshedGoogleBusinessProfileCredentialRow({
        credential,
        refreshedTokens: refreshed,
        refreshTokenEncrypted: updatedRefreshTokenEncrypted,
        refreshedAt,
      }),
    };
  } catch (error) {
    if (isGoogleBusinessProfileError(error) && error.code === 'GBP_REAUTH_REQUIRED') {
      await updateExternalProfile(
        externalProfile.id,
        buildReauthRequiredExternalProfileUpdate(error.message),
        client,
      );
    }
    throw error;
  }
}

export async function discoverGoogleBusinessProfileLocationsForProfile(
  externalProfile: ExternalProfileRow,
  client: DbClient,
  options: { forceRefresh?: boolean } = {},
): Promise<{
  credential: CredentialRow | null;
  availableLocations: GoogleBusinessProfileAvailableLocation[];
}> {
  const cacheKey = locationDiscoveryCacheKey(externalProfile);
  const cached = locationDiscoveryCache.get(cacheKey);
  if (!options.forceRefresh && cached && cached.expiresAt > Date.now()) {
    return {
      credential: cached.credential,
      availableLocations: cached.availableLocations,
    };
  }

  const { accessToken, credential } = await getUsableGoogleBusinessProfileAccessToken(
    externalProfile,
    client,
  );
  const accounts = await listGoogleBusinessProfileAccounts(accessToken);
  const batches = await Promise.all(
    accounts.map((account) =>
      listGoogleBusinessProfileLocations(accessToken, account.name, account.accountName),
    ),
  );

  const discovery = {
    credential,
    availableLocations: batches.flat(),
  };

  locationDiscoveryCache.set(cacheKey, {
    ...discovery,
    expiresAt: Date.now() + LOCATION_DISCOVERY_CACHE_TTL_MS,
  });

  return discovery;
}

export function clearGoogleBusinessProfileLocationDiscoveryCacheForTests(): void {
  locationDiscoveryCache.clear();
}
