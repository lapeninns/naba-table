import { getRestaurantDetails, updateRestaurantDetails } from '@/server/restaurants/details';
import { getOperatingHours, updateOperatingHours } from '@/server/restaurants/operatingHours';
import { getServicePeriods, updateServicePeriods } from '@/server/restaurants/servicePeriods';

import { readGoogleBusinessProfileBusinessInfo } from './business-info';
import {
  patchGoogleBusinessProfileLocation,
  updateGoogleBusinessProfileLocationAttributes,
} from './client';
import {
  buildPullOperatingHoursPayload,
  buildPullProfilePatch,
  buildPullServicePeriodsPayload,
  buildPushOperatingHoursLocationPatch,
  buildPushProfileLocationPatch,
  buildPushServicePeriodsLocationPatch,
  canPushServicePeriodsToGoogle,
  type CoreSyncDirection,
  type OperatingHoursSyncSelection,
  type ServicePeriodsSyncSelection,
} from './core-sync';
import { syncGoogleBusinessProfileBusinessInformationForClient } from './serviceBusinessInfoSyncRuntime';
import { assertGooglePushEnabled } from './serviceConnectionContext';
import { buildGooglePushSuccessExternalProfileUpdate } from './serviceConnectionLifecyclePayloads';
import { getLinkedExternalProfileWithLocation } from './serviceLinkedLocationRuntime';
import { findExternalProfile, updateExternalProfile, type DbClient } from './serviceRepository';
import {
  assertGoogleServicePeriodsPushCapability,
  assertGoogleServicePeriodsPushPatch,
  getProviderReferenceUpdatedAt,
  resolveRequestedDirection,
} from './serviceSyncPlanning';

import type { RestaurantDetails } from '@/server/restaurants/details';
import type { OperatingHoursSnapshot } from '@/server/restaurants/operatingHours';
import type { ServicePeriod } from '@/server/restaurants/servicePeriods';

export type GoogleBusinessProfileCoreSyncRuntimeClock = () => string;

const nowIso: GoogleBusinessProfileCoreSyncRuntimeClock = () => new Date().toISOString();

async function markGooglePushSuccess(
  externalProfileId: string,
  pushedAt: string,
  client: DbClient,
): Promise<void> {
  await updateExternalProfile(
    externalProfileId,
    buildGooglePushSuccessExternalProfileUpdate(pushedAt),
    client,
  );
}

export async function syncRestaurantProfileWithGoogleBusinessProfileForClient(params: {
  restaurantId: string;
  direction?: CoreSyncDirection;
  fields?: Array<'name' | 'contactPhone' | 'address' | 'googleMapUrl' | 'googleReviewUrl'>;
  approvedProfile?: RestaurantDetails;
  client: DbClient;
  clock?: GoogleBusinessProfileCoreSyncRuntimeClock;
}) {
  const resolveNow = params.clock ?? nowIso;
  const [profile, refreshedState, existingExternalProfile] = await Promise.all([
    params.approvedProfile
      ? Promise.resolve(params.approvedProfile)
      : getRestaurantDetails(params.restaurantId, params.client),
    syncGoogleBusinessProfileBusinessInformationForClient({
      restaurantId: params.restaurantId,
      client: params.client,
    }),
    findExternalProfile(params.restaurantId, params.client),
  ]);

  const direction = resolveRequestedDirection({
    requestedDirection: params.direction,
    coreUpdatedAt: profile.updatedAt,
    providerUpdatedAt: getProviderReferenceUpdatedAt(existingExternalProfile),
  });

  if (direction === 'pull_from_gbp') {
    const payload = {
      timezone: profile.timezone,
      ...buildPullProfilePatch({
        businessInfo: refreshedState.businessInfo,
        externalLocationTitle:
          refreshedState.externalLocationTitle ?? refreshedState.externalLocationName ?? null,
        fields: params.fields,
      }),
    };

    return updateRestaurantDetails(params.restaurantId, payload, params.client);
  }

  const { externalProfile, accessToken, locationResourceName, location } =
    await getLinkedExternalProfileWithLocation(params.restaurantId, params.client);
  assertGooglePushEnabled(externalProfile);
  const patch = buildPushProfileLocationPatch({
    profile,
    location,
    fields: params.fields,
  });

  if (patch.updateMask.length === 0) {
    return profile;
  }

  await patchGoogleBusinessProfileLocation(
    accessToken,
    locationResourceName,
    patch.payload,
    patch.updateMask,
    { validateOnly: true },
  );
  await patchGoogleBusinessProfileLocation(
    accessToken,
    locationResourceName,
    patch.payload,
    patch.updateMask,
  );

  const pushedAt = resolveNow();
  await markGooglePushSuccess(externalProfile.id, pushedAt, params.client);
  await syncGoogleBusinessProfileBusinessInformationForClient({
    restaurantId: params.restaurantId,
    client: params.client,
    runKind: 'core_sync',
  });

  return getRestaurantDetails(params.restaurantId, params.client);
}

