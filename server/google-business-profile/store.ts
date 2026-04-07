import { decryptGoogleBusinessProfileSecret, encryptGoogleBusinessProfileSecret } from './crypto';

import type { RestaurantGoogleBusinessProfileConnection, RestaurantGoogleBusinessProfileLocationOption, RestaurantGoogleBusinessProfileNormalized, RestaurantGoogleBusinessProfileSyncStatus } from '@/lib/restaurants/google-business-profile';
import type { Json, Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const TABLE_NAME = 'restaurant_google_business_profiles';

type DbClient = SupabaseClient<Database>;
type IntegrationRow = Database['public']['Tables']['restaurant_google_business_profiles']['Row'];
type IntegrationInsert = Database['public']['Tables']['restaurant_google_business_profiles']['Insert'];
type IntegrationUpdate = Database['public']['Tables']['restaurant_google_business_profiles']['Update'];

export type StoredGoogleBusinessProfileCredentials = {
  accessToken: string;
  refreshToken: string | null;
  accessTokenExpiresAt: string | null;
  tokenType: string | null;
  scopes: string[];
};

type PersistedConnectionInput = {
  restaurantId: string;
  accountId?: string | null;
  accountName?: string | null;
  locationId?: string | null;
  locationName?: string | null;
  locationTitle?: string | null;
  availableLocations?: RestaurantGoogleBusinessProfileLocationOption[];
  credentials: StoredGoogleBusinessProfileCredentials;
  connectedAt?: string;
};

function isTableMissingError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = (error as { code?: string }).code;
  const message = String((error as { message?: string }).message ?? '');
  return code === '42P01' || message.includes(TABLE_NAME);
}

export function isGoogleBusinessProfileTableMissingError(error: unknown) {
  return isTableMissingError(error);
}

function mapRowToConnection(row: IntegrationRow | null): RestaurantGoogleBusinessProfileConnection {
  if (!row) {
    return {
      connected: false,
      status: 'disconnected',
      accountId: null,
      accountName: null,
      locationId: null,
      locationName: null,
      locationTitle: null,
      availableLocations: [],
      oauthConnectedAt: null,
      lastSyncAt: null,
      lastSyncStatus: null,
      lastSyncError: null,
      normalizedProfile: null,
    };
  }

  const connected = Boolean(row.oauth_access_token_ciphertext);
  const needsLocation = connected && !row.location_id;
  const hasSyncedProfile = Boolean(row.profile_normalized);
  const status =
    row.last_sync_status === 'failed'
      ? 'error'
      : needsLocation
        ? 'needs_location'
        : hasSyncedProfile
          ? 'synced'
          : connected
            ? 'connected'
            : 'disconnected';

  return {
    connected,
    status,
    accountId: row.account_id ?? null,
    accountName: row.account_name ?? null,
    locationId: row.location_id ?? null,
    locationName: row.location_name ?? null,
    locationTitle: row.location_title ?? null,
    availableLocations: Array.isArray(row.available_locations)
      ? (row.available_locations as unknown as RestaurantGoogleBusinessProfileLocationOption[])
      : [],
    oauthConnectedAt: row.oauth_connected_at ?? null,
    lastSyncAt: row.last_sync_at ?? null,
    lastSyncStatus: (row.last_sync_status as RestaurantGoogleBusinessProfileSyncStatus | null) ?? null,
    lastSyncError: row.last_sync_error ?? null,
    normalizedProfile: (row.profile_normalized as unknown as RestaurantGoogleBusinessProfileNormalized | null) ?? null,
  };
}

export async function getRestaurantGoogleBusinessProfileRow(
  restaurantId: string,
  client: DbClient,
): Promise<IntegrationRow | null> {
  const { data, error } = await client
    .from(TABLE_NAME)
    .select('*')
    .eq('restaurant_id', restaurantId)
    .maybeSingle<IntegrationRow>();

  if (error) {
    if (isTableMissingError(error)) {
      return null;
    }

    throw error;
  }

  return data ?? null;
}

export async function getRestaurantGoogleBusinessProfileConnection(
  restaurantId: string,
  client: DbClient,
): Promise<RestaurantGoogleBusinessProfileConnection> {
  const row = await getRestaurantGoogleBusinessProfileRow(restaurantId, client);
  return mapRowToConnection(row);
}

export async function getRestaurantGoogleBusinessProfileNormalizedSnapshot(
  restaurantId: string,
  client: DbClient,
): Promise<RestaurantGoogleBusinessProfileNormalized | null> {
  const row = await getRestaurantGoogleBusinessProfileRow(restaurantId, client);
  return (row?.profile_normalized as unknown as RestaurantGoogleBusinessProfileNormalized | null) ?? null;
}

export async function listRestaurantGoogleBusinessProfileNormalizedSnapshots(
  restaurantIds: string[],
  client: DbClient,
): Promise<Record<string, RestaurantGoogleBusinessProfileNormalized>> {
  if (restaurantIds.length === 0) {
    return {};
  }

  const { data, error } = await client
    .from(TABLE_NAME)
    .select('restaurant_id, profile_normalized')
    .in('restaurant_id', restaurantIds);

  if (error) {
    if (isTableMissingError(error)) {
      return {};
    }
    throw error;
  }

  return (data ?? []).reduce<Record<string, RestaurantGoogleBusinessProfileNormalized>>((acc, row) => {
    if (row.profile_normalized) {
      acc[row.restaurant_id] = row.profile_normalized as unknown as RestaurantGoogleBusinessProfileNormalized;
    }
    return acc;
  }, {});
}

