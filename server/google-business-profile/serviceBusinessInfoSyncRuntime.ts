import { logger } from '@/lib/logger';

import { syncGoogleBusinessProfileCanonicalBusinessInfo } from './business-info';
import {
  getGoogleBusinessProfileLocationAttributes,
  getGoogleBusinessProfileLocationProfile,
  parseGoogleLocationId,
} from './client';
import { getUsableGoogleBusinessProfileAccessToken } from './serviceAccessRuntime';
import {
  buildBusinessInfoSyncExternalProfileUpdate,
  buildBusinessInfoSyncFailureExternalProfileUpdate,
  buildBusinessInfoSyncFailureRun,
  buildBusinessInfoSyncSuccessRun,
  formatGoogleBusinessProfileAttributeWarning,
  type GoogleBusinessProfileBusinessInfoSyncRunKind,
} from './serviceBusinessInfoSyncPayloads';
import {
  pickProviderTimezone,
  resolveLinkedLocationResourceName,
} from './serviceConnectionContext';
import { getGoogleBusinessProfileConnectionStateForClient } from './serviceConnectionStateRuntime';
import {
  ensureExternalProfile,
  recordSyncRun,
  updateExternalProfile,
  type DbClient,
} from './serviceRepository';

import type { GoogleBusinessProfileAttributesResponse } from './client';
import type { GoogleBusinessProfileConnectionState } from './serviceConnectionStateTypes';

const gbpBusinessInfoSyncLogger = logger.child({ module: 'gbp' });

export type GoogleBusinessProfileBusinessInfoSyncRuntimeClock = () => string;

const nowIso: GoogleBusinessProfileBusinessInfoSyncRuntimeClock = () => new Date().toISOString();

export async function syncGoogleBusinessProfileBusinessInformationForClient(params: {
  restaurantId: string;
  client: DbClient;
  runKind?: GoogleBusinessProfileBusinessInfoSyncRunKind;
  clock?: GoogleBusinessProfileBusinessInfoSyncRuntimeClock;
}): Promise<GoogleBusinessProfileConnectionState> {
  const resolveNow = params.clock ?? nowIso;
  const externalProfile = await ensureExternalProfile(params.restaurantId, params.client);
  const startedAt = resolveNow();

  const { accessToken } = await getUsableGoogleBusinessProfileAccessToken(
    externalProfile,
    params.client,
  );
  const locationResourceName = resolveLinkedLocationResourceName(externalProfile);

  let attributes: GoogleBusinessProfileAttributesResponse | null = null;
  let attributeWarning: string | null = null;

  try {
    const location = await getGoogleBusinessProfileLocationProfile(
      accessToken,
      locationResourceName,
    );

    try {
      attributes = await getGoogleBusinessProfileLocationAttributes(
        accessToken,
        externalProfile.external_location_id ?? parseGoogleLocationId(location.name),
      );
    } catch (error) {
      attributeWarning = formatGoogleBusinessProfileAttributeWarning(error);
      gbpBusinessInfoSyncLogger.warn('attribute sync skipped', {
        restaurantId: params.restaurantId,
        externalProfileId: externalProfile.id,
        error,
      });
    }

    const syncedAt = resolveNow();
    await syncGoogleBusinessProfileCanonicalBusinessInfo({
      restaurantId: params.restaurantId,
      externalProfile,
      location,
      attributes,
      client: params.client,
      syncedAt,
      syncAttributes: attributes !== null,
    });

    await updateExternalProfile(
      externalProfile.id,
      buildBusinessInfoSyncExternalProfileUpdate({
        externalProfile,
        location,
        parsedLocationId: parseGoogleLocationId(location.name),
        providerTimezone: pickProviderTimezone(location),
        syncedAt,
        attributeWarning,
      }),
      params.client,
    );

    await recordSyncRun(
      buildBusinessInfoSyncSuccessRun({
        externalProfileId: externalProfile.id,
        restaurantId: params.restaurantId,
        runKind: params.runKind,
        startedAt,
        finishedAt: syncedAt,
        attributeWarning,
        locationName: location.name,
        attributesSynced: attributes !== null,
      }),
      params.client,
    );

    return getGoogleBusinessProfileConnectionStateForClient(params.restaurantId, params.client);
  } catch (error) {
    await updateExternalProfile(
      externalProfile.id,
      buildBusinessInfoSyncFailureExternalProfileUpdate(error),
      params.client,
    );

    await recordSyncRun(
      buildBusinessInfoSyncFailureRun({
        externalProfileId: externalProfile.id,
        restaurantId: params.restaurantId,
        runKind: params.runKind,
        startedAt,
        finishedAt: resolveNow(),
        error,
      }),
      params.client,
    );

    throw error;
  }
}