export async function syncRestaurantOperatingHoursWithGoogleBusinessProfileForClient(params: {
  restaurantId: string;
  direction?: CoreSyncDirection;
  selection?: OperatingHoursSyncSelection;
  approvedSnapshot?: OperatingHoursSnapshot;
  client: DbClient;
  clock?: GoogleBusinessProfileCoreSyncRuntimeClock;
}) {
  const resolveNow = params.clock ?? nowIso;
  const [snapshot, refreshedState, existingExternalProfile] = await Promise.all([
    params.approvedSnapshot
      ? Promise.resolve(params.approvedSnapshot)
      : getOperatingHours(params.restaurantId, params.client),
    syncGoogleBusinessProfileBusinessInformationForClient({
      restaurantId: params.restaurantId,
      client: params.client,
    }),
    findExternalProfile(params.restaurantId, params.client),
  ]);

  const direction = resolveRequestedDirection({
    requestedDirection: params.direction,
    coreUpdatedAt: snapshot.updatedAt,
    providerUpdatedAt: getProviderReferenceUpdatedAt(existingExternalProfile),
  });

  if (direction === 'pull_from_gbp') {
    const payload = buildPullOperatingHoursPayload({
      currentSnapshot: snapshot,
      businessInfo: refreshedState.businessInfo,
      selection: params.selection,
    });
    return updateOperatingHours(params.restaurantId, payload, params.client);
  }

  const { externalProfile, accessToken, locationResourceName, location } =
    await getLinkedExternalProfileWithLocation(params.restaurantId, params.client);
  assertGooglePushEnabled(externalProfile);
  const patch = buildPushOperatingHoursLocationPatch({
    snapshot,
    location,
    selection: params.selection,
  });

  await patchGoogleBusinessProfileLocation(
    accessToken,
    locationResourceName,
    patch.payload,
    patch.updateMask,
    { validateOnly: true },
  );
  await patchGoogleBusinessProfileLocation(
    accessToken,
    locationResourceName,
    patch.payload,
    patch.updateMask,
  );

  const pushedAt = resolveNow();
  await markGooglePushSuccess(externalProfile.id, pushedAt, params.client);
  await syncGoogleBusinessProfileBusinessInformationForClient({
    restaurantId: params.restaurantId,
    client: params.client,
    runKind: 'core_sync',
  });

  return getOperatingHours(params.restaurantId, params.client);
}

