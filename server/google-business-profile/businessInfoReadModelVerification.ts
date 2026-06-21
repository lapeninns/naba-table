import { buildFieldStatusLookupKey } from './businessInfoFieldSyncStatus';
import { buildPayloadHash } from './businessInfoNormalization';

import type { Database } from '@/types/supabase';

type RestaurantFieldSyncStatusRow =
  Database['public']['Tables']['restaurant_field_sync_statuses']['Row'];

export type GoogleBusinessProfileFieldVerification = {
  provider: string;
  syncStatus: string;
  isVerified: boolean;
  verifiedAt: string | null;
  verifiedBy: string | null;
  lastSyncedAt: string | null;
  lastCheckedAt: string | null;
};

export function buildFieldSyncStatusLookup(
  rows: RestaurantFieldSyncStatusRow[],
): Map<string, RestaurantFieldSyncStatusRow> {
  const lookup = new Map<string, RestaurantFieldSyncStatusRow>();
  for (const row of rows) {
    lookup.set(buildFieldStatusLookupKey(row.entity_table, row.entity_key, row.field_key), row);
  }
  return lookup;
}

export function resolveFieldVerification(
  row: RestaurantFieldSyncStatusRow | null | undefined,
  currentValue: unknown,
): GoogleBusinessProfileFieldVerification | null {
  if (!row) {
    return null;
  }

  const isVerified =
    buildPayloadHash(row.last_provider_value_json ?? null) ===
    buildPayloadHash(currentValue ?? null);

  return {
    provider: row.provider,
    syncStatus: isVerified ? row.sync_status : 'drifted',
    isVerified,
    verifiedAt: row.verified_at,
    verifiedBy: row.verified_by,
    lastSyncedAt: row.last_synced_at,
    lastCheckedAt: row.last_checked_at,
  };
}

export function combineFieldVerifications(
  items: Array<GoogleBusinessProfileFieldVerification | null>,
): GoogleBusinessProfileFieldVerification | null {
  const presentItems = items.filter((item): item is GoogleBusinessProfileFieldVerification =>
    Boolean(item),
  );
  if (presentItems.length === 0) {
    return null;
  }

  const drifted = presentItems.find((item) => item.syncStatus !== 'synced' || !item.isVerified);
  return drifted ?? presentItems[0] ?? null;
}
