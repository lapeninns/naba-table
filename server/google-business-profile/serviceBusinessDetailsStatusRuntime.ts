import { getRestaurantDetails } from '@/server/restaurants/details';

import {
  buildFieldDiff,
  buildSelectedLocation,
  getPrimaryBusinessInfoValues,
  mapBusinessDetailsConnectionStatus,
} from './serviceBusinessDetailsStatus';
import { getGoogleBusinessProfileConnectionStateForClient } from './serviceConnectionStateRuntime';

import type { GoogleBusinessProfileBusinessDetailsStatus } from './serviceBusinessDetailsStatusTypes';
import type { DbClient } from './serviceRepository';

export async function getGoogleBusinessProfileBusinessDetailsStatusForClient(
  restaurantId: string,
  client: DbClient,
): Promise<GoogleBusinessProfileBusinessDetailsStatus> {
  const [state, profile] = await Promise.all([
    getGoogleBusinessProfileConnectionStateForClient(restaurantId, client),
    getRestaurantDetails(restaurantId, client),
  ]);
  const values = getPrimaryBusinessInfoValues(state);
  const googleName =
    state.externalLocationTitle ?? state.businessInfo.details?.businessName ?? null;

  return {
    connection: {
      isConfigured: state.isConfigured,
      provider: state.provider,
      status: mapBusinessDetailsConnectionStatus(state.status),
      rawStatus: state.status,
      connectedGoogleEmail: state.connectedGoogleEmail,
      connectedGoogleName: state.connectedGoogleName,
      lastError: state.lastError,
    },
    selectedLocation: buildSelectedLocation(state),
    lastSync: {
      pulledAt: state.lastPullAt,
      pushedAt: state.lastPushAt,
    },
    fieldDiffs: [
      buildFieldDiff({
        field: 'name',
        label: 'Business name',
        localValue: profile.name,
        googleValue: googleName,
      }),
      buildFieldDiff({
        field: 'contactPhone',
        label: 'Phone',
        localValue: profile.contactPhone,
        googleValue: values.phone,
      }),
      buildFieldDiff({
        field: 'address',
        label: 'Address',
        localValue: profile.address,
        googleValue: values.address,
      }),
      buildFieldDiff({
        field: 'googleMapUrl',
        label: 'Google Maps URL',
        localValue: profile.googleMapUrl,
        googleValue: values.mapsUri,
      }),
      buildFieldDiff({
        field: 'googleReviewUrl',
        label: 'Google review URL',
        localValue: profile.googleReviewUrl,
        googleValue: values.newReviewUri,
      }),
    ],
    availableLocations: state.availableLocations,
  };
}
