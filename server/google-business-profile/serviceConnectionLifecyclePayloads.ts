import type { GoogleBusinessProfileAvailableLocation } from './client';
import type { Database } from '@/types/supabase';

type ExternalProfileUpdate = Database['public']['Tables']['restaurant_external_profiles']['Update'];

type ExistingLocationLink = {
  external_location_id: string | null;
};

export function buildAuthorizationPendingExternalProfileUpdate(): ExternalProfileUpdate {
  return {
    connection_status: 'pending_auth',
    last_error: null,
  };
}

export function buildAuthorizationCompletedExternalProfileUpdate(
  externalProfile: ExistingLocationLink,
): ExternalProfileUpdate {
  return {
    connection_status: externalProfile.external_location_id ? 'linked' : 'authorized',
    last_error: null,
  };
}

export function buildReauthRequiredExternalProfileUpdate(message: string): ExternalProfileUpdate {
  return {
    connection_status: 'reauth_required',
    last_error: message,
  };
}

export function buildAuthorizationFailureExternalProfileUpdate(
  message: string,
): ExternalProfileUpdate {
  return {
    connection_status: 'sync_error',
    last_error: message,
  };
}

export function buildGooglePushSuccessExternalProfileUpdate(
  pushedAt: string,
): ExternalProfileUpdate {
  return {
    last_push_at: pushedAt,
    last_error: null,
    connection_status: 'linked',
  };
}

export function buildLinkedLocationExternalProfileUpdate(
  selected: GoogleBusinessProfileAvailableLocation,
): ExternalProfileUpdate {
  return {
    external_account_id: selected.accountId,
    external_account_name: selected.accountName,
    external_location_id: selected.locationId,
    external_location_name: selected.locationName,
    external_location_title: selected.title,
    external_place_id: selected.placeId,
    external_resource_name: selected.locationName,
    connection_status: 'linked',
    last_error: null,
  };
}

export function buildDisconnectedExternalProfileUpdate(): ExternalProfileUpdate {
  return {
    external_account_id: null,
    external_account_name: null,
    external_location_id: null,
    external_location_name: null,
    external_location_title: null,
    external_place_id: null,
    external_resource_name: null,
    connection_status: 'unlinked',
    last_error: null,
    last_pull_at: null,
    last_push_at: null,
  };
}
