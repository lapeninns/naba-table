import { buildFieldStatusLookupKey, getCategoryEntityKey } from './businessInfoFieldSyncStatus';
import { normalizeJsonArray, normalizeRecord, normalizeText } from './businessInfoNormalization';
import {
  combineFieldVerifications,
  resolveFieldVerification,
} from './businessInfoReadModelVerification';

import type { GoogleBusinessProfileBusinessInfo } from './businessInfoReadModel';
import type { Database } from '@/types/supabase';

type RestaurantCategoryRow = Database['public']['Tables']['restaurant_categories']['Row'];
type RestaurantFieldSyncStatusRow =
  Database['public']['Tables']['restaurant_field_sync_statuses']['Row'];

export function mapCategory(
  row: RestaurantCategoryRow,
  lookup: Map<string, RestaurantFieldSyncStatusRow>,
): GoogleBusinessProfileBusinessInfo['categories'][number] {
  const entityTable = 'restaurant_categories';
  const entityKey = getCategoryEntityKey({
    displayOrder: row.display_order,
  });
  return {
    id: row.id,
    displayName: row.display_name,
    categoryCode: row.category_code,
    moreHoursTypes: normalizeJsonArray(row.more_hours_types_json, (item) => {
      const record = normalizeRecord(item);
      if (!record) {
        return null;
      }

      const hoursTypeId =
        typeof record.hoursTypeId === 'string' ? normalizeText(record.hoursTypeId) : null;
      const displayName =
        typeof record.displayName === 'string' ? normalizeText(record.displayName) : null;
      const localizedDisplayName =
        typeof record.localizedDisplayName === 'string'
          ? normalizeText(record.localizedDisplayName)
          : null;

      if (!hoursTypeId && !displayName && !localizedDisplayName) {
        return null;
      }

      return {
        hoursTypeId,
        displayName,
        localizedDisplayName,
      };
    }),
    isPrimary: row.is_primary,
    lastSyncedAt: row.last_synced_at,
    verificationStatus: combineFieldVerifications([
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'display_name')),
        row.display_name,
      ),
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'category_code')),
        row.category_code,
      ),
    ]),
  };
}
