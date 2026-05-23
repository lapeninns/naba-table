import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCredentialRowMock = vi.hoisted(() => vi.fn());
const updateCredentialRefreshMock = vi.hoisted(() => vi.fn());
const updateExternalProfileMock = vi.hoisted(() => vi.fn());
const decryptSecretMock = vi.hoisted(() => vi.fn());
const encryptSecretMock = vi.hoisted(() => vi.fn());
const listAccountsMock = vi.hoisted(() => vi.fn());
const listLocationsMock = vi.hoisted(() => vi.fn());
const refreshTokenMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/google-business-profile/serviceRepository', () => ({
  getCredentialRow: getCredentialRowMock,
  updateCredentialRefresh: updateCredentialRefreshMock,
  updateExternalProfile: updateExternalProfileMock,
}));

vi.mock('@/server/google-business-profile/crypto', () => ({
  decryptGoogleBusinessProfileSecret: decryptSecretMock,
  encryptGoogleBusinessProfileSecret: encryptSecretMock,
}));

vi.mock('@/server/google-business-profile/client', () => ({
  listGoogleBusinessProfileAccounts: listAccountsMock,
  listGoogleBusinessProfileLocations: listLocationsMock,
  refreshGoogleBusinessProfileAccessToken: refreshTokenMock,
}));

import { GoogleBusinessProfileError } from '@/server/google-business-profile/errors';
import {
  clearGoogleBusinessProfileLocationDiscoveryCacheForTests,
  discoverGoogleBusinessProfileLocationsForProfile,
  getUsableGoogleBusinessProfileAccessToken,
} from '@/server/google-business-profile/serviceAccessRuntime';

function credential(overrides: Record<string, unknown> = {}) {
  return {
    external_profile_id: 'external-1',
    provider_user_id: 'google-user-1',
    connected_google_email: 'owner@example.com',
    connected_google_name: 'Owner',
    refresh_token_encrypted: 'encrypted-refresh',
    granted_scopes: ['existing-scope'],
    token_type: 'ExistingBearer',
    last_refreshed_at: '2026-05-20T22:00:00.000Z',
    last_error: 'previous error',
    ...overrides,
  };
}

function externalProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: 'external-1',
    external_location_id: 'location-1',
    connection_status: 'linked',
    ...overrides,
  };
}

describe('google business profile service access runtime', () => {
  beforeEach(() => {
    getCredentialRowMock.mockReset();
    updateCredentialRefreshMock.mockReset();
    updateExternalProfileMock.mockReset();
    decryptSecretMock.mockReset();
    encryptSecretMock.mockReset();
    listAccountsMock.mockReset();
    listLocationsMock.mockReset();
    refreshTokenMock.mockReset();
    clearGoogleBusinessProfileLocationDiscoveryCacheForTests();

    decryptSecretMock.mockReturnValue('refresh-token');
    encryptSecretMock.mockImplementation((value: string) => `enc:${value}`);
    refreshTokenMock.mockResolvedValue({
      accessToken: 'access-token',
      expiresIn: 3600,
      refreshToken: null,
      grantedScopes: [],
      tokenType: null,
      idToken: null,
    });
  });

  it('throws a stable not-connected error when credentials are missing', async () => {
    getCredentialRowMock.mockResolvedValue(null);

    await expect(
      getUsableGoogleBusinessProfileAccessToken(externalProfile() as never, {} as never),
    ).rejects.toMatchObject({
      code: 'GBP_NOT_CONNECTED',
      status: 404,
      message: 'Google Business Profile is not connected for this restaurant.',
    });

    expect(refreshTokenMock).not.toHaveBeenCalled();
  });

  it('refreshes credentials and returns the refreshed credential row', async () => {
    getCredentialRowMock.mockResolvedValue(credential());
    refreshTokenMock.mockResolvedValue({
      accessToken: 'new-access-token',
      expiresIn: 3600,
      refreshToken: 'new-refresh-token',
      grantedScopes: ['scope-a'],
      tokenType: 'Bearer',
      idToken: null,
    });

    const result = await getUsableGoogleBusinessProfileAccessToken(
      externalProfile() as never,
      {} as never,
    );

    expect(decryptSecretMock).toHaveBeenCalledWith('encrypted-refresh');
    expect(encryptSecretMock).toHaveBeenCalledWith('new-refresh-token');
    expect(updateCredentialRefreshMock).toHaveBeenCalledWith(
      'external-1',
      expect.objectContaining({
        refresh_token_encrypted: 'enc:new-refresh-token',
        granted_scopes: ['scope-a'],
        token_type: 'Bearer',
        last_error: null,
      }),
      {},
    );
    expect(result).toMatchObject({
      accessToken: 'new-access-token',
      credential: {
        refresh_token_encrypted: 'enc:new-refresh-token',
        granted_scopes: ['scope-a'],
        token_type: 'Bearer',
        last_error: null,
      },
    });
  });

  it('marks the profile reauth-required when Google refresh requires reauth', async () => {
    getCredentialRowMock.mockResolvedValue(credential());
    refreshTokenMock.mockRejectedValue(
      new GoogleBusinessProfileError('Reconnect Google.', {
        code: 'GBP_REAUTH_REQUIRED',
        status: 401,
      }),
    );

    await expect(
      getUsableGoogleBusinessProfileAccessToken(externalProfile() as never, {} as never),
    ).rejects.toMatchObject({
      code: 'GBP_REAUTH_REQUIRED',
    });

    expect(updateExternalProfileMock).toHaveBeenCalledWith(
      'external-1',
      {
        connection_status: 'reauth_required',
        last_error: 'Reconnect Google.',
      },
      {},
    );
  });

  it('caches discovered Google locations until force refresh is requested', async () => {
    getCredentialRowMock.mockResolvedValue(credential());
    listAccountsMock.mockResolvedValue([
      { name: 'accounts/1', accountName: 'Primary account' },
      { name: 'accounts/2', accountName: 'Second account' },
    ]);
    listLocationsMock
      .mockResolvedValueOnce([{ accountName: 'Primary account', locationName: 'locations/1' }])
      .mockResolvedValueOnce([{ accountName: 'Second account', locationName: 'locations/2' }])
      .mockResolvedValueOnce([{ accountName: 'Primary account', locationName: 'locations/1b' }])
      .mockResolvedValueOnce([{ accountName: 'Second account', locationName: 'locations/2b' }]);

    const first = await discoverGoogleBusinessProfileLocationsForProfile(
      externalProfile() as never,
      {} as never,
    );
    const cached = await discoverGoogleBusinessProfileLocationsForProfile(
      externalProfile() as never,
      {} as never,
    );
    const refreshed = await discoverGoogleBusinessProfileLocationsForProfile(
      externalProfile() as never,
      {} as never,
      { forceRefresh: true },
    );

    expect(first.availableLocations).toEqual([
      { accountName: 'Primary account', locationName: 'locations/1' },
      { accountName: 'Second account', locationName: 'locations/2' },
    ]);
    expect(cached.availableLocations).toEqual(first.availableLocations);
    expect(refreshed.availableLocations).toEqual([
      { accountName: 'Primary account', locationName: 'locations/1b' },
      { accountName: 'Second account', locationName: 'locations/2b' },
    ]);
    expect(refreshTokenMock).toHaveBeenCalledTimes(2);
    expect(listLocationsMock).toHaveBeenCalledTimes(4);
  });
});
