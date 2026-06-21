import { isGoogleBusinessProfileError } from './errors';

import type { GoogleBusinessProfileLocationProfile } from './client';
import type { Database } from '@/types/supabase';

type ExternalProfileRow = Database['public']['Tables']['restaurant_external_profiles']['Row'];
type ExternalProfileUpdate = Database['public']['Tables']['restaurant_external_profiles']['Update'];
type SyncRunInsert =
  Database['public']['Tables']['restaurant_external_profile_sync_runs']['Insert'];

export type GoogleBusinessProfileBusinessInfoSyncRunKind =
  | 'manual'
  | 'location_selection'
  | 'core_sync';

export function formatGoogleBusinessProfileAttributeWarning(error: unknown): string {
  return error instanceof Error
    ? `Google attributes could not be refreshed: ${error.message}`
    : 'Google attributes could not be refreshed.';
}

export function buildBusinessInfoSyncExternalProfileUpdate(params: {
  externalProfile: Pick<
    ExternalProfileRow,
    'external_location_id' | 'external_location_title' | 'external_place_id' | 'provider_timezone'
  >;
  location: GoogleBusinessProfileLocationProfile;
  parsedLocationId: string;
  providerTimezone: string | null;
  syncedAt: string;
  attributeWarning: string | null;
}): ExternalProfileUpdate {
  return {
    external_location_id: params.externalProfile.external_location_id ?? params.parsedLocationId,
    external_location_name: params.location.name,
    external_location_title:
      params.location.title?.trim() || params.externalProfile.external_location_title,
    external_place_id:
      params.location.metadata?.placeId?.trim() || params.externalProfile.external_place_id,
    external_resource_name: params.location.name,
    provider_timezone: params.providerTimezone ?? params.externalProfile.provider_timezone,
    connection_status: 'linked',
    last_pull_at: params.syncedAt,
    last_error: params.attributeWarning,
  };
}

export function buildBusinessInfoSyncSuccessRun(params: {
  externalProfileId: string;
  restaurantId: string;
  runKind?: GoogleBusinessProfileBusinessInfoSyncRunKind;
  startedAt: string;
  finishedAt: string;
  attributeWarning: string | null;
  locationName: string;
  attributesSynced: boolean;
}): Omit<SyncRunInsert, 'id' | 'created_at' | 'updated_at'> {
  return {
    external_profile_id: params.externalProfileId,
    restaurant_id: params.restaurantId,
    provider: 'google_business_profile',
    run_kind: params.runKind ?? 'manual',
    status: 'success',
    started_at: params.startedAt,
    finished_at: params.finishedAt,
    error_code: null,
    error_message: params.attributeWarning,
    metadata: {
      locationName: params.locationName,
      attributeSyncSkipped: !params.attributesSynced,
    },
  };
}

export function getBusinessInfoSyncFailureMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Google Business Profile sync failed unexpectedly.';
}

export function getBusinessInfoSyncFailureCode(error: unknown): string | null {
  return isGoogleBusinessProfileError(error) ? error.code : null;
}

export function shouldMarkBusinessInfoSyncReauthRequired(error: unknown): boolean {
  return (
    isGoogleBusinessProfileError(error) &&
    (error.code === 'GBP_REAUTH_REQUIRED' || error.code === 'GBP_FORBIDDEN')
  );
}

export function buildBusinessInfoSyncFailureExternalProfileUpdate(
  error: unknown,
): ExternalProfileUpdate {
  return {
    connection_status: shouldMarkBusinessInfoSyncReauthRequired(error)
      ? 'reauth_required'
      : 'sync_error',
    last_error: getBusinessInfoSyncFailureMessage(error),
  };
}

export function buildBusinessInfoSyncFailureRun(params: {
  externalProfileId: string;
  restaurantId: string;
  runKind?: GoogleBusinessProfileBusinessInfoSyncRunKind;
  startedAt: string;
  finishedAt: string;
  error: unknown;
}): Omit<SyncRunInsert, 'id' | 'created_at' | 'updated_at'> {
  return {
    external_profile_id: params.externalProfileId,
    restaurant_id: params.restaurantId,
    provider: 'google_business_profile',
    run_kind: params.runKind ?? 'manual',
    status: 'failed',
    started_at: params.startedAt,
    finished_at: params.finishedAt,
    error_code: getBusinessInfoSyncFailureCode(params.error),
    error_message: getBusinessInfoSyncFailureMessage(params.error),
    metadata: null,
  };
}
