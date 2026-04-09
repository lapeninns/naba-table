import { DateTime } from 'luxon';

import { getRestaurantDetails } from '@/server/restaurants/details';

import {
  fetchGoogleBusinessProfilePerformance,
  getGoogleBusinessProfileAttributes,
  getGoogleBusinessProfileLocation,
  listGoogleBusinessProfileAccounts,
  listGoogleBusinessProfileLocations,
  listGoogleBusinessProfileMedia,
  listGoogleBusinessProfileReviews,
} from './client';
import { summarizeGoogleBusinessProfileChanges } from './diff';
import { buildGoogleBusinessProfileLocationOptions, normalizeGoogleBusinessProfileSnapshot } from './normalize';
import {
  exchangeGoogleBusinessProfileCode,
  refreshGoogleBusinessProfileAccessToken,
} from './oauth';
import {
  disconnectRestaurantGoogleBusinessProfile,
  getRestaurantGoogleBusinessProfileConnection,
  getRestaurantGoogleBusinessProfileRow,
  getStoredGoogleBusinessProfileCredentials,
  markRestaurantGoogleBusinessProfileSyncFailure,
  recordRestaurantGoogleBusinessProfileSyncEvent,
  saveRestaurantGoogleBusinessProfileSync,
  updateRestaurantGoogleBusinessProfileSelection,
  updateRestaurantGoogleBusinessProfileTokenSet,
  upsertRestaurantGoogleBusinessProfileConnection,
} from './store';

import type {
  RestaurantGoogleBusinessProfileConnection,
  RestaurantGoogleBusinessProfileLocationOption,
  RestaurantGoogleBusinessProfileSyncFamily,
} from '@/lib/restaurants/google-business-profile';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;
type GoogleBusinessProfileSyncFamilyKey = RestaurantGoogleBusinessProfileSyncFamily['key'];
type SyncFamilyResult<T> = {
  value: T | null;
  family: RestaurantGoogleBusinessProfileSyncFamily;
};

const GOOGLE_BUSINESS_PROFILE_SYNC_FAMILY_LABELS: Record<GoogleBusinessProfileSyncFamilyKey, string> = {
  location: 'Location details',
  attributes: 'Attributes',
  reviews: 'Reviews',
  media: 'Media',
  performance: 'Performance',
};

function isTokenFresh(expiresAt: string | null): boolean {
  if (!expiresAt) {
    return true;
  }

  const parsed = DateTime.fromISO(expiresAt, { zone: 'utc' });
  if (!parsed.isValid) {
    return false;
  }

  return parsed.toMillis() > Date.now() + 60_000;
}

async function ensureFreshCredentials(restaurantId: string, client: DbClient) {
  const credentials = await getStoredGoogleBusinessProfileCredentials(restaurantId, client);
  if (!credentials) {
    throw new Error('Google Business Profile is not connected for this restaurant.');
  }

  if (isTokenFresh(credentials.accessTokenExpiresAt) || !credentials.refreshToken) {
    return credentials;
  }

  const refreshed = await refreshGoogleBusinessProfileAccessToken(credentials.refreshToken);
  const nextCredentials = {
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken ?? credentials.refreshToken,
    accessTokenExpiresAt: refreshed.expiresAt,
    tokenType: refreshed.tokenType,
    scopes: refreshed.scope,
  };
  await updateRestaurantGoogleBusinessProfileTokenSet({ restaurantId, credentials: nextCredentials }, client);
  return nextCredentials;
}

function pickAutoSelection(connection: RestaurantGoogleBusinessProfileConnection) {
  const [first] = connection.availableLocations;
  if (!first) {
    return null;
  }

  if (connection.availableLocations.length === 1 || first.matchScore >= 5) {
    return first;
  }

  return null;
}

