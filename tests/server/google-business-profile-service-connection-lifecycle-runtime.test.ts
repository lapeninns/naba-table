import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const revokeTokenMock = vi.hoisted(() => vi.fn());
const decryptSecretMock = vi.hoisted(() => vi.fn());
const discoverLocationsMock = vi.hoisted(() => vi.fn());
const getConnectionStateMock = vi.hoisted(() => vi.fn());
const disconnectConnectionFencedMock = vi.hoisted(() => vi.fn());
const transitionConnectionFencedMock = vi.hoisted(() => vi.fn());
const teardownNotificationsMock = vi.hoisted(() => vi.fn());
const onRevocationUncertainMock = vi.hoisted(() => vi.fn());
const ensureExternalProfileMock = vi.hoisted(() => vi.fn());
const getCredentialRowMock = vi.hoisted(() => vi.fn());
const updateExternalProfileMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/google-business-profile/client', () => ({
  revokeGoogleBusinessProfileToken: revokeTokenMock,
}));

vi.mock('@/server/google-business-profile/crypto', () => ({
  decryptGoogleBusinessProfileSecret: decryptSecretMock,
}));

vi.mock('@/server/google-business-profile/serviceAccessRuntime', () => ({
  discoverGoogleBusinessProfileLocationsForProfile: discoverLocationsMock,
}));

vi.mock('@/server/google-business-profile/serviceConnectionStateRuntime', () => ({
  getGoogleBusinessProfileConnectionStateForClient: getConnectionStateMock,
}));

vi.mock('@/server/google-business-profile/serviceRepository', () => ({
  disconnectConnectionFenced: disconnectConnectionFencedMock,
  transitionConnectionFenced: transitionConnectionFencedMock,
  ensureExternalProfile: ensureExternalProfileMock,
  getCredentialRow: getCredentialRowMock,
  updateExternalProfile: updateExternalProfileMock,
}));

import {
  disconnectGoogleBusinessProfileConnectionForClient,
  getGoogleBusinessProfileAvailableLocationsForClient,
  linkGoogleBusinessProfileLocationForClient,
} from '@/server/google-business-profile/serviceConnectionLifecycleRuntime';

function externalProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: 'external-1',
    restaurant_id: 'restaurant-1',
    external_location_id: 'location-1',
    external_account_id: 'account-1',
    external_profile_id: 'profile-1',
    connection_generation: 1,
    consent_epoch: 1,
    ...overrides,
  };
}

const availableLocation = {
  accountName: 'accounts/1',
  accountId: 'account-1',
  locationName: 'locations/1',
  locationId: 'location-1',
  title: 'The Crown',
  address: '1 High Street',
  primaryCategory: 'Restaurant',
  placeId: 'place-1',
};