export async function syncRestaurantServicePeriodsWithGoogleBusinessProfileForClient(params: {
  restaurantId: string;
  direction?: CoreSyncDirection;
  selection?: ServicePeriodsSyncSelection;
  approvedPeriods?: ServicePeriod[];
  client: DbClient;
  clock?: GoogleBusinessProfileCoreSyncRuntimeClock;
}) {
  const resolveNow = params.clock ?? nowIso;
  const [periods, refreshedState, existingExternalProfile] = await Promise.all([
    params.approvedPeriods
      ? Promise.resolve(params.approvedPeriods)
      : getServicePeriods(params.restaurantId, params.client),
    syncGoogleBusinessProfileBusinessInformationForClient({
      restaurantId: params.restaurantId,
      client: params.client,
    }),
    findExternalProfile(params.restaurantId, params.client),
  ]);

  const periodsUpdatedAt =
    periods
      .map((period) => period.updatedAt)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;

  const direction = resolveRequestedDirection({
    requestedDirection: params.direction,
    coreUpdatedAt: periodsUpdatedAt,
    providerUpdatedAt: getProviderReferenceUpdatedAt(existingExternalProfile),
  });

  if (direction === 'pull_from_gbp') {
    const payload = buildPullServicePeriodsPayload({
      currentPeriods: periods,
      businessInfo: refreshedState.businessInfo,
      selection: params.selection,
    });

    return updateServicePeriods(params.restaurantId, payload, params.client);
  }

  const { externalProfile, accessToken, locationResourceName, location } =
    await getLinkedExternalProfileWithLocation(params.restaurantId, params.client);
  assertGooglePushEnabled(externalProfile);

  assertGoogleServicePeriodsPushCapability(canPushServicePeriodsToGoogle(location));

  const patch = assertGoogleServicePeriodsPushPatch(
    buildPushServicePeriodsLocationPatch({
      periods,
      location,
      selection: params.selection,
    }),
  );

  await patchGoogleBusinessProfileLocation(
    accessToken,
    locationResourceName,
    patch.payload,
    patch.updateMask,
    { validateOnly: true },
  );
  await patchGoogleBusinessProfileLocation(
    accessToken,
    locationResourceName,
    patch.payload,
    patch.updateMask,
  );

  const pushedAt = resolveNow();
  await markGooglePushSuccess(externalProfile.id, pushedAt, params.client);
  await syncGoogleBusinessProfileBusinessInformationForClient({
    restaurantId: params.restaurantId,
    client: params.client,
    runKind: 'core_sync',
  });

  return getServicePeriods(params.restaurantId, params.client);
}

export async function patchRestaurantGoogleBusinessProfileLocationFieldsForClient(params: {
  restaurantId: string;
  locationPatch?: Record<string, unknown>;
  updateMask?: string[];
  attributesPatch?: {
    attributes: Array<Record<string, unknown>>;
    attributeMask: string[];
  };
  client: DbClient;
  clock?: GoogleBusinessProfileCoreSyncRuntimeClock;
}) {
  const resolveNow = params.clock ?? nowIso;
  const { externalProfile, accessToken, locationResourceName } =
    await getLinkedExternalProfileWithLocation(params.restaurantId, params.client);
  assertGooglePushEnabled(externalProfile);

  const updateMask = [...new Set(params.updateMask ?? [])].filter(Boolean);
  if (params.locationPatch && updateMask.length > 0) {
    await patchGoogleBusinessProfileLocation(
      accessToken,
      locationResourceName,
      params.locationPatch,
      updateMask,
      { validateOnly: true },
    );
    await patchGoogleBusinessProfileLocation(
      accessToken,
      locationResourceName,
      params.locationPatch,
      updateMask,
    );
  }

  const attributeMask = [...new Set(params.attributesPatch?.attributeMask ?? [])].filter(Boolean);
  if (params.attributesPatch && attributeMask.length > 0) {
    await updateGoogleBusinessProfileLocationAttributes(
      accessToken,
      locationResourceName,
      { attributes: params.attributesPatch.attributes },
      attributeMask,
    );
  }

  const pushedAt = resolveNow();
  await markGooglePushSuccess(externalProfile.id, pushedAt, params.client);
  await syncGoogleBusinessProfileBusinessInformationForClient({
    restaurantId: params.restaurantId,
    client: params.client,
    runKind: 'core_sync',
  });

  return readGoogleBusinessProfileBusinessInfo(params.restaurantId, params.client);
}