async function runOptionalFamilySync<T>(
  key: Exclude<GoogleBusinessProfileSyncFamilyKey, 'location'>,
  run: () => Promise<T | null>,
): Promise<SyncFamilyResult<T>> {
  const updatedAt = new Date().toISOString();

  try {
    const value = await run();
    return {
      value,
      family: {
        key,
        label: GOOGLE_BUSINESS_PROFILE_SYNC_FAMILY_LABELS[key],
        status: value === null ? 'skipped' : 'success',
        error: null,
        updatedAt,
      },
    };
  } catch (error) {
    return {
      value: null,
      family: {
        key,
        label: GOOGLE_BUSINESS_PROFILE_SYNC_FAMILY_LABELS[key],
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown Google Business Profile sync error.',
        updatedAt,
      },
    };
  }
}

async function recordSyncEventSafely(
  input: Parameters<typeof recordRestaurantGoogleBusinessProfileSyncEvent>[0],
  client: DbClient,
) {
  try {
    await recordRestaurantGoogleBusinessProfileSyncEvent(input, client);
  } catch (error) {
    console.warn('[google-business-profile] unable to persist sync history event', {
      restaurantId: input.restaurantId,
      status: input.status,
      message: error instanceof Error ? error.message : 'Unknown sync history persistence error.',
    });
  }
}

async function listAccessibleGoogleBusinessProfileLocationOptions(input: {
  accessToken: string;
  restaurant: Awaited<ReturnType<typeof getRestaurantDetails>>;
}): Promise<RestaurantGoogleBusinessProfileLocationOption[]> {
  const accounts = await listGoogleBusinessProfileAccounts(input.accessToken);
  const availableLocations: RestaurantGoogleBusinessProfileLocationOption[] = [];
  const errors: string[] = [];

  for (const account of accounts) {
    try {
      const pushLocations = async (parentAccountName: string) => {
        const locations = await listGoogleBusinessProfileLocations(input.accessToken, parentAccountName);
        availableLocations.push(
          ...buildGoogleBusinessProfileLocationOptions({
            restaurant: {
              id: input.restaurant.restaurantId,
              name: input.restaurant.name,
              slug: input.restaurant.slug,
              timezone: input.restaurant.timezone,
              capacity: input.restaurant.capacity,
              address: input.restaurant.address,
              contactEmail: input.restaurant.contactEmail,
              contactPhone: input.restaurant.contactPhone,
            },
            account,
            locations,
          }),
        );
      };

      try {
        await pushLocations(account.name);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown Google Business Profile account error.';
        const shouldTryWildcard =
          account.name !== 'accounts/-' &&
          message.toLowerCase().includes('invalid argument');

        if (!shouldTryWildcard) {
          throw error;
        }

        console.warn('[google-business-profile] retrying location listing via wildcard account parent', {
          accountName: account.name,
          accountLabel: account.accountName ?? account.name,
          message,
        });
        await pushLocations('accounts/-');
      }
    } catch (error) {
      const label = account.accountName ?? account.name;
      const message = error instanceof Error ? error.message : 'Unknown Google Business Profile account error.';
      errors.push(`${label}: ${message}`);
      console.warn('[google-business-profile] skipping account while listing locations', {
        accountName: account.name,
        accountLabel: label,
        message,
      });
    }
  }

  if (availableLocations.length === 0 && errors.length > 0) {
    throw new Error(
      `Unable to list Google Business Profile locations for any accessible account. ${errors.join(' | ')}`,
    );
  }

  return availableLocations.filter(
    (location, index, all) =>
      all.findIndex(
        (candidate) =>
          candidate.accountId === location.accountId &&
          candidate.locationId === location.locationId,
      ) === index,
  );
}

