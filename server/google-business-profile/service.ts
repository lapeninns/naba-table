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
import { buildGoogleBusinessProfileLocationOptions, normalizeGoogleBusinessProfileSnapshot } from './normalize';
import { exchangeGoogleBusinessProfileCode, refreshGoogleBusinessProfileAccessToken } from './oauth';
import {
  disconnectRestaurantGoogleBusinessProfile,
  getRestaurantGoogleBusinessProfileConnection,
  getRestaurantGoogleBusinessProfileRow,
  getStoredGoogleBusinessProfileCredentials,
  markRestaurantGoogleBusinessProfileSyncFailure,
  saveRestaurantGoogleBusinessProfileSync,
  updateRestaurantGoogleBusinessProfileSelection,
  updateRestaurantGoogleBusinessProfileTokenSet,
  upsertRestaurantGoogleBusinessProfileConnection,
} from './store';

import type {
  RestaurantGoogleBusinessProfileConnection,
  RestaurantGoogleBusinessProfileLocationOption,
} from '@/lib/restaurants/google-business-profile';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

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

export async function connectRestaurantGoogleBusinessProfile(
  restaurantId: string,
  code: string,
  client: DbClient,
): Promise<RestaurantGoogleBusinessProfileConnection> {
  const restaurant = await getRestaurantDetails(restaurantId, client);
  const tokenSet = await exchangeGoogleBusinessProfileCode(code);
  const accounts = await listGoogleBusinessProfileAccounts(tokenSet.accessToken);

  const availableLocations: RestaurantGoogleBusinessProfileLocationOption[] = [];
  for (const account of accounts) {
    const locations = await listGoogleBusinessProfileLocations(tokenSet.accessToken, account.name);
    availableLocations.push(
      ...buildGoogleBusinessProfileLocationOptions({
        restaurant: {
          id: restaurant.restaurantId,
          name: restaurant.name,
          slug: restaurant.slug,
          timezone: restaurant.timezone,
          capacity: restaurant.capacity,
          address: restaurant.address,
          contactEmail: restaurant.contactEmail,
          contactPhone: restaurant.contactPhone,
        },
        account,
        locations,
      }),
    );
  }

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

  try {
    const credentials = await ensureFreshCredentials(input.restaurantId, client);
    const [location, attributes, reviews, media, performance] = await Promise.all([
      getGoogleBusinessProfileLocation(credentials.accessToken, selectedLocation.locationName),
      getGoogleBusinessProfileAttributes(credentials.accessToken, selectedLocation.locationName),
      listGoogleBusinessProfileReviews(credentials.accessToken, `accounts/${selectedLocation.accountId}`, selectedLocation.locationId),
      listGoogleBusinessProfileMedia(credentials.accessToken, `accounts/${selectedLocation.accountId}`, selectedLocation.locationId),
      fetchGoogleBusinessProfilePerformance(credentials.accessToken, selectedLocation.locationName),
    ]);

    const normalized = normalizeGoogleBusinessProfileSnapshot({
      location,
      attributes,
      reviews,
      media,
      performance,
    });

    await saveRestaurantGoogleBusinessProfileSync(
      {
        restaurantId: input.restaurantId,
        snapshot: {
          location,
          attributes,
          reviews,
          media,
          performance,
        },
        normalized,
      },
      client,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Google Business Profile sync failed.';
    await markRestaurantGoogleBusinessProfileSyncFailure(input.restaurantId, message, client);
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
  const accounts = await listGoogleBusinessProfileAccounts(credentials.accessToken);

  const availableLocations: RestaurantGoogleBusinessProfileLocationOption[] = [];
  for (const account of accounts) {
    const locations = await listGoogleBusinessProfileLocations(credentials.accessToken, account.name);
    availableLocations.push(
      ...buildGoogleBusinessProfileLocationOptions({
        restaurant: {
          id: restaurant.restaurantId,
          name: restaurant.name,
          slug: restaurant.slug,
          timezone: restaurant.timezone,
          capacity: restaurant.capacity,
          address: restaurant.address,
          contactEmail: restaurant.contactEmail,
          contactPhone: restaurant.contactPhone,
        },
        account,
        locations,
      }),
    );
  }

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
