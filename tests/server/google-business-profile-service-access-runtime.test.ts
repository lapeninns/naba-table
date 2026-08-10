import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCredentialRowMock = vi.hoisted(() => vi.fn());
const updateCredentialRefreshMock = vi.hoisted(() => vi.fn());
const updateExternalProfileMock = vi.hoisted(() => vi.fn());
const transitionConnectionProviderFailureFencedMock = vi.hoisted(() => vi.fn());
const decryptSecretMock = vi.hoisted(() => vi.fn());
const decryptSecretWithMetadataMock = vi.hoisted(() => vi.fn());
const encryptSecretMock = vi.hoisted(() => vi.fn());
const listAccountsMock = vi.hoisted(() => vi.fn());
const listLocationsMock = vi.hoisted(() => vi.fn());
const refreshTokenMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/google-business-profile/serviceRepository', () => ({
  getCredentialRow: getCredentialRowMock,
  refreshCredentialFenced: updateCredentialRefreshMock,
  transitionConnectionProviderFailureFenced: transitionConnectionProviderFailureFencedMock,
  updateExternalProfile: updateExternalProfileMock,
}));

vi.mock('@/server/google-business-profile/crypto', () => ({
  decryptGoogleBusinessProfileSecret: decryptSecretMock,
  decryptGoogleBusinessProfileSecretWithMetadata: decryptSecretWithMetadataMock,
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
    restaurant_id: 'restaurant-1',
    external_account_id: 'account-1',
    external_profile_id: 'profile-1',
    external_location_id: 'location-1',
    connection_generation: 2,
    consent_epoch: 3,
    connection_status: 'linked',
    write_state: 'enabled',
    write_state_actor_user_id: 'user-1',
    updated_at: '2026-05-20T22:00:00.000Z',
    ...overrides,
  };
}

describe('google business profile service access runtime', () => {
  beforeEach(() => {
    getCredentialRowMock.mockReset();
    updateCredentialRefreshMock.mockReset();
    updateExternalProfileMock.mockReset();
    transitionConnectionProviderFailureFencedMock.mockReset();
    decryptSecretMock.mockReset();
    decryptSecretWithMetadataMock.mockReset();
    encryptSecretMock.mockReset();
    listAccountsMock.mockReset();
    listLocationsMock.mockReset();
    refreshTokenMock.mockReset();
    clearGoogleBusinessProfileLocationDiscoveryCacheForTests();

    decryptSecretMock.mockReturnValue('refresh-token');
    decryptSecretWithMetadataMock.mockReturnValue({
      plaintext: 'refresh-token',
      keyId: 'active',
      requiresRewrap: false,
    });
    encryptSecretMock.mockImplementation((value: string) => `enc:${value}`);
    refreshTokenMock.mockResolvedValue({
      accessToken: 'access-token',
      expiresIn: 3600,
      refreshToken: null,
      grantedScopes: [],
      tokenType: null,
      idToken: null,
    });
    updateCredentialRefreshMock.mockImplementation(async (args) => ({
      ...credential(),
      refresh_token_encrypted: args.p_refresh_token_encrypted,
      granted_scopes: args.p_granted_scopes,
      token_type: args.p_token_type,
      last_error: null,
    }));
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

    expect(decryptSecretWithMetadataMock).toHaveBeenCalledWith('encrypted-refresh', 'external-1');
    expect(encryptSecretMock).toHaveBeenCalledWith('new-refresh-token', 'external-1');
    expect(updateCredentialRefreshMock).toHaveBeenCalledWith(
      expect.objectContaining({
        p_restaurant_id: 'restaurant-1',
        p_external_profile_row_id: 'external-1',
        p_expected_refresh_token_encrypted: 'encrypted-refresh',
        p_refresh_token_encrypted: 'enc:new-refresh-token',
        p_granted_scopes: ['scope-a'],
        p_token_type: 'Bearer',
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

  it('persists an exact-fenced reauth transition for invalid_grant', async () => {
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

    expect(transitionConnectionProviderFailureFencedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        p_restaurant_id: 'restaurant-1',
        p_external_profile_row_id: 'external-1',
        p_expected_account_id: 'account-1',
        p_expected_profile_id: 'profile-1',
        p_expected_location_id: 'location-1',
        p_connection_generation: 2,
        p_consent_epoch: 3,
        p_next_state: 'reauth_required',
        p_reason_code: 'provider_invalid_grant',
      }),
      {},
    );
  });

  it('persists an exact-fenced blocked transition for provider access loss', async () => {
    getCredentialRowMock.mockResolvedValue(credential());
    refreshTokenMock.mockRejectedValue(
      new GoogleBusinessProfileError('Access lost.', {
        code: 'GBP_ACCESS_LOST',
        status: 409,
        kind: 'access_lost',
        upstreamStatus: 403,
      }),
    );

    await expect(
      getUsableGoogleBusinessProfileAccessToken(externalProfile() as never, {} as never),
    ).rejects.toMatchObject({ kind: 'access_lost' });

    expect(transitionConnectionProviderFailureFencedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        p_next_state: 'blocked',
        p_reason_code: 'provider_access_lost_403',
        p_connection_generation: 2,
        p_consent_epoch: 3,
      }),
      {},
    );
  });

  it('persists reauth when a Google read returns API 401 after refresh', async () => {
    getCredentialRowMock.mockResolvedValue(credential());
    listAccountsMock.mockRejectedValue(
      new GoogleBusinessProfileError('Unauthorized.', {
        code: 'GBP_REAUTH',
        status: 409,
        kind: 'reauth',
        upstreamStatus: 401,
      }),
    );

    await expect(
      discoverGoogleBusinessProfileLocationsForProfile(externalProfile() as never, {} as never),
    ).rejects.toMatchObject({ kind: 'reauth', upstreamStatus: 401 });

    expect(transitionConnectionProviderFailureFencedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        p_next_state: 'reauth_required',
        p_reason_code: 'provider_unauthorized_401',
      }),
      {},
    );
  });

  it('rejects normal credential access while revocation recovery is pending', async () => {
    await expect(
      getUsableGoogleBusinessProfileAccessToken(
        externalProfile({ write_state: 'revoking' }) as never,
        {} as never,
      ),
    ).rejects.toMatchObject({ code: 'GBP_REVOCATION_PENDING', status: 409 });

    expect(getCredentialRowMock).not.toHaveBeenCalled();
    expect(refreshTokenMock).not.toHaveBeenCalled();
  });

  it('rewraps an old credential through the fenced ciphertext CAS during access', async () => {
    getCredentialRowMock.mockResolvedValue(credential());
    decryptSecretWithMetadataMock.mockReturnValue({
      plaintext: 'refresh-token',
      keyId: 'old',
      requiresRewrap: true,
    });
    encryptSecretMock.mockReturnValue('gbp.1.active.rewrapped');

    await getUsableGoogleBusinessProfileAccessToken(externalProfile() as never, {} as never);

    expect(updateCredentialRefreshMock).toHaveBeenCalledWith(
      expect.objectContaining({
        p_expected_refresh_token_encrypted: 'encrypted-refresh',
        p_refresh_token_encrypted: 'gbp.1.active.rewrapped',
      }),
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

  it('does not reuse location discovery cache across credential profile updates', async () => {
    getCredentialRowMock.mockResolvedValue(credential());
    listAccountsMock.mockResolvedValue([{ name: 'accounts/1', accountName: 'Primary account' }]);
    listLocationsMock
      .mockResolvedValueOnce([{ accountName: 'Primary account', locationName: 'locations/old' }])
      .mockResolvedValueOnce([{ accountName: 'Primary account', locationName: 'locations/new' }]);

    await discoverGoogleBusinessProfileLocationsForProfile(externalProfile() as never, {} as never);
    const refreshed = await discoverGoogleBusinessProfileLocationsForProfile(
      externalProfile({ updated_at: '2026-05-21T09:00:00.000Z' }) as never,
      {} as never,
    );

    expect(refreshed.availableLocations).toEqual([
      { accountName: 'Primary account', locationName: 'locations/new' },
    ]);
    expect(refreshTokenMock).toHaveBeenCalledTimes(2);
    expect(listLocationsMock).toHaveBeenCalledTimes(2);
  });
});
