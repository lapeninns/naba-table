import type { CanonicalSyncRows } from './businessInfoCanonicalRows';
import type { FieldSyncStatusInsert } from './businessInfoFieldSyncStatus';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;
type RestaurantProfileChangeLogInsert =
  Database['public']['Tables']['restaurant_profile_change_log']['Insert'];

export class GoogleBusinessProfileMirrorRetiredError extends Error {
  readonly code = 'GBP_PROVIDER_MIRROR_RETIRED';

  constructor() {
    super('Persistent Google Business Profile projections are retired.');
    this.name = 'GoogleBusinessProfileMirrorRetiredError';
  }
}

export function isMissingOptionalProfileTableError(error: unknown, tableName: string): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error && typeof error.code === 'string' ? error.code : null;
  const message = 'message' in error && typeof error.message === 'string' ? error.message : null;
  return Boolean(message?.includes(tableName)) && (code === '42P01' || code === 'PGRST205');
}

export function isMissingFieldSyncStatusesTableError(error: unknown): boolean {
  return isMissingOptionalProfileTableError(error, 'restaurant_field_sync_statuses');
}

export async function upsertBusinessDetails(
  _restaurantId: string,
  _details: CanonicalSyncRows['details'],
  _client: DbClient,
): Promise<never> {
  throw new GoogleBusinessProfileMirrorRetiredError();
}

export async function linkAttributeDefinitions(
  rows: CanonicalSyncRows['attributes'],
  _client: DbClient,
): Promise<CanonicalSyncRows['attributes']> {
  return rows;
}

export function buildProfileChangeLogRows(_params: {
  restaurantId: string;
  externalProfileId: string;
  syncedAt: string;
  rows: CanonicalSyncRows;
  syncAttributes: boolean;
  syncServiceItems: boolean;
}): RestaurantProfileChangeLogInsert[] {
  return [];
}

export async function insertProfileChangeLogRows(
  rows: RestaurantProfileChangeLogInsert[],
  _client: DbClient,
): Promise<void> {
  if (rows.length > 0) throw new GoogleBusinessProfileMirrorRetiredError();
}

export async function replaceProviderFieldSyncStatuses(
  _restaurantId: string,
  rows: FieldSyncStatusInsert[],
  _entityTables: string[],
  _client: DbClient,
): Promise<void> {
  if (rows.length > 0) throw new GoogleBusinessProfileMirrorRetiredError();
}
