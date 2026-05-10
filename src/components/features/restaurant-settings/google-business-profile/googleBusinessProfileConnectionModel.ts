import type { GoogleBusinessProfileAvailableLocation } from '@/services/ops/restaurants';

export function buildGoogleMapsPlaceHref(placeId: string | null | undefined): string | null {
  return placeId
    ? `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(placeId)}`
    : null;
}

export function buildLocationValue(location: GoogleBusinessProfileAvailableLocation): string {
  return JSON.stringify({
    accountName: location.accountName,
    accountId: location.accountId,
    locationName: location.locationName,
    locationId: location.locationId,
  });
}
