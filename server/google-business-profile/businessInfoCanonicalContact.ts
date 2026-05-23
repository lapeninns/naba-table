import {
  GBP_CHANGE_PROVENANCE,
  GBP_MANAGED_BY,
  GBP_SOURCE,
} from './businessInfoCanonicalConstants';
import { normalizeStringArray, normalizeText } from './businessInfoNormalizationCore';
import { buildFormattedAddress } from './businessInfoPlaceNormalization';

import type { GoogleBusinessProfileLocationProfile } from './client';
import type { Database } from '@/types/supabase';

type AddressInsert = Database['public']['Tables']['restaurant_addresses']['Insert'];
type PhoneInsert = Database['public']['Tables']['restaurant_phone_numbers']['Insert'];
type LinkInsert = Database['public']['Tables']['restaurant_links']['Insert'];

export type CanonicalContactRows = {
  addresses: AddressInsert[];
  phoneNumbers: PhoneInsert[];
  links: LinkInsert[];
};

export function buildCanonicalAddressRows(input: {
  restaurantId: string;
  location: GoogleBusinessProfileLocationProfile;
  sourceRecordId: string | null;
  syncedAt: string;
}): AddressInsert[] {
  const { restaurantId, location, sourceRecordId, syncedAt } = input;
  if (!location.storefrontAddress) {
    return [];
  }

  return [
    {
      restaurant_id: restaurantId,
      address_type: 'storefront',
      formatted_address: buildFormattedAddress(location.storefrontAddress),
      address_lines: location.storefrontAddress.addressLines ?? [],
      locality: normalizeText(location.storefrontAddress.locality),
      administrative_area: normalizeText(location.storefrontAddress.administrativeArea),
      postal_code: normalizeText(location.storefrontAddress.postalCode),
      region_code: normalizeText(location.storefrontAddress.regionCode),
      country_code: normalizeText(location.storefrontAddress.regionCode),
      language_code: normalizeText(location.storefrontAddress.languageCode),
      sublocality: normalizeText(location.storefrontAddress.sublocality),
      organization: normalizeText(location.storefrontAddress.organization),
      recipients: location.storefrontAddress.recipients ?? [],
      latitude:
        location.latlng && typeof location.latlng.latitude === 'number'
          ? location.latlng.latitude
          : null,
      longitude:
        location.latlng && typeof location.latlng.longitude === 'number'
          ? location.latlng.longitude
          : null,
      latlng_json:
        location.latlng &&
        typeof location.latlng.latitude === 'number' &&
        typeof location.latlng.longitude === 'number'
          ? location.latlng
          : null,
      is_primary: true,
      display_order: 0,
      source: GBP_SOURCE,
      source_record_id: sourceRecordId,
      managed_by: GBP_MANAGED_BY,
      last_synced_at: syncedAt,
      ...GBP_CHANGE_PROVENANCE,
    },
  ];
}

export function buildCanonicalPhoneRows(input: {
  restaurantId: string;
  location: GoogleBusinessProfileLocationProfile;
  sourceRecordId: string | null;
  syncedAt: string;
}): PhoneInsert[] {
  const { restaurantId, location, sourceRecordId, syncedAt } = input;
  const phoneNumbers: PhoneInsert[] = [];
  const primaryPhone = normalizeText(location.phoneNumbers?.primaryPhone);

  if (primaryPhone) {
    phoneNumbers.push({
      restaurant_id: restaurantId,
      phone_kind: 'primary',
      phone_number: primaryPhone,
      is_primary: true,
      display_order: 0,
      source: GBP_SOURCE,
      source_record_id: sourceRecordId,
      managed_by: GBP_MANAGED_BY,
      last_synced_at: syncedAt,
      ...GBP_CHANGE_PROVENANCE,
    });
  }

  normalizeStringArray(location.phoneNumbers?.additionalPhones).forEach((phoneNumber, index) => {
    phoneNumbers.push({
      restaurant_id: restaurantId,
      phone_kind: 'additional',
      phone_number: phoneNumber,
      is_primary: false,
      display_order: index + 1,
      source: GBP_SOURCE,
      source_record_id: sourceRecordId,
      managed_by: GBP_MANAGED_BY,
      last_synced_at: syncedAt,
      ...GBP_CHANGE_PROVENANCE,
    });
  });

  return phoneNumbers;
}

export function buildCanonicalBaseLinkRows(input: {
  restaurantId: string;
  location: GoogleBusinessProfileLocationProfile;
  sourceRecordId: string | null;
  syncedAt: string;
}): LinkInsert[] {
  const { restaurantId, location, sourceRecordId, syncedAt } = input;
  const links: LinkInsert[] = [];
  const websiteUri = normalizeText(location.websiteUri);

  if (websiteUri) {
    links.push({
      restaurant_id: restaurantId,
      link_type: 'website',
      link_status: 'current',
      label: 'Website',
      url: websiteUri,
      is_primary: true,
      display_order: 0,
      source: GBP_SOURCE,
      source_record_id: sourceRecordId,
      managed_by: GBP_MANAGED_BY,
      last_synced_at: syncedAt,
      ...GBP_CHANGE_PROVENANCE,
    });
  }

  const mapsUri = normalizeText(location.metadata?.mapsUri);
  if (mapsUri) {
    links.push({
      restaurant_id: restaurantId,
      link_type: 'google_map',
      link_status: 'current',
      label: 'Google Maps',
      url: mapsUri,
      is_primary: false,
      display_order: links.length,
      source: GBP_SOURCE,
      source_record_id: sourceRecordId,
      managed_by: GBP_MANAGED_BY,
      last_synced_at: syncedAt,
      ...GBP_CHANGE_PROVENANCE,
    });
  }

  const reviewUri = normalizeText(location.metadata?.newReviewUri);
  if (reviewUri) {
    links.push({
      restaurant_id: restaurantId,
      link_type: 'google_review',
      link_status: 'current',
      label: 'Google reviews',
      url: reviewUri,
      is_primary: false,
      display_order: links.length,
      source: GBP_SOURCE,
      source_record_id: sourceRecordId,
      managed_by: GBP_MANAGED_BY,
      last_synced_at: syncedAt,
      ...GBP_CHANGE_PROVENANCE,
    });
  }

  return links;
}

export function buildCanonicalContactRows(input: {
  restaurantId: string;
  location: GoogleBusinessProfileLocationProfile;
  sourceRecordId: string | null;
  syncedAt: string;
}): CanonicalContactRows {
  return {
    addresses: buildCanonicalAddressRows(input),
    phoneNumbers: buildCanonicalPhoneRows(input),
    links: buildCanonicalBaseLinkRows(input),
  };
}