export async function getStoredGoogleBusinessProfileCredentials(
  restaurantId: string,
  client: DbClient,
): Promise<StoredGoogleBusinessProfileCredentials | null> {
  const row = await getRestaurantGoogleBusinessProfileRow(restaurantId, client);
  if (!row?.oauth_access_token_ciphertext) {
    return null;
  }

  return {
    accessToken: decryptGoogleBusinessProfileSecret(row.oauth_access_token_ciphertext),
    refreshToken: row.oauth_refresh_token_ciphertext
      ? decryptGoogleBusinessProfileSecret(row.oauth_refresh_token_ciphertext)
      : null,
    accessTokenExpiresAt: row.oauth_access_token_expires_at ?? null,
    tokenType: row.oauth_token_type ?? null,
    scopes: row.oauth_scopes ?? [],
  };
}

export async function upsertRestaurantGoogleBusinessProfileConnection(
  input: PersistedConnectionInput,
  client: DbClient,
): Promise<void> {
  const payload: IntegrationInsert = {
    restaurant_id: input.restaurantId,
    account_id: input.accountId ?? null,
    account_name: input.accountName ?? null,
    location_id: input.locationId ?? null,
    location_name: input.locationName ?? null,
    location_title: input.locationTitle ?? null,
    oauth_access_token_ciphertext: encryptGoogleBusinessProfileSecret(input.credentials.accessToken),
    oauth_refresh_token_ciphertext: input.credentials.refreshToken
      ? encryptGoogleBusinessProfileSecret(input.credentials.refreshToken)
      : null,
    oauth_access_token_expires_at: input.credentials.accessTokenExpiresAt ?? null,
    oauth_token_type: input.credentials.tokenType ?? null,
    oauth_scopes: input.credentials.scopes,
    oauth_connected_at: input.connectedAt ?? new Date().toISOString(),
    oauth_last_refreshed_at: new Date().toISOString(),
    available_locations: (input.availableLocations ?? []) as unknown as Json,
    updated_at: new Date().toISOString(),
  };

  const { error } = await client.from(TABLE_NAME).upsert(payload, { onConflict: 'restaurant_id' });
  if (error) {
    throw error;
  }
}

export async function updateRestaurantGoogleBusinessProfileSelection(
  input: {
    restaurantId: string;
    accountId: string;
    accountName: string;
    locationId: string;
    locationName: string;
    locationTitle: string;
    availableLocations: RestaurantGoogleBusinessProfileLocationOption[];
  },
  client: DbClient,
): Promise<void> {
  const payload: IntegrationUpdate = {
    account_id: input.accountId,
    account_name: input.accountName,
    location_id: input.locationId,
    location_name: input.locationName,
    location_title: input.locationTitle,
    available_locations: input.availableLocations as unknown as Json,
    updated_at: new Date().toISOString(),
  };

  const { error } = await client.from(TABLE_NAME).update(payload).eq('restaurant_id', input.restaurantId);
  if (error) {
    throw error;
  }
}

export async function updateRestaurantGoogleBusinessProfileTokenSet(
  input: {
    restaurantId: string;
    credentials: StoredGoogleBusinessProfileCredentials;
  },
  client: DbClient,
): Promise<void> {
  const payload: IntegrationUpdate = {
    oauth_access_token_ciphertext: encryptGoogleBusinessProfileSecret(input.credentials.accessToken),
    oauth_refresh_token_ciphertext: input.credentials.refreshToken
      ? encryptGoogleBusinessProfileSecret(input.credentials.refreshToken)
      : null,
    oauth_access_token_expires_at: input.credentials.accessTokenExpiresAt ?? null,
    oauth_token_type: input.credentials.tokenType ?? null,
    oauth_scopes: input.credentials.scopes,
    oauth_last_refreshed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await client.from(TABLE_NAME).update(payload).eq('restaurant_id', input.restaurantId);
  if (error) {
    throw error;
  }
}

export async function saveRestaurantGoogleBusinessProfileSync(
  input: {
    restaurantId: string;
    snapshot: Record<string, unknown>;
    normalized: RestaurantGoogleBusinessProfileNormalized;
  },
  client: DbClient,
): Promise<void> {
  const now = new Date().toISOString();
  const payload: IntegrationUpdate = {
    profile_snapshot: input.snapshot as unknown as Json,
    profile_normalized: input.normalized as unknown as Json,
    last_sync_at: now,
    last_sync_status: 'success',
    last_sync_error: null,
    updated_at: now,
  };

  const { error } = await client.from(TABLE_NAME).update(payload).eq('restaurant_id', input.restaurantId);
  if (error) {
    throw error;
  }
}

export async function markRestaurantGoogleBusinessProfileSyncFailure(
  restaurantId: string,
  message: string,
  client: DbClient,
): Promise<void> {
  const now = new Date().toISOString();
  const payload: IntegrationUpdate = {
    last_sync_at: now,
    last_sync_status: 'failed',
    last_sync_error: message,
    updated_at: now,
  };

  const { error } = await client.from(TABLE_NAME).update(payload).eq('restaurant_id', restaurantId);
  if (error) {
    if (isTableMissingError(error)) {
      return;
    }
    throw error;
  }
}

export async function disconnectRestaurantGoogleBusinessProfile(
  restaurantId: string,
  client: DbClient,
): Promise<void> {
  const { error } = await client.from(TABLE_NAME).delete().eq('restaurant_id', restaurantId);
  if (error && !isTableMissingError(error)) {
    throw error;
  }
}
