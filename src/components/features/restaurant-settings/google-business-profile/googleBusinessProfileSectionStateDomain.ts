import {
  buildGoogleMapsPlaceHref,
  buildLocationValue,
} from './googleBusinessProfileConnectionModel';
import {
  getConnectedAccountLabel,
  getGbpConnectionDescription,
  getGbpLocationStep,
  getLocationTitle,
  isGbpConnectionStepDone,
  type GbpLocationStep,
} from './googleBusinessProfileWorkflow';
import { getSafeSettingsErrorMessage } from '../shared/settingsErrorCopy';

import type {
  GoogleBusinessProfileAvailableLocation,
  GoogleBusinessProfileConnection,
} from '@/services/ops/restaurants';

export type GoogleBusinessProfileSectionSummary = {
  accountLabel: string;
  canDisconnect: boolean;
  canRefresh: boolean;
  /** Step 3 is available when a location is mapped and the connection is linked or has a sync issue. */
  canReview: boolean;
  connectionDescription: string;
  connectionDone: boolean;
  hasLinkedLocation: boolean;
  isLinked: boolean;
  locationStep: GbpLocationStep;
  locationTitle: string;
  locationsArePossiblyStale: boolean;
  locationsErrorMessage: string | null;
  manageOnGoogleHref: string | null;
  showConnect: boolean;
  showPicker: boolean;
  status: GoogleBusinessProfileConnection['status'];
};

export function mergeGoogleBusinessProfileConnectionData({
  availableLocations,
  connectionData,
}: {
  connectionData: GoogleBusinessProfileConnection | undefined;
  availableLocations: GoogleBusinessProfileAvailableLocation[] | undefined;
}): GoogleBusinessProfileConnection | undefined {
  return connectionData
    ? {
        ...connectionData,
        availableLocations: availableLocations ?? connectionData.availableLocations,
      }
    : undefined;
}

export function findGoogleBusinessProfileSelectedLocation({
  data,
  selectedLocationValue,
}: {
  data: GoogleBusinessProfileConnection | null | undefined;
  selectedLocationValue: string;
}): GoogleBusinessProfileAvailableLocation | null {
  if (!data) {
    return null;
  }

  return (
    data.availableLocations.find(
      (location) => buildLocationValue(location) === selectedLocationValue,
    ) ?? null
  );
}

export function findGoogleBusinessProfileLinkedLocation(
  data: GoogleBusinessProfileConnection | null | undefined,
): GoogleBusinessProfileAvailableLocation | null {
  if (!data?.externalLocationName || !data.externalAccountName) {
    return null;
  }
  return (
    data.availableLocations.find(
      (location) =>
        location.locationName === data.externalLocationName &&
        location.accountName === data.externalAccountName,
    ) ?? null
  );
}

export type GoogleBusinessProfileLinkedLocationDetails = {
  business: string;
  account: string;
  address: string;
};

/** Business, account and address of the mapped listing, from the best source the API returns. */
export function describeGoogleBusinessProfileLinkedLocation(
  data: GoogleBusinessProfileConnection,
): GoogleBusinessProfileLinkedLocationDetails {
  const linked = findGoogleBusinessProfileLinkedLocation(data);
  const primaryAddress =
    data.businessInfo.addresses.find((address) => address.isPrimary) ??
    data.businessInfo.addresses[0] ??
    null;
  return {
    business: linked?.title ?? getLocationTitle(data),
    account: linked?.accountDisplayName ?? data.externalAccountName ?? 'Not available',
    address: linked?.addressText ?? primaryAddress?.formattedAddress ?? 'Not available',
  };
}

export function resolveGoogleBusinessProfileSelectedLocationValue({
  data,
  selectedLocationValue,
}: {
  data: GoogleBusinessProfileConnection | null | undefined;
  selectedLocationValue: string;
}): string | null {
  if (!data) {
    return null;
  }

  const linkedLocation = findGoogleBusinessProfileLinkedLocation(data);
  if (linkedLocation) {
    return buildLocationValue(linkedLocation);
  }

  if (!selectedLocationValue && data.availableLocations[0]) {
    return buildLocationValue(data.availableLocations[0]);
  }

  return null;
}

export function deriveGoogleBusinessProfileSectionSummary({
  data,
  locationsError,
}: {
  data: GoogleBusinessProfileConnection | null | undefined;
  locationsError?: { message?: string | null } | null;
}): GoogleBusinessProfileSectionSummary {
  const status = data?.status ?? 'unlinked';
  const hasLinkedLocation = Boolean(data?.externalLocationId);
  const isLinked = data?.status === 'linked' || data?.status === 'sync_error';
  const showPicker = data?.status === 'authorized' || data?.status === 'reauth_required';
  const showConnect = !isLinked && !showPicker && data?.status !== 'authorized';
  const canRefresh = Boolean(data && data.status !== 'unlinked');
  const canDisconnect = Boolean(data && data.status !== 'unlinked');
  const canReview = Boolean(isLinked && data?.externalAccountId && data.externalLocationId);

  return {
    accountLabel: getConnectedAccountLabel(data ?? null),
    canDisconnect,
    canRefresh,
    canReview,
    connectionDescription: getGbpConnectionDescription(status),
    connectionDone: isGbpConnectionStepDone(status),
    hasLinkedLocation,
    isLinked,
    locationStep: getGbpLocationStep(status),
    locationTitle: getLocationTitle(data ?? null),
    locationsArePossiblyStale: Boolean(locationsError) && Boolean(data?.availableLocations.length),
    locationsErrorMessage: locationsError
      ? getSafeSettingsErrorMessage(locationsError, 'Google locations could not be loaded.')
      : null,
    manageOnGoogleHref: buildGoogleMapsPlaceHref(data?.externalPlaceId ?? null),
    showConnect,
    showPicker,
    status,
  };
}