export async function connectRestaurantGoogleBusinessProfile(
  restaurantId: string,
  code: string,
  client: DbClient,
  options: { redirectUri?: string } = {},
): Promise<RestaurantGoogleBusinessProfileConnection> {
  const restaurant = await getRestaurantDetails(restaurantId, client);
  const tokenSet = await exchangeGoogleBusinessProfileCode(code, options.redirectUri);
  const availableLocations = await listAccessibleGoogleBusinessProfileLocationOptions({
    accessToken: tokenSet.accessToken,
    restaurant,
  });

  const existing = await getRestaurantGoogleBusinessProfileConnection(restaurantId, client);
  await upsertRestaurantGoogleBusinessProfileConnection(
    {
      restaurantId,
      accountId: existing.accountId,
      accountName: existing.accountName,
      locationId: existing.locationId,
      locationName: existing.locationName,
      locationTitle: existing.locationTitle,
      availableLocations,
      credentials: {
        accessToken: tokenSet.accessToken,
        refreshToken: tokenSet.refreshToken,
        accessTokenExpiresAt: tokenSet.expiresAt,
        tokenType: tokenSet.tokenType,
        scopes: tokenSet.scope,
      },
    },
    client,
  );

  const connection = await getRestaurantGoogleBusinessProfileConnection(restaurantId, client);
  const autoSelection = pickAutoSelection(connection);
  if (autoSelection) {
    await updateRestaurantGoogleBusinessProfileSelection(
      {
        restaurantId,
        accountId: autoSelection.accountId,
        accountName: autoSelection.accountName,
        locationId: autoSelection.locationId,
        locationName: autoSelection.locationName,
        locationTitle: autoSelection.title,
        availableLocations: connection.availableLocations,
      },
      client,
    );
  }

  return getRestaurantGoogleBusinessProfileConnection(restaurantId, client);
}

export async function getRestaurantGoogleBusinessProfileStatus(
  restaurantId: string,
  client: DbClient,
): Promise<RestaurantGoogleBusinessProfileConnection> {
  return getRestaurantGoogleBusinessProfileConnection(restaurantId, client);
}

export async function removeRestaurantGoogleBusinessProfile(
  restaurantId: string,
  client: DbClient,
): Promise<void> {
  await disconnectRestaurantGoogleBusinessProfile(restaurantId, client);
}

