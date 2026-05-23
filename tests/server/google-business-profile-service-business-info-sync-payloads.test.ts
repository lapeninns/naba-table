import { describe, expect, it } from 'vitest';

import { GoogleBusinessProfileError } from '@/server/google-business-profile/errors';
import {
  buildBusinessInfoSyncExternalProfileUpdate,
  buildBusinessInfoSyncFailureExternalProfileUpdate,
  buildBusinessInfoSyncFailureRun,
  buildBusinessInfoSyncSuccessRun,
  formatGoogleBusinessProfileAttributeWarning,
  getBusinessInfoSyncFailureCode,
  getBusinessInfoSyncFailureMessage,
  shouldMarkBusinessInfoSyncReauthRequired,
} from '@/server/google-business-profile/serviceBusinessInfoSyncPayloads';

import type { GoogleBusinessProfileLocationProfile } from '@/server/google-business-profile/client';

function location(
  overrides: Partial<GoogleBusinessProfileLocationProfile> = {},
): GoogleBusinessProfileLocationProfile {
  return {
    name: 'locations/456',
    title: ' Google Title ',
    metadata: { placeId: ' place-456 ' },
    ...overrides,
  } as GoogleBusinessProfileLocationProfile;
}

describe('google business profile service business-info sync payloads', () => {
  it('formats attribute refresh warnings without leaking non-error values', () => {
    expect(formatGoogleBusinessProfileAttributeWarning(new Error('quota exceeded'))).toBe(
      'Google attributes could not be refreshed: quota exceeded',
    );
    expect(formatGoogleBusinessProfileAttributeWarning('quota exceeded')).toBe(
      'Google attributes could not be refreshed.',
    );
  });

  it('builds external profile updates with Google values and local fallbacks', () => {
    expect(
      buildBusinessInfoSyncExternalProfileUpdate({
        externalProfile: {
          external_location_id: null,
          external_location_title: 'Existing Title',
          external_place_id: 'existing-place',
          provider_timezone: 'Europe/London',
        },
        location: location({
          title: ' Google Title ',
          metadata: { placeId: ' place-456 ' },
        }),
        parsedLocationId: '456',
        providerTimezone: 'Europe/Paris',
        syncedAt: '2026-05-21T10:00:00.000Z',
        attributeWarning: 'Google attributes could not be refreshed.',
      }),
    ).toEqual({
      external_location_id: '456',
      external_location_name: 'locations/456',
      external_location_title: 'Google Title',
      external_place_id: 'place-456',
      external_resource_name: 'locations/456',
      provider_timezone: 'Europe/Paris',
      connection_status: 'linked',
      last_pull_at: '2026-05-21T10:00:00.000Z',
      last_error: 'Google attributes could not be refreshed.',
    });

    expect(
      buildBusinessInfoSyncExternalProfileUpdate({
        externalProfile: {
          external_location_id: 'existing-location',
          external_location_title: 'Existing Title',
          external_place_id: 'existing-place',
          provider_timezone: 'Europe/London',
        },
        location: location({
          title: ' ',
          metadata: { placeId: ' ' },
        }),
        parsedLocationId: '456',
        providerTimezone: null,
        syncedAt: '2026-05-21T10:00:00.000Z',
        attributeWarning: null,
      }),
    ).toMatchObject({
      external_location_id: 'existing-location',
      external_location_title: 'Existing Title',
      external_place_id: 'existing-place',
      provider_timezone: 'Europe/London',
      last_error: null,
    });
  });

  it('builds success sync-run audit payloads with attribute skip metadata', () => {
    expect(
      buildBusinessInfoSyncSuccessRun({
        externalProfileId: 'profile-1',
        restaurantId: 'rest-1',
        startedAt: '2026-05-21T09:59:00.000Z',
        finishedAt: '2026-05-21T10:00:00.000Z',
        attributeWarning: null,
        locationName: 'locations/456',
        attributesSynced: true,
      }),
    ).toEqual({
      external_profile_id: 'profile-1',
      restaurant_id: 'rest-1',
      provider: 'google_business_profile',
      run_kind: 'manual',
      status: 'success',
      started_at: '2026-05-21T09:59:00.000Z',
      finished_at: '2026-05-21T10:00:00.000Z',
      error_code: null,
      error_message: null,
      metadata: {
        locationName: 'locations/456',
        attributeSyncSkipped: false,
      },
    });

    expect(
      buildBusinessInfoSyncSuccessRun({
        externalProfileId: 'profile-1',
        restaurantId: 'rest-1',
        runKind: 'core_sync',
        startedAt: '2026-05-21T09:59:00.000Z',
        finishedAt: '2026-05-21T10:00:00.000Z',
        attributeWarning: 'Google attributes could not be refreshed.',
        locationName: 'locations/456',
        attributesSynced: false,
      }),
    ).toMatchObject({
      run_kind: 'core_sync',
      error_message: 'Google attributes could not be refreshed.',
      metadata: {
        locationName: 'locations/456',
        attributeSyncSkipped: true,
      },
    });
  });

  it('classifies reauth and forbidden errors as reauth-required failures', () => {
    const reauthError = new GoogleBusinessProfileError('Reconnect Google.', {
      code: 'GBP_REAUTH_REQUIRED',
      status: 409,
    });
    const forbiddenError = new GoogleBusinessProfileError('Forbidden.', {
      code: 'GBP_FORBIDDEN',
      status: 403,
    });

    expect(shouldMarkBusinessInfoSyncReauthRequired(reauthError)).toBe(true);
    expect(shouldMarkBusinessInfoSyncReauthRequired(forbiddenError)).toBe(true);
    expect(buildBusinessInfoSyncFailureExternalProfileUpdate(reauthError)).toEqual({
      connection_status: 'reauth_required',
      last_error: 'Reconnect Google.',
    });
  });

  it('classifies generic errors as sync failures', () => {
    const genericError = new Error('Google timed out.');

    expect(getBusinessInfoSyncFailureMessage(genericError)).toBe('Google timed out.');
    expect(getBusinessInfoSyncFailureCode(genericError)).toBeNull();
    expect(shouldMarkBusinessInfoSyncReauthRequired(genericError)).toBe(false);
    expect(buildBusinessInfoSyncFailureExternalProfileUpdate(genericError)).toEqual({
      connection_status: 'sync_error',
      last_error: 'Google timed out.',
    });
    expect(buildBusinessInfoSyncFailureExternalProfileUpdate('unknown')).toEqual({
      connection_status: 'sync_error',
      last_error: 'Google Business Profile sync failed unexpectedly.',
    });
  });

  it('builds failure sync-run audit payloads with stable error details', () => {
    const gbpError = new GoogleBusinessProfileError('Forbidden.', {
      code: 'GBP_FORBIDDEN',
      status: 403,
    });

    expect(
      buildBusinessInfoSyncFailureRun({
        externalProfileId: 'profile-1',
        restaurantId: 'rest-1',
        runKind: 'location_selection',
        startedAt: '2026-05-21T09:59:00.000Z',
        finishedAt: '2026-05-21T10:00:00.000Z',
        error: gbpError,
      }),
    ).toEqual({
      external_profile_id: 'profile-1',
      restaurant_id: 'rest-1',
      provider: 'google_business_profile',
      run_kind: 'location_selection',
      status: 'failed',
      started_at: '2026-05-21T09:59:00.000Z',
      finished_at: '2026-05-21T10:00:00.000Z',
      error_code: 'GBP_FORBIDDEN',
      error_message: 'Forbidden.',
      metadata: null,
    });
  });
});
