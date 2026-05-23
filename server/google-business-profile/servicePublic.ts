import { getServiceSupabaseClient } from '@/server/supabase';

import { type GoogleBusinessProfileAvailableLocation } from './client';
import {
  type CoreSyncDirection,
  type OperatingHoursSyncSelection,
  type ServicePeriodsSyncSelection,
} from './core-sync';
import {
  completeGoogleBusinessProfileAuthorizationForClient,
  createGoogleBusinessProfileAuthorizationForClient,
} from './serviceAuthorizationRuntime';
import { getGoogleBusinessProfileBusinessDetailsStatusForClient } from './serviceBusinessDetailsStatusRuntime';
import { syncGoogleBusinessProfileBusinessInformationForClient } from './serviceBusinessInfoSyncRuntime';
import {
  disconnectGoogleBusinessProfileConnectionForClient,
  getGoogleBusinessProfileAvailableLocationsForClient,
  linkGoogleBusinessProfileLocationForClient,
} from './serviceConnectionLifecycleRuntime';
import {
  getGoogleBusinessProfileConnectionStateForClient,
  type GoogleBusinessProfileConnectionStateOptions,
} from './serviceConnectionStateRuntime';
import {
  patchRestaurantGoogleBusinessProfileLocationFieldsForClient,
  syncRestaurantOperatingHoursWithGoogleBusinessProfileForClient,
  syncRestaurantProfileWithGoogleBusinessProfileForClient,
  syncRestaurantServicePeriodsWithGoogleBusinessProfileForClient,
} from './serviceCoreSyncRuntime';
import {
  getGoogleBusinessProfileFoodMenusContext as getGoogleBusinessProfileFoodMenusContextWithClient,
  type GoogleBusinessProfileFoodMenusContext,
} from './serviceFoodMenusContext';
import { type DbClient } from './serviceRepository';

import type { GoogleBusinessProfileBusinessDetailsStatus } from './serviceBusinessDetailsStatusTypes';
import type {
  GoogleBusinessProfileConnectionState,
  LinkGoogleBusinessProfileLocationInput,
} from './serviceConnectionStateTypes';

function getClient(client?: DbClient): DbClient {
  return client ?? getServiceSupabaseClient();
}

export async function getGoogleBusinessProfileBusinessDetailsStatus(
  restaurantId: string,
  client?: DbClient,
): Promise<GoogleBusinessProfileBusinessDetailsStatus> {
  return getGoogleBusinessProfileBusinessDetailsStatusForClient(restaurantId, getClient(client));
}

export async function getGoogleBusinessProfileFoodMenusContext(params: {
  restaurantId: string;
  client?: DbClient;
  requirePushEnabled?: boolean;
}): Promise<GoogleBusinessProfileFoodMenusContext> {
  return getGoogleBusinessProfileFoodMenusContextWithClient({
    restaurantId: params.restaurantId,
    client: getClient(params.client),
    requirePushEnabled: params.requirePushEnabled,
  });
}

export async function createGoogleBusinessProfileAuthorization(params: {
  restaurantId: string;
  requestedByUserId: string;
  returnPath?: string;
  client?: DbClient;
}): Promise<{ authorizationUrl: string; stateToken: string }> {
  return createGoogleBusinessProfileAuthorizationForClient({
    restaurantId: params.restaurantId,
    requestedByUserId: params.requestedByUserId,
    returnPath: params.returnPath,
    client: getClient(params.client),
  });
}

export async function createGoogleBusinessProfileAuthorizationUrl(params: {
  restaurantId: string;
  requestedByUserId: string;
  returnPath?: string;
  client?: DbClient;
}): Promise<string> {
  const result = await createGoogleBusinessProfileAuthorization(params);
  return result.authorizationUrl;
}

export async function completeGoogleBusinessProfileAuthorization(params: {
  stateToken: string;
  code: string;
  requestedByUserId: string;
  expectedRestaurantId?: string;
  client?: DbClient;
}): Promise<{ restaurantId: string; returnPath: string }> {
  return completeGoogleBusinessProfileAuthorizationForClient({
    stateToken: params.stateToken,
    code: params.code,
    requestedByUserId: params.requestedByUserId,
    expectedRestaurantId: params.expectedRestaurantId,
    client: getClient(params.client),
  });
}

