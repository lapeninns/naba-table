import {
  buildFieldStatusLookupKey,
  getLinkEntityKey,
  getPhoneEntityKey,
} from './businessInfoFieldSyncStatus';
import {
  combineFieldVerifications,
  resolveFieldVerification,
} from './businessInfoReadModelVerification';

import type { GoogleBusinessProfileBusinessInfo } from './businessInfoReadModel';
import type { Database } from '@/types/supabase';

type RestaurantPhoneNumberRow = Database['public']['Tables']['restaurant_phone_numbers']['Row'];
type RestaurantLinkRow = Database['public']['Tables']['restaurant_links']['Row'];
type RestaurantFieldSyncStatusRow =
  Database['public']['Tables']['restaurant_field_sync_statuses']['Row'];

export function mapPhoneNumber(
  row: RestaurantPhoneNumberRow,
  lookup: Map<string, RestaurantFieldSyncStatusRow>,
): GoogleBusinessProfileBusinessInfo['phoneNumbers'][number] {
  const entityTable = 'restaurant_phone_numbers';
  const entityKey = getPhoneEntityKey({
    phoneKind: row.phone_kind,
    displayOrder: row.display_order,
  });
  return {
    id: row.id,
    phoneKind: row.phone_kind,
    phoneNumber: row.phone_number,
    isPrimary: row.is_primary,
    lastSyncedAt: row.last_synced_at,
    verificationStatus: resolveFieldVerification(
      lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'phone_number')),
      row.phone_number,
    ),
  };
}

export function mapLink(
  row: RestaurantLinkRow,
  lookup: Map<string, RestaurantFieldSyncStatusRow>,
): GoogleBusinessProfileBusinessInfo['links'][number] {
  const entityTable = 'restaurant_links';
  const entityKey = getLinkEntityKey({
    linkType: row.link_type,
    displayOrder: row.display_order,
  });
  return {
    id: row.id,
    linkType: row.link_type,
    linkStatus: row.link_status,
    label: row.label,
    url: row.url,
    isPrimary: row.is_primary,
    lastSyncedAt: row.last_synced_at,
    verificationStatus: combineFieldVerifications([
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'url')),
        row.url,
      ),
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'label')),
        row.label,
      ),
    ]),
  };
}
