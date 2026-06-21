import {
  buildGoogleMapsPlaceHref,
  buildLocationValue,
} from './googleBusinessProfileConnectionModel';
import {
  getConnectedAccountLabel,
  getLocationTitle,
  getStage,
  getStageLabel,
  type GbpWorkflowStage,
} from './googleBusinessProfileWorkflow';

import type {
  GoogleBusinessProfileAvailableLocation,
  GoogleBusinessProfileConnection,
} from '@/services/ops/restaurants';

export type GoogleBusinessProfileSectionSummary = {
  accountLabel: string;
  canDisconnect: boolean;
  canRefresh: boolean;
  hasLinkedLocation: boolean;
  isLinked: boolean;
  locationTitle: string;
  locationsArePossiblyStale: boolean;
  locationsErrorMessage: string | null;
  manageOnGoogleHref: string | null;
  showConnect: boolean;
  showPicker: boolean;
  stage: GbpWorkflowStage;
  stageLabel: string;
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

  if (data.externalLocationName && data.externalAccountName) {
    const linkedLocation = data.availableLocations.find(
      (location) =>
        location.locationName === data.externalLocationName &&
        location.accountName === data.externalAccountName,
    );
    if (linkedLocation) {
      return buildLocationValue(linkedLocation);
    }
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
  const stage = getStage(data);
  const status = data?.status ?? 'unlinked';
  const hasLinkedLocation = Boolean(data?.externalLocationId);
  const isLinked = data?.status === 'linked' || data?.status === 'sync_error';
  const showPicker = data?.status === 'authorized' || data?.status === 'reauth_required';
  const showConnect = !isLinked && !showPicker && data?.status !== 'authorized';
  const canRefresh = Boolean(data && data.status !== 'unlinked');
  const canDisconnect = Boolean(data && data.status !== 'unlinked');

  return {
    accountLabel: getConnectedAccountLabel(data ?? null),
    canDisconnect,
    canRefresh,
    hasLinkedLocation,
    isLinked,
    locationTitle: getLocationTitle(data ?? null),
    locationsArePossiblyStale: Boolean(locationsError) && Boolean(data?.availableLocations.length),
    locationsErrorMessage: locationsError?.message ?? null,
    manageOnGoogleHref: buildGoogleMapsPlaceHref(data?.externalPlaceId ?? null),
    showConnect,
    showPicker,
    stage,
    stageLabel: getStageLabel(stage),
    status,
  };
}
