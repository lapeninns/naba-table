import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const revokeTokenMock = vi.hoisted(() => vi.fn());
const decryptSecretMock = vi.hoisted(() => vi.fn());
const discoverLocationsMock = vi.hoisted(() => vi.fn());
const getConnectionStateMock = vi.hoisted(() => vi.fn());
const deleteCredentialsMock = vi.hoisted(() => vi.fn());
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
  deleteCredentialsForExternalProfile: deleteCredentialsMock,
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
    deleteCredentialsMock.mockReset();
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

  it('revokes the refresh token, deletes credentials, clears the linked profile, and returns state', async () => {
    const client = {} as never;
    getCredentialRowMock.mockResolvedValue({ refresh_token_encrypted: 'encrypted-refresh' });

    await disconnectGoogleBusinessProfileConnectionForClient('restaurant-1', client);

    expect(decryptSecretMock).toHaveBeenCalledWith('encrypted-refresh');
    expect(revokeTokenMock).toHaveBeenCalledWith('refresh-token');
    expect(deleteCredentialsMock).toHaveBeenCalledWith('external-1', client);
    expect(updateExternalProfileMock).toHaveBeenCalledWith(
      'external-1',
      expect.objectContaining({
        external_account_id: null,
        external_location_id: null,
        connection_status: 'unlinked',
        last_error: null,
      }),
      client,
    );
    expect(getConnectionStateMock).toHaveBeenCalledWith('restaurant-1', client);
  });

  it('continues disconnect when Google token revoke fails', async () => {
    getCredentialRowMock.mockResolvedValue({ refresh_token_encrypted: 'encrypted-refresh' });
    revokeTokenMock.mockRejectedValue(new Error('revoke failed'));

    await expect(
      disconnectGoogleBusinessProfileConnectionForClient('restaurant-1', {} as never),
    ).resolves.toEqual({
      status: 'linked',
      availableLocations: [availableLocation],
    });

    expect(deleteCredentialsMock).toHaveBeenCalled();
    expect(updateExternalProfileMock).toHaveBeenCalled();
  });

  it('disconnects without revoking when no refresh token is stored', async () => {
    getCredentialRowMock.mockResolvedValue(null);

    await disconnectGoogleBusinessProfileConnectionForClient('restaurant-1', {} as never);

    expect(decryptSecretMock).not.toHaveBeenCalled();
    expect(revokeTokenMock).not.toHaveBeenCalled();
    expect(deleteCredentialsMock).toHaveBeenCalledWith('external-1', {});
  });
});