describe('google business profile connection lifecycle runtime', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    revokeTokenMock.mockReset();
    decryptSecretMock.mockReset();
    discoverLocationsMock.mockReset();
    getConnectionStateMock.mockReset();
    disconnectConnectionFencedMock.mockReset();
    transitionConnectionFencedMock.mockReset();
    teardownNotificationsMock.mockReset();
    onRevocationUncertainMock.mockReset();
    ensureExternalProfileMock.mockReset();
    getCredentialRowMock.mockReset();
    updateExternalProfileMock.mockReset();

    ensureExternalProfileMock.mockResolvedValue(externalProfile());
    getConnectionStateMock.mockResolvedValue({
      status: 'linked',
      availableLocations: [availableLocation],
    });
    decryptSecretMock.mockReturnValue('refresh-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads available locations through the connection-state runtime', async () => {
    await expect(
      getGoogleBusinessProfileAvailableLocationsForClient('restaurant-1', {} as never, {
        forceRefresh: true,
      }),
    ).resolves.toEqual([availableLocation]);

    expect(getConnectionStateMock).toHaveBeenCalledWith(
      'restaurant-1',
      {},
      {
        includeAvailableLocations: true,
        forceRefreshLocations: true,
      },
    );
  });

  it('links a selected Google location and returns refreshed connection state', async () => {
    const client = {} as never;
    discoverLocationsMock.mockResolvedValue({ availableLocations: [availableLocation] });

    await expect(
      linkGoogleBusinessProfileLocationForClient(
        'restaurant-1',
        {
          accountName: 'accounts/1',
          accountId: 'account-1',
          locationName: 'locations/1',
          locationId: 'location-1',
        },
        client,
      ),
    ).resolves.toEqual({
      status: 'linked',
      availableLocations: [availableLocation],
    });

    expect(ensureExternalProfileMock).toHaveBeenCalledWith('restaurant-1', client);
    expect(discoverLocationsMock).toHaveBeenCalledWith(externalProfile(), client);
    expect(updateExternalProfileMock).toHaveBeenCalledWith(
      'external-1',
      {
        external_account_id: 'account-1',
        external_account_name: 'accounts/1',
        external_location_id: 'location-1',
        external_location_name: 'locations/1',
        external_location_title: 'The Crown',
        external_place_id: 'place-1',
        external_resource_name: 'locations/1',
        connection_status: 'linked',
        last_error: null,
      },
      client,
    );
    expect(getConnectionStateMock).toHaveBeenCalledWith('restaurant-1', client);
  });

  it('revokes then atomically disconnects the exact fenced profile', async () => {
    const client = {} as never;
    getCredentialRowMock.mockResolvedValue({ refresh_token_encrypted: 'encrypted-refresh' });

    await disconnectGoogleBusinessProfileConnectionForClient('restaurant-1', client, {
      actorUserId: 'user-1',
      teardownNotifications: teardownNotificationsMock,
      onRevocationUncertain: onRevocationUncertainMock,
    });

    expect(decryptSecretMock).toHaveBeenCalledWith('encrypted-refresh', 'external-1');
    expect(revokeTokenMock).toHaveBeenCalledWith('refresh-token');
    expect(teardownNotificationsMock).toHaveBeenCalledTimes(1);
    expect(teardownNotificationsMock.mock.invocationCallOrder[0]).toBeLessThan(
      revokeTokenMock.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
    expect(transitionConnectionFencedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        p_restaurant_id: 'restaurant-1',
        p_external_profile_row_id: 'external-1',
        p_expected_account_id: 'account-1',
        p_expected_profile_id: 'profile-1',
        p_expected_location_id: 'location-1',
        p_connection_generation: 1,
        p_consent_epoch: 1,
      }),
      client,
    );
    expect(disconnectConnectionFencedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        p_restaurant_id: 'restaurant-1',
        p_external_profile_row_id: 'external-1',
        p_connection_generation: 1,
        p_consent_epoch: 2,
      }),
      client,
    );
    expect(getConnectionStateMock).toHaveBeenCalledWith('restaurant-1', client);
  });

  it('retains restricted revocation recovery and alerts when token revoke is uncertain', async () => {
    getCredentialRowMock.mockResolvedValue({ refresh_token_encrypted: 'encrypted-refresh' });
    revokeTokenMock.mockRejectedValue(new Error('revoke failed'));
    getConnectionStateMock.mockResolvedValue({ status: 'revoking' });

    await expect(
      disconnectGoogleBusinessProfileConnectionForClient('restaurant-1', {} as never, {
        actorUserId: 'user-1',
        teardownNotifications: teardownNotificationsMock,
        onRevocationUncertain: onRevocationUncertainMock,
      }),
    ).resolves.toEqual({ status: 'revoking' });

    expect(transitionConnectionFencedMock).toHaveBeenCalled();
    expect(onRevocationUncertainMock).toHaveBeenCalledWith({
      restaurantId: 'restaurant-1',
      externalProfileRowId: 'external-1',
    });
    expect(disconnectConnectionFencedMock).not.toHaveBeenCalled();
  });

  it('fails before provider teardown when the current connection fence is stale', async () => {
    transitionConnectionFencedMock.mockRejectedValue(new Error('stale connection fence'));

    await expect(
      disconnectGoogleBusinessProfileConnectionForClient('restaurant-1', {} as never, {
        actorUserId: 'user-1',
        teardownNotifications: teardownNotificationsMock,
        onRevocationUncertain: onRevocationUncertainMock,
      }),
    ).rejects.toThrow('stale connection fence');

    expect(teardownNotificationsMock).not.toHaveBeenCalled();
    expect(revokeTokenMock).not.toHaveBeenCalled();
    expect(disconnectConnectionFencedMock).not.toHaveBeenCalled();
  });

  it('disconnects without revoking when no refresh token is stored', async () => {
    getCredentialRowMock.mockResolvedValue(null);

    await disconnectGoogleBusinessProfileConnectionForClient('restaurant-1', {} as never, {
      actorUserId: 'user-1',
      teardownNotifications: teardownNotificationsMock,
      onRevocationUncertain: onRevocationUncertainMock,
    });

    expect(decryptSecretMock).not.toHaveBeenCalled();
    expect(revokeTokenMock).not.toHaveBeenCalled();
    expect(disconnectConnectionFencedMock).toHaveBeenCalled();
  });
});
