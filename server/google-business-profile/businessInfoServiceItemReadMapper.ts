import { buildFieldStatusLookupKey, getServiceItemEntityKey } from './businessInfoFieldSyncStatus';
import { normalizeRecord } from './businessInfoNormalization';
import {
  combineFieldVerifications,
  resolveFieldVerification,
} from './businessInfoReadModelVerification';

import type { GoogleBusinessProfileBusinessInfo } from './businessInfoReadModel';
import type { Database } from '@/types/supabase';

type RestaurantServiceItemRow = Database['public']['Tables']['restaurant_service_items']['Row'];
type RestaurantFieldSyncStatusRow =
  Database['public']['Tables']['restaurant_field_sync_statuses']['Row'];

export function mapServiceItem(
  row: RestaurantServiceItemRow,
  lookup: Map<string, RestaurantFieldSyncStatusRow>,
): GoogleBusinessProfileBusinessInfo['serviceItems'][number] {
  const entityTable = 'restaurant_service_items';
  const entityKey = getServiceItemEntityKey({
    itemKey: row.item_key,
  });

  return {
    id: row.id,
    itemKey: row.item_key,
    itemType: row.item_type,
    displayName: row.display_name,
    description: row.description,
    payload: normalizeRecord(row.payload_json),
    lastSyncedAt: row.last_synced_at,
    verificationStatus: combineFieldVerifications([
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'item_type')),
        row.item_type,
      ),
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'display_name')),
        row.display_name,
      ),
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'description')),
        row.description,
      ),
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'payload_json')),
        row.payload_json,
      ),
    ]),
  };
}
