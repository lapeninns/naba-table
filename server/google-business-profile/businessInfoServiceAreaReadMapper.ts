import { buildFieldStatusLookupKey, getServiceAreaEntityKey } from './businessInfoFieldSyncStatus';
import { normalizeRecord } from './businessInfoNormalization';
import {
  combineFieldVerifications,
  resolveFieldVerification,
} from './businessInfoReadModelVerification';

import type { GoogleBusinessProfileBusinessInfo } from './businessInfoReadModel';
import type { Database } from '@/types/supabase';

type RestaurantServiceAreaRow = Database['public']['Tables']['restaurant_service_areas']['Row'];
type RestaurantFieldSyncStatusRow =
  Database['public']['Tables']['restaurant_field_sync_statuses']['Row'];

export function mapServiceArea(
  row: RestaurantServiceAreaRow,
  lookup: Map<string, RestaurantFieldSyncStatusRow>,
): GoogleBusinessProfileBusinessInfo['serviceAreas'][number] {
  const entityTable = 'restaurant_service_areas';
  const entityKey = getServiceAreaEntityKey({
    displayOrder: row.display_order,
  });
  return {
    id: row.id,
    displayName: row.display_name,
    areaType: row.area_type,
    regionCode: row.region_code,
    googlePlaceId: row.google_place_id,
    googlePlaceResourceName: row.google_place_resource_name,
    placeData: normalizeRecord(row.place_data_json),
    lastSyncedAt: row.last_synced_at,
    verificationStatus: combineFieldVerifications([
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'display_name')),
        row.display_name,
      ),
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'area_type')),
        row.area_type,
      ),
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'place_data_json')),
        row.place_data_json,
      ),
    ]),
  };
}
