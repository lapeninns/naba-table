import { buildFieldStatusLookupKey, getAddressEntityKey } from './businessInfoFieldSyncStatus';
import { normalizeRecord } from './businessInfoNormalization';
import {
  combineFieldVerifications,
  resolveFieldVerification,
} from './businessInfoReadModelVerification';

import type { GoogleBusinessProfileBusinessInfo } from './businessInfoReadModel';
import type { Database } from '@/types/supabase';

type RestaurantAddressRow = Database['public']['Tables']['restaurant_addresses']['Row'];
type RestaurantFieldSyncStatusRow =
  Database['public']['Tables']['restaurant_field_sync_statuses']['Row'];

export function mapAddress(
  row: RestaurantAddressRow,
  lookup: Map<string, RestaurantFieldSyncStatusRow>,
): GoogleBusinessProfileBusinessInfo['addresses'][number] {
  const addressLines = Array.isArray(row.address_lines)
    ? row.address_lines.filter((value): value is string => typeof value === 'string')
    : [];
  const entityTable = 'restaurant_addresses';
  const entityKey = getAddressEntityKey({
    addressType: row.address_type,
    displayOrder: row.display_order,
  });
  const latitude = typeof row.latitude === 'number' ? row.latitude : null;
  const longitude = typeof row.longitude === 'number' ? row.longitude : null;
  const latlngJson = normalizeRecord(row.latlng_json) as {
    latitude?: number;
    longitude?: number;
  } | null;

  return {
    id: row.id,
    addressType: row.address_type,
    formattedAddress: row.formatted_address,
    addressLines,
    locality: row.locality,
    administrativeArea: row.administrative_area,
    postalCode: row.postal_code,
    regionCode: row.region_code,
    countryCode: row.country_code,
    languageCode: row.language_code,
    sublocality: row.sublocality,
    organization: row.organization,
    sortingCode: row.sorting_code,
    recipients: Array.isArray(row.recipients)
      ? row.recipients.filter((value): value is string => typeof value === 'string')
      : [],
    latlng:
      latlngJson ?? (latitude !== null && longitude !== null ? { latitude, longitude } : null),
    latitude,
    longitude,
    isPrimary: row.is_primary,
    lastSyncedAt: row.last_synced_at,
    verificationStatus: combineFieldVerifications([
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'formatted_address')),
        row.formatted_address,
      ),
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'address_lines')),
        addressLines,
      ),
      resolveFieldVerification(
        lookup.get(buildFieldStatusLookupKey(entityTable, entityKey, 'locality')),
        row.locality,
      ),
    ]),
  };
}
