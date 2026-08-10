import { beforeEach, describe, expect, it, vi } from 'vitest';

const authUrlMock = vi.hoisted(() => vi.fn());
const exchangeCodeMock = vi.hoisted(() => vi.fn());
const fetchIdentityMock = vi.hoisted(() => vi.fn());
const consumeOAuthStateMock = vi.hoisted(() => vi.fn());
const createOAuthStateMock = vi.hoisted(() => vi.fn());
const saveCredentialsMock = vi.hoisted(() => vi.fn());
const completedPayloadMock = vi.hoisted(() => vi.fn());
const failurePayloadMock = vi.hoisted(() => vi.fn());
const pendingPayloadMock = vi.hoisted(() => vi.fn());
const sanitizeReturnPathMock = vi.hoisted(() => vi.fn());
const ensureExternalProfileMock = vi.hoisted(() => vi.fn());
const updateExternalProfileMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/logger', () => ({
  logger: {
    child: () => ({
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

vi.mock('@/server/google-business-profile/client', () => ({
  buildGoogleBusinessProfileAuthUrl: authUrlMock,
  exchangeGoogleBusinessProfileCode: exchangeCodeMock,
  fetchGoogleBusinessProfileIdentity: fetchIdentityMock,
}));

vi.mock('@/server/google-business-profile/serviceAuthorizationFlow', () => ({
  consumeOAuthStateRecord: consumeOAuthStateMock,
  createOAuthStateRecord: createOAuthStateMock,
  completeOAuthIdentityRecord: saveCredentialsMock,
}));

vi.mock('@/server/google-business-profile/serviceConnectionLifecyclePayloads', () => ({
  buildAuthorizationCompletedExternalProfileUpdate: completedPayloadMock,
  buildAuthorizationFailureExternalProfileUpdate: failurePayloadMock,
  buildAuthorizationPendingExternalProfileUpdate: pendingPayloadMock,
}));

vi.mock('@/server/google-business-profile/serviceOAuthState', () => ({
  sanitizeOAuthReturnPath: sanitizeReturnPathMock,
}));

vi.mock('@/server/google-business-profile/serviceRepository', () => ({
  ensureExternalProfile: ensureExternalProfileMock,
  updateExternalProfile: updateExternalProfileMock,
}));

import {
  completeGoogleBusinessProfileAuthorizationForClient,
  createGoogleBusinessProfileAuthorizationForClient,
  createGoogleBusinessProfileAuthorizationUrlForClient,
} from '@/server/google-business-profile/serviceAuthorizationRuntime';

function externalProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: 'external-1',
    restaurant_id: 'restaurant-1',
    provider: 'google_business_profile',
    ...overrides,
  };
}

function oauthState(overrides: Record<string, unknown> = {}) {
  return {
    id: 'state-1',
    restaurant_id: 'restaurant-1',
    return_path: '/app/settings/restaurant/google-business-profile',
    ...overrides,
  };
}

const tokens = {
  accessToken: 'access-token',
  expiresIn: 3600,
  refreshToken: 'refresh-token',
  grantedScopes: ['scope-a'],
  tokenType: 'Bearer',
  idToken: 'id-token',
};

const identity = {
  providerUserId: 'google-user-1',
  email: 'owner@example.com',
  name: 'Owner',
};

describe('google business profile service authorization runtime', () => {
  beforeEach(() => {
    authUrlMock.mockReset();
    exchangeCodeMock.mockReset();
    fetchIdentityMock.mockReset();
    consumeOAuthStateMock.mockReset();
    createOAuthStateMock.mockReset();
    saveCredentialsMock.mockReset();
    completedPayloadMock.mockReset();
    failurePayloadMock.mockReset();
    pendingPayloadMock.mockReset();
    sanitizeReturnPathMock.mockReset();
    ensureExternalProfileMock.mockReset();
    updateExternalProfileMock.mockReset();

    authUrlMock.mockImplementation(
      (stateToken: string) => `https://google.example/auth/${stateToken}`,
    );
    completedPayloadMock.mockReturnValue({ connection_status: 'authorized' });
    failurePayloadMock.mockImplementation((message: string) => ({
      connection_status: 'sync_error',
      last_error: message,
    }));
    pendingPayloadMock.mockReturnValue({ connection_status: 'pending_auth' });
    sanitizeReturnPathMock.mockImplementation(
      (value: string | null | undefined) => value ?? '/safe',
    );
  });

  it('starts authorization by creating state and marking the profile pending', async () => {
    const client = {} as never;
    ensureExternalProfileMock.mockResolvedValue(externalProfile());
    createOAuthStateMock.mockResolvedValue('state-token');

    const result = await createGoogleBusinessProfileAuthorizationForClient({
      restaurantId: 'restaurant-1',
      requestedByUserId: 'user-1',
      returnPath: '/app/settings/restaurant/google-business-profile',
      client,
    });

    expect(ensureExternalProfileMock).toHaveBeenCalledWith('restaurant-1', client);
    expect(createOAuthStateMock).toHaveBeenCalledWith(
      {
        restaurantId: 'restaurant-1',
        requestedByUserId: 'user-1',
        returnPath: '/app/settings/restaurant/google-business-profile',
      },
      client,
    );
    expect(updateExternalProfileMock).toHaveBeenCalledWith(
      'external-1',
      { connection_status: 'pending_auth' },
      client,
    );
    expect(result).toEqual({
      authorizationUrl: 'https://google.example/auth/state-token',
      stateToken: 'state-token',
    });
  });

  it('returns only the authorization URL for convenience callers', async () => {
    ensureExternalProfileMock.mockResolvedValue(externalProfile());
    createOAuthStateMock.mockResolvedValue('state-token');

    await expect(
      createGoogleBusinessProfileAuthorizationUrlForClient({
        restaurantId: 'restaurant-1',
        requestedByUserId: 'user-1',
        client: {} as never,
      }),
    ).resolves.toBe('https://google.example/auth/state-token');
  });

  it('completes authorization and persists credentials with identity details', async () => {
    const client = {} as never;
    const clock = vi
      .fn()
      .mockReturnValueOnce('2026-05-22T08:00:00.000Z')
      .mockReturnValueOnce('2026-05-22T08:01:00.000Z');
    consumeOAuthStateMock.mockResolvedValue(oauthState());
    ensureExternalProfileMock.mockResolvedValue(externalProfile());
    exchangeCodeMock.mockResolvedValue(tokens);
    fetchIdentityMock.mockResolvedValue(identity);

    const result = await completeGoogleBusinessProfileAuthorizationForClient({
      stateToken: 'state-token',
      code: 'auth-code',
      requestedByUserId: 'user-1',
      expectedRestaurantId: 'restaurant-1',
      client,
      clock,
    });

    expect(consumeOAuthStateMock).toHaveBeenCalledWith(
      {
        stateToken: 'state-token',
        requestedByUserId: 'user-1',
        expectedRestaurantId: 'restaurant-1',
        consumedAt: '2026-05-22T08:00:00.000Z',
      },
      client,
    );
    expect(exchangeCodeMock).toHaveBeenCalledWith('auth-code');
    expect(fetchIdentityMock).toHaveBeenCalledWith({
      idToken: 'id-token',
      expectedNonce: expect.any(String),
    });
    expect(saveCredentialsMock).toHaveBeenCalledWith(
      {
        state: oauthState(),
        stateToken: 'state-token',
        requestedByUserId: 'user-1',
        tokens,
        identity,
        refreshedAt: '2026-05-22T08:01:00.000Z',
      },
      client,
    );
    expect(result).toEqual({
      restaurantId: 'restaurant-1',
      returnPath: '/app/settings/restaurant/google-business-profile',
    });
  });

  it('fails closed when identity validation fails', async () => {
    consumeOAuthStateMock.mockResolvedValue(oauthState());
    ensureExternalProfileMock.mockResolvedValue(externalProfile());
    exchangeCodeMock.mockResolvedValue(tokens);
    fetchIdentityMock.mockRejectedValue(new Error('identity unavailable'));

    await expect(
      completeGoogleBusinessProfileAuthorizationForClient({
        stateToken: 'state-token',
        code: 'auth-code',
        requestedByUserId: 'user-1',
        client: {} as never,
        clock: () => '2026-05-22T08:00:00.000Z',
      }),
    ).rejects.toThrow('identity unavailable');

    expect(saveCredentialsMock).not.toHaveBeenCalled();
    expect(updateExternalProfileMock).not.toHaveBeenCalled();
  });

  it('rethrows OAuth exchange errors without a stale profile write', async () => {
    const exchangeError = new Error('OAuth exchange failed.');
    consumeOAuthStateMock.mockResolvedValue(oauthState({ return_path: 'https://evil.example' }));
    ensureExternalProfileMock.mockResolvedValue(externalProfile());
    exchangeCodeMock.mockRejectedValue(exchangeError);
    sanitizeReturnPathMock.mockReturnValue('/app/settings/restaurant/google-business-profile');

    await expect(
      completeGoogleBusinessProfileAuthorizationForClient({
        stateToken: 'state-token',
        code: 'auth-code',
        requestedByUserId: 'user-1',
        client: {} as never,
        clock: () => '2026-05-22T08:00:00.000Z',
      }),
    ).rejects.toThrow(exchangeError);

    expect(failurePayloadMock).not.toHaveBeenCalled();
    expect(updateExternalProfileMock).not.toHaveBeenCalled();
    expect(saveCredentialsMock).not.toHaveBeenCalled();
  });
});
