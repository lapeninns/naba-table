import { describe, expect, it } from 'vitest';

import {
  buildAuthorizationCompletedExternalProfileUpdate,
  buildAuthorizationFailureExternalProfileUpdate,
  buildAuthorizationPendingExternalProfileUpdate,
  buildDisconnectedExternalProfileUpdate,
  buildGooglePushSuccessExternalProfileUpdate,
  buildLinkedLocationExternalProfileUpdate,
  buildReauthRequiredExternalProfileUpdate,
} from '@/server/google-business-profile/serviceConnectionLifecyclePayloads';

describe('google business profile service connection lifecycle payloads', () => {
  it('builds authorization pending and completion payloads', () => {
    expect(buildAuthorizationPendingExternalProfileUpdate()).toEqual({
      connection_status: 'pending_auth',
      last_error: null,
    });

    expect(
      buildAuthorizationCompletedExternalProfileUpdate({
        external_location_id: 'location-1',
      }),
    ).toEqual({
      connection_status: 'linked',
      last_error: null,
    });

    expect(
      buildAuthorizationCompletedExternalProfileUpdate({
        external_location_id: null,
      }),
    ).toEqual({
      connection_status: 'authorized',
      last_error: null,
    });
  });

  it('builds authorization and reauth failure payloads', () => {
    expect(buildReauthRequiredExternalProfileUpdate('Reconnect Google.')).toEqual({
      connection_status: 'reauth_required',
      last_error: 'Reconnect Google.',
    });
    expect(buildAuthorizationFailureExternalProfileUpdate('OAuth failed.')).toEqual({
      connection_status: 'sync_error',
      last_error: 'OAuth failed.',
    });
  });

  it('builds push success payloads', () => {
    expect(buildGooglePushSuccessExternalProfileUpdate('2026-05-21T10:00:00.000Z')).toEqual({
      last_push_at: '2026-05-21T10:00:00.000Z',
      last_error: null,
      connection_status: 'linked',
    });
  });

  it('builds linked-location payloads from selected Google locations', () => {
    expect(
      buildLinkedLocationExternalProfileUpdate({
        accountId: 'account-1',
        accountName: 'accounts/1',
        locationId: 'location-1',
        locationName: 'locations/1',
        title: 'The Crown',
        address: '1 High Street',
        primaryCategory: 'Restaurant',
        placeId: 'place-1',
      }),
    ).toEqual({
      external_account_id: 'account-1',
      external_account_name: 'accounts/1',
      external_location_id: 'location-1',
      external_location_name: 'locations/1',
      external_location_title: 'The Crown',
      external_place_id: 'place-1',
      external_resource_name: 'locations/1',
      connection_status: 'linked',
      last_error: null,
    });
  });

  it('builds disconnect payloads that clear all linked Google fields', () => {
    expect(buildDisconnectedExternalProfileUpdate()).toEqual({
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
    });
  });
});
