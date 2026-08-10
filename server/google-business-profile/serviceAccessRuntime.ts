import {
  listGoogleBusinessProfileAccounts,
  listGoogleBusinessProfileLocations,
  refreshGoogleBusinessProfileAccessToken,
  type GoogleBusinessProfileAvailableLocation,
} from './client';
import {
  decryptGoogleBusinessProfileSecretWithMetadata,
  encryptGoogleBusinessProfileSecret,
} from './crypto';
import { GoogleBusinessProfileError } from './errors';
import {
  getCredentialRow,
  refreshCredentialFenced,
  transitionConnectionProviderFailureFenced,
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

export async function persistGoogleProviderAccessFailure(
  error: unknown,
  externalProfile: ExternalProfileRow,
  client: DbClient,
): Promise<boolean> {
  if (!(error instanceof GoogleBusinessProfileError)) return false;
  const transition =
    error.code === 'GBP_REAUTH_REQUIRED'
      ? { nextState: 'reauth_required', reasonCode: 'provider_invalid_grant' }
      : error.kind === 'reauth' && error.upstreamStatus === 401
        ? { nextState: 'reauth_required', reasonCode: 'provider_unauthorized_401' }
        : error.kind === 'access_lost' && error.upstreamStatus === 403
          ? { nextState: 'blocked', reasonCode: 'provider_access_lost_403' }
          : null;
  if (!transition) return false;
  await transitionConnectionProviderFailureFenced(
    {
      p_restaurant_id: externalProfile.restaurant_id,
      p_external_profile_row_id: externalProfile.id,
      p_expected_account_id: externalProfile.external_account_id,
      p_expected_profile_id: externalProfile.external_profile_id,
      p_expected_location_id: externalProfile.external_location_id,
      p_connection_generation: externalProfile.connection_generation,
      p_consent_epoch: externalProfile.consent_epoch,
      p_next_state: transition.nextState,
      p_reason_code: transition.reasonCode,
    },
    client,
  );
  return true;
}

export function isGoogleProviderAccessFailure(error: unknown): boolean {
  return (
    error instanceof GoogleBusinessProfileError &&
    (error.code === 'GBP_REAUTH_REQUIRED' ||
      (error.kind === 'reauth' && error.upstreamStatus === 401) ||
      (error.kind === 'access_lost' && error.upstreamStatus === 403))
  );
}

export async function getUsableGoogleBusinessProfileAccessToken(
  externalProfile: ExternalProfileRow,
  client: DbClient,
): Promise<{
  accessToken: string;
  credential: CredentialRow;
}> {
  if (externalProfile.write_state === 'revoking') {
    throw new GoogleBusinessProfileError('Google credential revocation is pending.', {
      code: 'GBP_REVOCATION_PENDING',
      status: 409,
    });
  }
  const credential = await getCredentialRow(externalProfile.id, client);
  if (!credential) {
    throw new GoogleBusinessProfileError(
      'Google Business Profile is not connected for this restaurant.',
      { code: 'GBP_NOT_CONNECTED', status: 404 },
    );
  }

  const decrypted = decryptGoogleBusinessProfileSecretWithMetadata(
    credential.refresh_token_encrypted,
    externalProfile.id,
  );
  let refreshed;
  try {
    refreshed = await refreshGoogleBusinessProfileAccessToken(decrypted.plaintext);
  } catch (error) {
    await persistGoogleProviderAccessFailure(error, externalProfile, client);
    throw error;
  }

  const updatedRefreshTokenEncrypted = refreshed.refreshToken
    ? encryptGoogleBusinessProfileSecret(refreshed.refreshToken, externalProfile.id)
    : decrypted.requiresRewrap
      ? encryptGoogleBusinessProfileSecret(decrypted.plaintext, externalProfile.id)
      : credential.refresh_token_encrypted;
  const refreshedAt = nowIso();

  const refreshedCredential = await refreshCredentialFenced(
    {
      p_restaurant_id: externalProfile.restaurant_id,
      p_external_profile_row_id: externalProfile.id,
      p_expected_account_id: externalProfile.external_account_id,
      p_expected_profile_id: externalProfile.external_profile_id,
      p_expected_location_id: externalProfile.external_location_id,
      p_connection_generation: externalProfile.connection_generation,
      p_consent_epoch: externalProfile.consent_epoch,
      p_expected_refresh_token_encrypted: credential.refresh_token_encrypted,
      p_refresh_token_encrypted: updatedRefreshTokenEncrypted,
      p_granted_scopes: refreshed.grantedScopes,
      p_token_type: refreshed.tokenType,
      p_refreshed_at: refreshedAt,
    },
    client,
  );

  return {
    accessToken: refreshed.accessToken,
    credential: refreshedCredential,
  };
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
  let batches;
  try {
    const accounts = await listGoogleBusinessProfileAccounts(accessToken);
    batches = await Promise.all(
      accounts.map((account) =>
        listGoogleBusinessProfileLocations(accessToken, account.name, account.accountName),
      ),
    );
  } catch (error) {
    await persistGoogleProviderAccessFailure(error, externalProfile, client);
    throw error;
  }

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