export async function syncRestaurantGoogleBusinessProfile(
  input: {
    restaurantId: string;
    accountId?: string | null;
    locationId?: string | null;
  },
  client: DbClient,
): Promise<RestaurantGoogleBusinessProfileConnection> {
  const connection = await getRestaurantGoogleBusinessProfileConnection(input.restaurantId, client);
  if (!connection.connected) {
    throw new Error('Connect Google Business Profile before syncing.');
  }

  const selectedLocation =
    connection.availableLocations.find(
      (location) =>
        (input.locationId ? location.locationId === input.locationId : location.locationId === connection.locationId) &&
        (input.accountId ? location.accountId === input.accountId : true),
    ) ?? null;

  if (!selectedLocation) {
    throw new Error('Select a Google Business Profile location before syncing.');
  }

  await updateRestaurantGoogleBusinessProfileSelection(
    {
      restaurantId: input.restaurantId,
      accountId: selectedLocation.accountId,
      accountName: selectedLocation.accountName,
      locationId: selectedLocation.locationId,
      locationName: selectedLocation.locationName,
      locationTitle: selectedLocation.title,
      availableLocations: connection.availableLocations,
    },
    client,
  );

  const syncStartedAt = new Date().toISOString();
  const previousNormalized = connection.normalizedProfile;

  try {
    const credentials = await ensureFreshCredentials(input.restaurantId, client);
    const location = await getGoogleBusinessProfileLocation(credentials.accessToken, selectedLocation.locationName);
    const locationUpdatedAt = new Date().toISOString();
    const [attributesResult, reviewsResult, mediaResult, performanceResult] = await Promise.all([
      runOptionalFamilySync('attributes', () =>
        getGoogleBusinessProfileAttributes(credentials.accessToken, selectedLocation.locationName),
      ),
      runOptionalFamilySync('reviews', () =>
        listGoogleBusinessProfileReviews(
          credentials.accessToken,
          `accounts/${selectedLocation.accountId}`,
          selectedLocation.locationId,
        ),
      ),
      runOptionalFamilySync('media', () =>
        listGoogleBusinessProfileMedia(
          credentials.accessToken,
          `accounts/${selectedLocation.accountId}`,
          selectedLocation.locationId,
        ),
      ),
      runOptionalFamilySync('performance', () =>
        fetchGoogleBusinessProfilePerformance(credentials.accessToken, selectedLocation.locationName),
      ),
    ]);

    const syncFamilies: RestaurantGoogleBusinessProfileSyncFamily[] = [
      {
        key: 'location',
        label: GOOGLE_BUSINESS_PROFILE_SYNC_FAMILY_LABELS.location,
        status: 'success',
        error: null,
        updatedAt: locationUpdatedAt,
      },
      attributesResult.family,
      reviewsResult.family,
      mediaResult.family,
      performanceResult.family,
    ];

    const failedFamilies = syncFamilies.filter((family) => family.status === 'failed');
    const syncEventStatus = failedFamilies.length > 0 ? 'partial' : 'success';
    const syncEventError =
      failedFamilies.length > 0
        ? `Partial sync completed. ${failedFamilies.map((family) => `${family.label}: ${family.error}`).join(' | ')}`
        : null;

    const normalized = normalizeGoogleBusinessProfileSnapshot({
      location,
      attributes: attributesResult.value,
      reviews: reviewsResult.value,
      media: mediaResult.value,
      performance: performanceResult.value,
    });
    const changeSummary = summarizeGoogleBusinessProfileChanges(previousNormalized, normalized);

    await saveRestaurantGoogleBusinessProfileSync(
      {
        restaurantId: input.restaurantId,
        snapshot: {
          location,
          attributes: attributesResult.value,
          reviews: reviewsResult.value,
          media: mediaResult.value,
          performance: performanceResult.value,
          syncFamilies,
          changeSummary,
        },
        normalized,
        lastSyncStatus: 'success',
        lastSyncError: syncEventError,
      },
      client,
    );

    await recordSyncEventSafely(
      {
        restaurantId: input.restaurantId,
        accountId: selectedLocation.accountId,
        accountName: selectedLocation.accountName,
        locationId: selectedLocation.locationId,
        locationName: selectedLocation.locationName,
        locationTitle: selectedLocation.title,
        startedAt: syncStartedAt,
        completedAt: new Date().toISOString(),
        status: syncEventStatus,
        error: syncEventError,
        syncFamilies,
      },
      client,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Google Business Profile sync failed.';
    await markRestaurantGoogleBusinessProfileSyncFailure(input.restaurantId, message, client);
    await recordSyncEventSafely(
      {
        restaurantId: input.restaurantId,
        accountId: selectedLocation.accountId,
        accountName: selectedLocation.accountName,
        locationId: selectedLocation.locationId,
        locationName: selectedLocation.locationName,
        locationTitle: selectedLocation.title,
        startedAt: syncStartedAt,
        completedAt: new Date().toISOString(),
        status: 'failed',
        error: message,
        syncFamilies: [
          {
            key: 'location',
            label: GOOGLE_BUSINESS_PROFILE_SYNC_FAMILY_LABELS.location,
            status: 'failed',
            error: message,
            updatedAt: new Date().toISOString(),
          },
        ],
      },
      client,
    );
    throw error;
  }

  return getRestaurantGoogleBusinessProfileConnection(input.restaurantId, client);
}

export async function refreshRestaurantGoogleBusinessProfileCatalog(
  restaurantId: string,
  client: DbClient,
): Promise<RestaurantGoogleBusinessProfileConnection> {
  const credentials = await ensureFreshCredentials(restaurantId, client);
  const restaurant = await getRestaurantDetails(restaurantId, client);
  const availableLocations = await listAccessibleGoogleBusinessProfileLocationOptions({
    accessToken: credentials.accessToken,
    restaurant,
  });

  const existingRow = await getRestaurantGoogleBusinessProfileRow(restaurantId, client);
  if (!existingRow) {
    throw new Error('Google Business Profile is not connected for this restaurant.');
  }

  const selected =
    availableLocations.find(
      (location) =>
        location.locationId === existingRow.location_id &&
        location.accountId === existingRow.account_id,
    ) ?? null;

  await updateRestaurantGoogleBusinessProfileSelection(
    {
      restaurantId,
      accountId: selected?.accountId ?? existingRow.account_id ?? '',
      accountName: selected?.accountName ?? existingRow.account_name ?? '',
      locationId: selected?.locationId ?? existingRow.location_id ?? '',
      locationName: selected?.locationName ?? existingRow.location_name ?? '',
      locationTitle: selected?.title ?? existingRow.location_title ?? '',
      availableLocations,
    },
    client,
  );

  return getRestaurantGoogleBusinessProfileConnection(restaurantId, client);
}
