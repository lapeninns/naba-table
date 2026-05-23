import {
  normalizeStringArray,
  normalizeText,
  pickNestedText,
} from './businessInfoNormalizationCore';

import type { GoogleBusinessProfileLocationProfile } from './client';

export function pickGooglePlaceResourceName(record: Record<string, unknown>): string | null {
  const resourceName =
    pickNestedText(record, ['resourceName']) ??
    pickNestedText(record, ['name']) ??
    pickNestedText(record, ['place', 'resourceName']) ??
    pickNestedText(record, ['place', 'name']);
  if (resourceName) {
    return resourceName;
  }

  const placeId =
    pickNestedText(record, ['placeId']) ??
    pickNestedText(record, ['place_id']) ??
    pickNestedText(record, ['place', 'placeId']) ??
    pickNestedText(record, ['place', 'place_id']);
  return placeId ? `places/${placeId}` : null;
}

export function pickGooglePlaceId(record: Record<string, unknown>): string | null {
  const direct =
    pickNestedText(record, ['placeId']) ??
    pickNestedText(record, ['place_id']) ??
    pickNestedText(record, ['place', 'placeId']) ??
    pickNestedText(record, ['place', 'place_id']) ??
    pickNestedText(record, ['metadata', 'placeId']) ??
    pickNestedText(record, ['place', 'metadata', 'placeId']);
  if (direct) {
    return direct;
  }

  const resourceName = pickGooglePlaceResourceName(record);
  return resourceName?.startsWith('places/') ? (resourceName.split('/')[1] ?? null) : null;
}

export function buildFormattedAddress(
  address: GoogleBusinessProfileLocationProfile['storefrontAddress'],
): string | null {
  if (!address) {
    return null;
  }

  const parts = [
    ...normalizeStringArray(address.addressLines),
    normalizeText(address.locality),
    normalizeText(address.administrativeArea),
    normalizeText(address.postalCode),
    normalizeText(address.regionCode),
  ].filter((value): value is string => Boolean(value));

  return parts.length > 0 ? parts.join(', ') : null;
}
