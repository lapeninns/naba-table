import { GoogleBusinessProfileError } from './errors';

import type { GoogleBusinessProfileBusinessInfo } from './business-info';
import type {
  GoogleBusinessProfileAvailableLocation,
  GoogleBusinessProfileLocationProfile,
} from './client';
import type {
  GoogleBusinessProfileConnectionState,
  LinkGoogleBusinessProfileLocationInput,
} from './serviceConnectionStateTypes';
import type { Database } from '@/types/supabase';

type ExternalProfileConnectionFields = Pick<
  Database['public']['Tables']['restaurant_external_profiles']['Row'],
  | 'connection_status'
  | 'push_enabled'
  | 'external_account_id'
  | 'external_account_name'
  | 'external_location_id'
  | 'external_location_name'
  | 'external_location_title'
  | 'external_place_id'
  | 'provider_timezone'
  | 'last_pull_at'
  | 'last_push_at'
  | 'last_error'
>;

type CredentialConnectionFields = Pick<
  Database['public']['Tables']['restaurant_external_profile_credentials']['Row'],
  'connected_google_email' | 'connected_google_name'
>;

type ExternalProfileLinkedLocationFields = Pick<
  Database['public']['Tables']['restaurant_external_profiles']['Row'],
  'external_location_id' | 'external_location_name' | 'external_resource_name'
>;

type ExternalProfileLinkedAccountFields = Pick<
  Database['public']['Tables']['restaurant_external_profiles']['Row'],
  'external_account_id' | 'external_account_name'
>;

export function normalizeGoogleBusinessProfileText(
  value: string | null | undefined,
): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function pickProviderTimezone(
  location: GoogleBusinessProfileLocationProfile,
): string | null {
  return (
    normalizeGoogleBusinessProfileText(location.timezone) ??
    normalizeGoogleBusinessProfileText(location.timeZone) ??
    normalizeGoogleBusinessProfileText(location.metadata?.timezone) ??
    normalizeGoogleBusinessProfileText(location.metadata?.timeZone)
  );
}

export function assertGooglePushEnabled(
  externalProfile: Pick<ExternalProfileConnectionFields, 'push_enabled'>,
): void {
  if (externalProfile.push_enabled) {
    return;
  }

  throw new GoogleBusinessProfileError(
    'Optional Nabatable -> Google sync is disabled for this linked Google Business Profile location. Enable GBP push before choosing Google sync.',
    { code: 'GBP_GOOGLE_PUSH_DISABLED', status: 409 },
  );
}

export function createGoogleBusinessProfileLocationNotLinkedError(): GoogleBusinessProfileError {
  return new GoogleBusinessProfileError(
    'Link a Google Business Profile location before syncing business information.',
    { code: 'GBP_LOCATION_NOT_LINKED', status: 409 },
  );
}

export function assertGoogleBusinessProfileLocationLinked(
  externalProfile: Pick<
    ExternalProfileLinkedLocationFields,
    'external_location_id' | 'external_resource_name'
  >,
): void {
  if (externalProfile.external_location_id || externalProfile.external_resource_name) {
    return;
  }

  throw createGoogleBusinessProfileLocationNotLinkedError();
}

export function resolveLinkedLocationResourceName(
  externalProfile: ExternalProfileLinkedLocationFields,
): string {
  assertGoogleBusinessProfileLocationLinked(externalProfile);
  return (
    externalProfile.external_resource_name ??
    externalProfile.external_location_name ??
    `locations/${externalProfile.external_location_id}`
  );
}

export function createGoogleBusinessProfileLocationNotFoundError(): GoogleBusinessProfileError {
  return new GoogleBusinessProfileError(
    'The selected Google Business Profile location is no longer available.',
    { code: 'GBP_LOCATION_NOT_FOUND', status: 404 },
  );
}

