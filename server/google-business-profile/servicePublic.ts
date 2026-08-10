import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { getServerComponentSupabaseClient, getServiceSupabaseClient } from '@/server/supabase';

import { type GoogleBusinessProfileAvailableLocation } from './client';
import {
  type CoreSyncDirection,
  type OperatingHoursSyncSelection,
  type ServicePeriodsSyncSelection,
} from './core-sync';
import { GoogleBusinessProfileError } from './errors';
import {
  completeGoogleBusinessProfileAuthorizationForClient,
  createGoogleBusinessProfileAuthorizationForClient,
} from './serviceAuthorizationRuntime';
import { getGoogleBusinessProfileBusinessDetailsStatusForClient } from './serviceBusinessDetailsStatusRuntime';
import {
  syncGoogleBusinessProfileBusinessInformationForClient,
  syncGoogleBusinessProfileBusinessInformationWithObservationForClient,
  type GoogleBusinessProfileSyncWithObservationResult,
} from './serviceBusinessInfoSyncRuntime';
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
import {
  setGoogleBusinessProfileNotificationParticipationForClient,
  type GoogleBusinessProfileNotificationParticipationResult,
} from './serviceNotificationParticipationRuntime';
import { findExternalProfile, hasNotificationLink, type DbClient } from './serviceRepository';

import type { GoogleBusinessProfileBusinessDetailsStatus } from './serviceBusinessDetailsStatusTypes';
import type {
  GoogleBusinessProfileConnectionState,
  LinkGoogleBusinessProfileLocationInput,
} from './serviceConnectionStateTypes';
import type { RestaurantDetails } from '@/server/restaurants/details';
import type { OperatingHoursSnapshot } from '@/server/restaurants/operatingHours';
import type { ServicePeriod } from '@/server/restaurants/servicePeriods';

function getClient(client?: DbClient): DbClient {
  return client ?? getServiceSupabaseClient();
}

const gbpLifecycleLogger = logger.child({ module: 'gbp' });

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

export async function syncGoogleBusinessProfileBusinessInformationWithObservation(
  restaurantId: string,
  client?: DbClient,
  options: { runKind?: 'manual' | 'location_selection' | 'core_sync' } = {},
): Promise<GoogleBusinessProfileSyncWithObservationResult> {
  return syncGoogleBusinessProfileBusinessInformationWithObservationForClient({
    restaurantId,
    client: getClient(client),
    runKind: options.runKind,
  });
}

export async function syncRestaurantProfileWithGoogleBusinessProfile(params: {
  restaurantId: string;
  direction?: CoreSyncDirection;
  fields?: Array<'name' | 'contactPhone' | 'address' | 'googleMapUrl' | 'googleReviewUrl'>;
  approvedProfile?: RestaurantDetails;
  client?: DbClient;
}) {
  return syncRestaurantProfileWithGoogleBusinessProfileForClient({
    restaurantId: params.restaurantId,
    direction: params.direction,
    fields: params.fields,
    approvedProfile: params.approvedProfile,
    client: getClient(params.client),
  });
}

export async function syncRestaurantOperatingHoursWithGoogleBusinessProfile(params: {
  restaurantId: string;
  direction?: CoreSyncDirection;
  selection?: OperatingHoursSyncSelection;
  approvedSnapshot?: OperatingHoursSnapshot;
  client?: DbClient;
}) {
  return syncRestaurantOperatingHoursWithGoogleBusinessProfileForClient({
    restaurantId: params.restaurantId,
    direction: params.direction,
    selection: params.selection,
    approvedSnapshot: params.approvedSnapshot,
    client: getClient(params.client),
  });
}

export async function syncRestaurantServicePeriodsWithGoogleBusinessProfile(params: {
  restaurantId: string;
  direction?: CoreSyncDirection;
  selection?: ServicePeriodsSyncSelection;
  approvedPeriods?: ServicePeriod[];
  client?: DbClient;
}) {
  return syncRestaurantServicePeriodsWithGoogleBusinessProfileForClient({
    restaurantId: params.restaurantId,
    direction: params.direction,
    selection: params.selection,
    approvedPeriods: params.approvedPeriods,
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
  const actorClient = client ?? (await getServerComponentSupabaseClient());
  const { data, error } = await actorClient.auth.getUser();
  if (error || !data.user) {
    throw new GoogleBusinessProfileError('Disconnect requires an authenticated operator.', {
      code: 'GBP_DISCONNECT_CONTEXT_REQUIRED',
      status: 401,
    });
  }

  const dbClient = getClient(client);
  const profile = await findExternalProfile(restaurantId, dbClient);
  const managedTopic = env.dualSync.pubsubIngress.topic;
  if (profile && managedTopic) {
    await setGoogleBusinessProfileNotificationParticipationForClient({
      restaurantId,
      enabled: false,
      managedTopic,
      client: dbClient,
    });
  } else if (profile && (await hasNotificationLink(profile.id, dbClient))) {
    throw new GoogleBusinessProfileError(
      'Google notification teardown configuration is unavailable.',
      { code: 'GBP_NOTIFICATION_CONFIGURATION_REQUIRED', status: 409 },
    );
  }
  return disconnectGoogleBusinessProfileConnectionForClient(restaurantId, dbClient, {
    actorUserId: data.user.id,
    teardownNotifications: async () => {
      const profile = await findExternalProfile(restaurantId, dbClient);
      if (profile && (await hasNotificationLink(profile.id, dbClient))) {
        throw new GoogleBusinessProfileError(
          'Google notification teardown must complete before disconnect.',
          { code: 'GBP_NOTIFICATION_TEARDOWN_REQUIRED', status: 409 },
        );
      }
    },
    onRevocationUncertain: async (context) => {
      gbpLifecycleLogger.warn('provider token revocation requires retry', context);
    },
  });
}

export async function setGoogleBusinessProfileNotificationParticipation(
  restaurantId: string,
  enabled: boolean,
  client?: DbClient,
): Promise<GoogleBusinessProfileNotificationParticipationResult> {
  const actorClient = client ?? (await getServerComponentSupabaseClient());
  const { data, error } = await actorClient.auth.getUser();
  if (error || !data.user) {
    throw new GoogleBusinessProfileError(
      'Notification participation requires an authenticated operator.',
      { code: 'GBP_NOTIFICATION_CONTEXT_REQUIRED', status: 401 },
    );
  }
  const pubsub = env.dualSync.pubsubIngress;
  if (!pubsub.enabled || !pubsub.topic) {
    throw new GoogleBusinessProfileError('Google notification participation is not configured.', {
      code: 'GBP_NOTIFICATION_CONFIGURATION_REQUIRED',
      status: 409,
    });
  }
  return setGoogleBusinessProfileNotificationParticipationForClient({
    restaurantId,
    enabled,
    managedTopic: pubsub.topic,
    client: getClient(client),
  });
}
