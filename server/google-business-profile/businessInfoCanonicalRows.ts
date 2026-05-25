import { buildCanonicalAttributeRows } from './businessInfoCanonicalAttributes';
import { buildCanonicalCategoryRows } from './businessInfoCanonicalCategories';
import { buildCanonicalContactRows } from './businessInfoCanonicalContact';
import { buildCanonicalDetailsRow } from './businessInfoCanonicalDetails';
import { buildCanonicalHourRows } from './businessInfoCanonicalHours';
import { buildCanonicalServiceAreaRows } from './businessInfoCanonicalServiceAreas';
import { buildCanonicalServiceItemRows } from './businessInfoCanonicalServiceItems';
import { normalizeText } from './businessInfoNormalization';

import type {
  GoogleBusinessProfileAttributesResponse,
  GoogleBusinessProfileLocationProfile,
} from './client';
import type { Database } from '@/types/supabase';

export {
  GBP_CHANGE_PROVENANCE,
  GBP_MANAGED_BY,
  GBP_SOURCE,
} from './businessInfoCanonicalConstants';
export {
  buildAttributeDisplayText,
  deriveLinkTypeFromAttribute,
  extractLastSegment,
  normalizeAttributeValueType,
  normalizeServiceAreaType,
  pickPlaceDisplayName,
} from './businessInfoCanonicalHelpers';

export type CanonicalSyncRows = {
  details: Database['public']['Tables']['restaurant_business_details']['Insert'] | null;
  addresses: Array<Database['public']['Tables']['restaurant_addresses']['Insert']>;
  phoneNumbers: Array<Database['public']['Tables']['restaurant_phone_numbers']['Insert']>;
  links: Array<Database['public']['Tables']['restaurant_links']['Insert']>;
  categories: Array<Database['public']['Tables']['restaurant_categories']['Insert']>;
  serviceAreas: Array<Database['public']['Tables']['restaurant_service_areas']['Insert']>;
  hours: Array<Database['public']['Tables']['restaurant_hours']['Insert']>;
  attributes: Array<Database['public']['Tables']['restaurant_attributes']['Insert']>;
  serviceItems: Array<Database['public']['Tables']['restaurant_service_items']['Insert']>;
};

export function buildCanonicalRows(input: {
  restaurantId: string;
  location: GoogleBusinessProfileLocationProfile;
  attributes: GoogleBusinessProfileAttributesResponse | null;
  syncedAt: string;
}): CanonicalSyncRows {
  const { restaurantId, location, attributes, syncedAt } = input;
  const sourceRecordId = normalizeText(location.name);
  const details = buildCanonicalDetailsRow({
    restaurantId,
    location,
    sourceRecordId,
    syncedAt,
  });

  const contactRows = buildCanonicalContactRows({
    restaurantId,
    location,
    sourceRecordId,
    syncedAt,
  });
  const links = [...contactRows.links];

  const categories = buildCanonicalCategoryRows({
    restaurantId,
    location,
    sourceRecordId,
    syncedAt,
  });

  const serviceAreas = buildCanonicalServiceAreaRows({
    restaurantId,
    location,
    sourceRecordId,
    syncedAt,
  });

  const hours = buildCanonicalHourRows({
    restaurantId,
    location,
    sourceRecordId,
    syncedAt,
  });

  const attributeProjection = buildCanonicalAttributeRows({
    restaurantId,
    attributes,
    sourceRecordId,
    syncedAt,
    startingLinkDisplayOrder: links.length,
  });
  links.push(...attributeProjection.links);

  const serviceItems = buildCanonicalServiceItemRows({
    restaurantId,
    location,
    syncedAt,
  });

  return {
    details,
    addresses: contactRows.addresses,
    phoneNumbers: contactRows.phoneNumbers,
    links,
    categories,
    serviceAreas,
    hours,
    attributes: attributeProjection.attributes,
    serviceItems,
  };
}
