import { decryptGoogleBusinessProfileSecret, encryptGoogleBusinessProfileSecret } from './crypto';

import type {
  RestaurantGoogleBusinessProfileChangeSummary,
  RestaurantGoogleBusinessProfileConnection,
  RestaurantGoogleBusinessProfileSyncHistoryEvent,
  RestaurantGoogleBusinessProfileLocationOption,
  RestaurantGoogleBusinessProfileNormalized,
  RestaurantGoogleBusinessProfileSyncFamily,
  RestaurantGoogleBusinessProfileSyncHistoryStatus,
  RestaurantGoogleBusinessProfileSyncStatus,
} from '@/lib/restaurants/google-business-profile';
import type { Json, Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const TABLE_NAME = 'restaurant_google_business_profiles';
const HISTORY_TABLE_NAME = 'restaurant_google_business_profile_sync_events';
const GOOGLE_BUSINESS_PROFILE_STORAGE_NOT_READY_MESSAGE =
  'Google Business Profile storage is not ready in the active Supabase project. Apply the pending restaurant_google_business_profiles migration and retry.';

type DbClient = SupabaseClient<Database>;
type IntegrationRow = Database['public']['Tables']['restaurant_google_business_profiles']['Row'];
type IntegrationInsert = Database['public']['Tables']['restaurant_google_business_profiles']['Insert'];
type IntegrationUpdate = Database['public']['Tables']['restaurant_google_business_profiles']['Update'];
type IntegrationHistoryRow = Database['public']['Tables']['restaurant_google_business_profile_sync_events']['Row'];
type IntegrationHistoryInsert = Database['public']['Tables']['restaurant_google_business_profile_sync_events']['Insert'];

export type StoredGoogleBusinessProfileCredentials = {
  accessToken: string;
  refreshToken: string | null;
  accessTokenExpiresAt: string | null;
  tokenType: string | null;
  scopes: string[];
};

export class GoogleBusinessProfileStorageNotReadyError extends Error {
  constructor(message = GOOGLE_BUSINESS_PROFILE_STORAGE_NOT_READY_MESSAGE) {
    super(message);
    this.name = 'GoogleBusinessProfileStorageNotReadyError';
  }
}

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

type PersistedGoogleBusinessProfileSnapshot = {
  location?: Record<string, unknown> | null;
  attributes?: Record<string, unknown> | null;
  reviews?: Record<string, unknown> | null;
  media?: Record<string, unknown> | null;
  performance?: Record<string, unknown> | null;
  syncFamilies?: RestaurantGoogleBusinessProfileSyncFamily[];
  changeSummary?: RestaurantGoogleBusinessProfileChangeSummary | null;
};

function isMissingTableError(error: unknown, tableName: string) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = (error as { code?: string }).code;
  const message = String((error as { message?: string }).message ?? '');
  return code === '42P01' || message.includes(tableName);
}

function isTableMissingError(error: unknown) {
  return isMissingTableError(error, TABLE_NAME);
}

function isHistoryTableMissingError(error: unknown) {
  return isMissingTableError(error, HISTORY_TABLE_NAME);
}

export function isGoogleBusinessProfileTableMissingError(error: unknown) {
  return isTableMissingError(error);
}

function normalizeWriteError(error: unknown): never {
  if (isTableMissingError(error)) {
    throw new GoogleBusinessProfileStorageNotReadyError();
  }

  throw error;
}

function mapHistoryRowToEvent(row: IntegrationHistoryRow): RestaurantGoogleBusinessProfileSyncHistoryEvent {
  return {
    id: row.id,
    trigger: row.trigger_source === 'manual' ? 'manual' : 'manual',
    accountId: row.account_id ?? null,
    accountName: row.account_name ?? null,
    locationId: row.location_id ?? null,
    locationName: row.location_name ?? null,
    locationTitle: row.location_title ?? null,
    startedAt: row.sync_started_at,
    completedAt: row.sync_completed_at ?? null,
    status: row.sync_status as RestaurantGoogleBusinessProfileSyncHistoryStatus,
    error: row.sync_error ?? null,
    syncFamilies: Array.isArray(row.sync_families)
      ? (row.sync_families as unknown as RestaurantGoogleBusinessProfileSyncFamily[])
      : [],
  };
}

