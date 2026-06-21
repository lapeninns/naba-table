import { buildFieldStatusLookupKey, getDetailsEntityKey } from './businessInfoFieldSyncStatus';
import { resolveFieldVerification } from './businessInfoReadModelVerification';

import type { GoogleBusinessProfileBusinessInfo } from './businessInfoReadModel';
import type { Database } from '@/types/supabase';

type RestaurantBusinessDetailsRow =
  Database['public']['Tables']['restaurant_business_details']['Row'];
type RestaurantFieldSyncStatusRow =
  Database['public']['Tables']['restaurant_field_sync_statuses']['Row'];

export function mapDetails(
  row: RestaurantBusinessDetailsRow | null,
  lookup: Map<string, RestaurantFieldSyncStatusRow>,
): GoogleBusinessProfileBusinessInfo['details'] {
  if (!row) {
    return null;
  }

  const entityTable = 'restaurant_business_details';
  const entityKey = getDetailsEntityKey();

  return {
    businessName: row.business_name,
    description: row.description,
    languageCode: row.language_code,
    openingDate: row.opening_date,
    businessStatus: row.business_status,
    isServiceAreaBusiness: row.is_service_area_business,
    canReopen: row.can_reopen,
    source: row.source,
    managedBy: row.managed_by,
    lastSyncedAt: row.last_synced_at,
    verification: {
      businessName: resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'business_name')),
        row.business_name,
      ),
      description: resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'description')),
        row.description,
      ),
      languageCode: resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'language_code')),
        row.language_code,
      ),
      openingDate: resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'opening_date')),
        row.opening_date,
      ),
      businessStatus: resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'business_status')),
        row.business_status,
      ),
      isServiceAreaBusiness: resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'is_service_area_business')),
        row.is_service_area_business,
      ),
      canReopen: resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'can_reopen')),
        row.can_reopen,
      ),
    },
  };
}
