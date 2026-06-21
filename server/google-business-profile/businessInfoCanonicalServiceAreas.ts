import {
  GBP_CHANGE_PROVENANCE,
  GBP_MANAGED_BY,
  GBP_SOURCE,
} from './businessInfoCanonicalConstants';
import { normalizeServiceAreaType, pickPlaceDisplayName } from './businessInfoCanonicalHelpers';
import { normalizeText } from './businessInfoNormalizationCore';
import { pickGooglePlaceId, pickGooglePlaceResourceName } from './businessInfoPlaceNormalization';

import type { GoogleBusinessProfileLocationProfile } from './client';
import type { Database } from '@/types/supabase';

type ServiceAreaInsert = Database['public']['Tables']['restaurant_service_areas']['Insert'];

export function buildCanonicalServiceAreaRows(input: {
  restaurantId: string;
  location: GoogleBusinessProfileLocationProfile;
  sourceRecordId: string | null;
  syncedAt: string;
}): ServiceAreaInsert[] {
  const { restaurantId, location, sourceRecordId, syncedAt } = input;
  const serviceAreas: ServiceAreaInsert[] = [];
  const placeInfos = location.serviceArea?.places?.placeInfos ?? [];

  placeInfos.forEach((place, index) => {
    const placeRecord = place as Record<string, unknown>;
    const placeDisplayName = pickPlaceDisplayName(placeRecord);
    if (!placeDisplayName) {
      return;
    }

    serviceAreas.push({
      restaurant_id: restaurantId,
      display_name: placeDisplayName,
      area_type: 'place',
      region_code: normalizeText(location.serviceArea?.regionCode),
      place_data_json: place as ServiceAreaInsert['place_data_json'],
      google_place_id: pickGooglePlaceId(placeRecord),
      google_place_resource_name: pickGooglePlaceResourceName(placeRecord),
      display_order: index,
      source: GBP_SOURCE,
      source_record_id: sourceRecordId,
      managed_by: GBP_MANAGED_BY,
      last_synced_at: syncedAt,
      ...GBP_CHANGE_PROVENANCE,
    });
  });

  if (serviceAreas.length > 0) {
    return serviceAreas;
  }

  const regionCode = normalizeText(location.serviceArea?.regionCode);
  if (!regionCode) {
    return serviceAreas;
  }

  serviceAreas.push({
    restaurant_id: restaurantId,
    display_name: regionCode,
    area_type: normalizeServiceAreaType(location.serviceArea?.businessType) || 'region',
    region_code: regionCode,
    place_data_json: {
      businessType: normalizeText(location.serviceArea?.businessType),
      regionCode,
    } as ServiceAreaInsert['place_data_json'],
    display_order: 0,
    source: GBP_SOURCE,
    source_record_id: sourceRecordId,
    managed_by: GBP_MANAGED_BY,
    last_synced_at: syncedAt,
    ...GBP_CHANGE_PROVENANCE,
  });

  return serviceAreas;
}