function mapRowToConnection(
  row: IntegrationRow | null,
  syncHistory: RestaurantGoogleBusinessProfileSyncHistoryEvent[],
): RestaurantGoogleBusinessProfileConnection {
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
      latestChangeSummary: null,
      syncFamilies: [],
      syncHistory,
    };
  }

  const snapshot =
    row.profile_snapshot && typeof row.profile_snapshot === 'object'
      ? (row.profile_snapshot as unknown as PersistedGoogleBusinessProfileSnapshot)
      : null;

  const connected = Boolean(row.oauth_access_token_ciphertext);
  const needsLocation = connected && !row.location_id;
  const hasSyncedProfile = Boolean(row.profile_normalized);
  const hasFailedFamily = (snapshot?.syncFamilies ?? []).some((family) => family.status === 'failed');
  const status =
    row.last_sync_status === 'failed'
      ? 'error'
      : hasFailedFamily && hasSyncedProfile
        ? 'partial'
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
    latestChangeSummary:
      (snapshot?.changeSummary as RestaurantGoogleBusinessProfileChangeSummary | null | undefined) ?? null,
    syncFamilies: Array.isArray(snapshot?.syncFamilies) ? snapshot.syncFamilies : [],
    syncHistory,
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
  const [row, syncHistory] = await Promise.all([
    getRestaurantGoogleBusinessProfileRow(restaurantId, client),
    listRestaurantGoogleBusinessProfileSyncHistory(restaurantId, client),
  ]);
  return mapRowToConnection(row, syncHistory);
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

export async function listRestaurantGoogleBusinessProfileSyncHistory(
  restaurantId: string,
  client: DbClient,
  limit = 10,
): Promise<RestaurantGoogleBusinessProfileSyncHistoryEvent[]> {
  const { data, error } = await client
    .from(HISTORY_TABLE_NAME)
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('sync_started_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (isHistoryTableMissingError(error)) {
      return [];
    }
    throw error;
  }

  return (data ?? []).map((row) => mapHistoryRowToEvent(row as IntegrationHistoryRow));
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
    normalizeWriteError(error);
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
    normalizeWriteError(error);
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
    normalizeWriteError(error);
  }
}

export async function saveRestaurantGoogleBusinessProfileSync(
  input: {
    restaurantId: string;
    snapshot: Record<string, unknown>;
    normalized: RestaurantGoogleBusinessProfileNormalized;
    lastSyncStatus?: RestaurantGoogleBusinessProfileSyncStatus;
    lastSyncError?: string | null;
  },
  client: DbClient,
): Promise<void> {
  const now = new Date().toISOString();
  const payload: IntegrationUpdate = {
    profile_snapshot: input.snapshot as unknown as Json,
    profile_normalized: input.normalized as unknown as Json,
    last_sync_at: now,
    last_sync_status: input.lastSyncStatus ?? 'success',
    last_sync_error: input.lastSyncError ?? null,
    updated_at: now,
  };

  const { error } = await client.from(TABLE_NAME).update(payload).eq('restaurant_id', input.restaurantId);
  if (error) {
    normalizeWriteError(error);
  }
}

export async function recordRestaurantGoogleBusinessProfileSyncEvent(
  input: {
    restaurantId: string;
    accountId?: string | null;
    accountName?: string | null;
    locationId?: string | null;
    locationName?: string | null;
    locationTitle?: string | null;
    startedAt: string;
    completedAt: string;
    status: RestaurantGoogleBusinessProfileSyncHistoryStatus;
    error?: string | null;
    syncFamilies: RestaurantGoogleBusinessProfileSyncFamily[];
  },
  client: DbClient,
): Promise<void> {
  const payload: IntegrationHistoryInsert = {
    restaurant_id: input.restaurantId,
    account_id: input.accountId ?? null,
    account_name: input.accountName ?? null,
    location_id: input.locationId ?? null,
    location_name: input.locationName ?? null,
    location_title: input.locationTitle ?? null,
    trigger_source: 'manual',
    sync_started_at: input.startedAt,
    sync_completed_at: input.completedAt,
    sync_status: input.status,
    sync_error: input.error ?? null,
    sync_families: input.syncFamilies as unknown as Json,
  };

  const { error } = await client.from(HISTORY_TABLE_NAME).insert(payload);
  if (error && !isHistoryTableMissingError(error)) {
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
