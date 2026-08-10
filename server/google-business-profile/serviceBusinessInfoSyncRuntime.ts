import { logger } from '@/lib/logger';

import { syncGoogleBusinessProfileCanonicalBusinessInfo } from './business-info';
import { toJson } from './businessInfoNormalization';
import {
  getGoogleBusinessProfileLocationAttributes,
  getGoogleBusinessProfileLocationProfile,
  parseGoogleLocationId,
} from './client';
import { requireGoogleBusinessProfileContentFence } from './contentSnapshotPersistence';
import {
  getUsableGoogleBusinessProfileAccessToken,
  isGoogleProviderAccessFailure,
  persistGoogleProviderAccessFailure,
} from './serviceAccessRuntime';
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
import type { Json } from '@/types/supabase';

const gbpBusinessInfoSyncLogger = logger.child({ module: 'gbp' });

export type GoogleBusinessProfileBusinessInfoSyncRuntimeClock = () => string;

const nowIso: GoogleBusinessProfileBusinessInfoSyncRuntimeClock = () => new Date().toISOString();

export interface GoogleBusinessProfileObservation {
  readonly fence: {
    readonly restaurantId: string;
    readonly externalProfileRowId: string;
    readonly accountId: string;
    readonly profileId: string;
    readonly locationId: string;
    readonly connectionGeneration: number;
    readonly consentEpoch: number;
  };
  readonly observedAt: string;
  readonly rawPayload: Json;
}

export interface GoogleBusinessProfileSyncWithObservationResult {
  readonly connectionState: GoogleBusinessProfileConnectionState;
  readonly observation: GoogleBusinessProfileObservation;
}

export async function syncGoogleBusinessProfileBusinessInformationWithObservationForClient(params: {
  restaurantId: string;
  client: DbClient;
  runKind?: GoogleBusinessProfileBusinessInfoSyncRunKind;
  clock?: GoogleBusinessProfileBusinessInfoSyncRuntimeClock;
}): Promise<GoogleBusinessProfileSyncWithObservationResult> {
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
      if (isGoogleProviderAccessFailure(error)) throw error;
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

    const connectionState = await getGoogleBusinessProfileConnectionStateForClient(
      params.restaurantId,
      params.client,
    );
    const contentFence = requireGoogleBusinessProfileContentFence(
      params.restaurantId,
      externalProfile,
    );
    const rawLocation = { ...location };
    delete rawLocation.__nabatableOptionalFetchStatus;
    delete rawLocation.__nabatableRawResponses;
    return {
      connectionState,
      observation: {
        fence: {
          restaurantId: contentFence.restaurantId,
          externalProfileRowId: contentFence.externalProfileRowId,
          accountId: contentFence.externalAccountId,
          profileId: contentFence.externalProfileId,
          locationId: contentFence.externalLocationId,
          connectionGeneration: contentFence.connectionGeneration,
          consentEpoch: contentFence.consentEpoch,
        },
        observedAt: syncedAt,
        rawPayload: toJson({
          locationResponses: location.__nabatableRawResponses ?? [rawLocation],
          attributesResponse: attributes,
        }),
      },
    };
  } catch (error) {
    if (await persistGoogleProviderAccessFailure(error, externalProfile, params.client)) {
      throw error;
    }
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

export async function syncGoogleBusinessProfileBusinessInformationForClient(params: {
  restaurantId: string;
  client: DbClient;
  runKind?: GoogleBusinessProfileBusinessInfoSyncRunKind;
  clock?: GoogleBusinessProfileBusinessInfoSyncRuntimeClock;
}): Promise<GoogleBusinessProfileConnectionState> {
  const result = await syncGoogleBusinessProfileBusinessInformationWithObservationForClient(params);
  return result.connectionState;
}
