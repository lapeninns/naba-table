import {
  GBP_CHANGE_PROVENANCE,
  GBP_MANAGED_BY,
  GBP_SOURCE,
} from './businessInfoCanonicalConstants';
import { normalizeRecord } from './businessInfoNormalizationCore';
import {
  deriveServiceItemKey,
  pickServiceItemDescription,
  pickServiceItemDisplayName,
  pickServiceItemType,
} from './businessInfoServiceItemNormalization';

import type { GoogleBusinessProfileLocationProfile } from './client';
import type { Database } from '@/types/supabase';

type ServiceItemInsert = Database['public']['Tables']['restaurant_service_items']['Insert'];

export function buildCanonicalServiceItemRows(input: {
  restaurantId: string;
  location: GoogleBusinessProfileLocationProfile;
  syncedAt: string;
}): ServiceItemInsert[] {
  return (input.location.serviceItems ?? []).map((item, index) => {
    const normalizedItem = normalizeRecord(item) ?? {};
    const itemKey = deriveServiceItemKey(normalizedItem, index);

    return {
      restaurant_id: input.restaurantId,
      item_key: itemKey,
      item_type: pickServiceItemType(normalizedItem),
      display_name: pickServiceItemDisplayName(normalizedItem),
      description: pickServiceItemDescription(normalizedItem),
      payload_json: normalizedItem as ServiceItemInsert['payload_json'],
      display_order: index,
      source: GBP_SOURCE,
      source_record_id: itemKey,
      managed_by: GBP_MANAGED_BY,
      last_synced_at: input.syncedAt,
      ...GBP_CHANGE_PROVENANCE,
    };
  });
}