export async function getGoogleBusinessProfileConnectionState(
  restaurantId: string,
  client?: DbClient,
  options: GoogleBusinessProfileConnectionStateOptions = {},
): Promise<GoogleBusinessProfileConnectionState> {
  return getGoogleBusinessProfileConnectionStateForClient(restaurantId, getClient(client), options);
}

export async function getGoogleBusinessProfileAvailableLocations(
  restaurantId: string,
  client?: DbClient,
  options: { forceRefresh?: boolean } = {},
): Promise<GoogleBusinessProfileAvailableLocation[]> {
  return getGoogleBusinessProfileAvailableLocationsForClient(
    restaurantId,
    getClient(client),
    options,
  );
}

export async function syncGoogleBusinessProfileBusinessInformation(
  restaurantId: string,
  client?: DbClient,
  options: { runKind?: 'manual' | 'location_selection' | 'core_sync' } = {},
): Promise<GoogleBusinessProfileConnectionState> {
  return syncGoogleBusinessProfileBusinessInformationForClient({
    restaurantId,
    client: getClient(client),
    runKind: options.runKind,
  });
}

export async function syncRestaurantProfileWithGoogleBusinessProfile(params: {
  restaurantId: string;
  direction?: CoreSyncDirection;
  fields?: Array<'name' | 'contactPhone' | 'address' | 'googleMapUrl' | 'googleReviewUrl'>;
  client?: DbClient;
}) {
  return syncRestaurantProfileWithGoogleBusinessProfileForClient({
    restaurantId: params.restaurantId,
    direction: params.direction,
    fields: params.fields,
    client: getClient(params.client),
  });
}

export async function syncRestaurantOperatingHoursWithGoogleBusinessProfile(params: {
  restaurantId: string;
  direction?: CoreSyncDirection;
  selection?: OperatingHoursSyncSelection;
  client?: DbClient;
}) {
  return syncRestaurantOperatingHoursWithGoogleBusinessProfileForClient({
    restaurantId: params.restaurantId,
    direction: params.direction,
    selection: params.selection,
    client: getClient(params.client),
  });
}

export async function syncRestaurantServicePeriodsWithGoogleBusinessProfile(params: {
  restaurantId: string;
  direction?: CoreSyncDirection;
  selection?: ServicePeriodsSyncSelection;
  client?: DbClient;
}) {
  return syncRestaurantServicePeriodsWithGoogleBusinessProfileForClient({
    restaurantId: params.restaurantId,
    direction: params.direction,
    selection: params.selection,
    client: getClient(params.client),
  });
}

export async function patchRestaurantGoogleBusinessProfileLocationFields(params: {
  restaurantId: string;
  locationPatch?: Record<string, unknown>;
  updateMask?: string[];
  attributesPatch?: {
    attributes: Array<Record<string, unknown>>;
    attributeMask: string[];
  };
  client?: DbClient;
}) {
  return patchRestaurantGoogleBusinessProfileLocationFieldsForClient({
    restaurantId: params.restaurantId,
    locationPatch: params.locationPatch,
    updateMask: params.updateMask,
    attributesPatch: params.attributesPatch,
    client: getClient(params.client),
  });
}

export async function linkGoogleBusinessProfileLocation(
  restaurantId: string,
  input: LinkGoogleBusinessProfileLocationInput,
  client?: DbClient,
): Promise<GoogleBusinessProfileConnectionState> {
  return linkGoogleBusinessProfileLocationForClient(restaurantId, input, getClient(client));
}

export async function disconnectGoogleBusinessProfileConnection(
  restaurantId: string,
  client?: DbClient,
): Promise<GoogleBusinessProfileConnectionState> {
  return disconnectGoogleBusinessProfileConnectionForClient(restaurantId, getClient(client));
}