export function findSelectedGoogleBusinessProfileLocation(
  availableLocations: GoogleBusinessProfileAvailableLocation[],
  input: LinkGoogleBusinessProfileLocationInput,
): GoogleBusinessProfileAvailableLocation {
  const selected = availableLocations.find(
    (location) =>
      location.accountName === input.accountName &&
      location.accountId === input.accountId &&
      location.locationName === input.locationName &&
      location.locationId === input.locationId,
  );

  if (!selected) {
    throw createGoogleBusinessProfileLocationNotFoundError();
  }

  return selected;
}

export function createGoogleBusinessProfileAccountNotLinkedError(): GoogleBusinessProfileError {
  return new GoogleBusinessProfileError(
    'Link a Google Business Profile account before syncing food menus.',
    { code: 'GBP_ACCOUNT_NOT_LINKED', status: 409 },
  );
}

export function resolveGoogleBusinessProfileAccountNameOrId(
  externalProfile: ExternalProfileLinkedAccountFields,
): string {
  const accountNameOrId =
    normalizeGoogleBusinessProfileText(externalProfile.external_account_name) ??
    normalizeGoogleBusinessProfileText(externalProfile.external_account_id);
  if (!accountNameOrId) {
    throw createGoogleBusinessProfileAccountNotLinkedError();
  }
  return accountNameOrId;
}

export function resolveCanHaveFoodMenus(
  location: GoogleBusinessProfileLocationProfile,
): boolean | null {
  if (typeof location.metadata?.canHaveFoodMenus === 'boolean') {
    return location.metadata.canHaveFoodMenus;
  }

  if (typeof location.locationState?.canHaveFoodMenu === 'boolean') {
    return location.locationState.canHaveFoodMenu;
  }

  if (typeof location.locationState?.canHaveFoodMenus === 'boolean') {
    return location.locationState.canHaveFoodMenus;
  }

  return null;
}

export function assertGoogleFoodMenusEligible(
  location: GoogleBusinessProfileLocationProfile,
): boolean | null {
  const canHaveFoodMenus = resolveCanHaveFoodMenus(location);
  if (canHaveFoodMenus === false) {
    throw new GoogleBusinessProfileError(
      'The linked Google Business Profile location is not eligible for FoodMenus.',
      { code: 'GBP_FOOD_MENUS_NOT_ELIGIBLE', status: 409 },
    );
  }
  return canHaveFoodMenus;
}

export function buildConnectionState(params: {
  isConfigured: boolean;
  externalProfile: ExternalProfileConnectionFields | null;
  credential: CredentialConnectionFields | null;
  availableLocations: GoogleBusinessProfileAvailableLocation[];
  businessInfo: GoogleBusinessProfileBusinessInfo;
}): GoogleBusinessProfileConnectionState {
  return {
    isConfigured: params.isConfigured,
    provider: 'google_business_profile',
    status:
      (params.externalProfile
        ?.connection_status as GoogleBusinessProfileConnectionState['status']) ?? 'unlinked',
    pushEnabled: Boolean(params.externalProfile?.push_enabled),
    connectedGoogleEmail: params.credential?.connected_google_email ?? null,
    connectedGoogleName: params.credential?.connected_google_name ?? null,
    externalAccountId: params.externalProfile?.external_account_id ?? null,
    externalAccountName: params.externalProfile?.external_account_name ?? null,
    externalLocationId: params.externalProfile?.external_location_id ?? null,
    externalLocationName: params.externalProfile?.external_location_name ?? null,
    externalLocationTitle: params.externalProfile?.external_location_title ?? null,
    externalPlaceId: params.externalProfile?.external_place_id ?? null,
    providerTimezone: params.externalProfile?.provider_timezone ?? null,
    lastPullAt: params.externalProfile?.last_pull_at ?? null,
    lastPushAt: params.externalProfile?.last_push_at ?? null,
    lastError: params.externalProfile?.last_error ?? null,
    availableLocations: params.availableLocations,
    businessInfo: params.businessInfo,
  };
}
