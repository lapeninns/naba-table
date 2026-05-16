import { beforeEach, describe, expect, it, vi } from 'vitest';

const exchangeCodeMock = vi.hoisted(() => vi.fn());
const fetchIdentityMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/google-business-profile/client', () => ({
  buildGoogleBusinessProfileAuthUrl: vi.fn(
    (state: string) => `https://google.example/auth?state=${state}`,
  ),
  exchangeGoogleBusinessProfileCode: exchangeCodeMock,
  fetchGoogleBusinessProfileIdentity: fetchIdentityMock,
  getGoogleBusinessProfileLocationAttributes: vi.fn(),
  getGoogleBusinessProfileLocationProfile: vi.fn(),
  listGoogleBusinessProfileAccounts: vi.fn(),
  listGoogleBusinessProfileLocations: vi.fn(),
  parseGoogleLocationId: vi.fn((name: string) => name.split('/').at(-1) ?? name),
  patchGoogleBusinessProfileLocation: vi.fn(),
  refreshGoogleBusinessProfileAccessToken: vi.fn(),
  revokeGoogleBusinessProfileToken: vi.fn(),
}));

vi.mock('@/server/google-business-profile/crypto', () => ({
  decryptGoogleBusinessProfileSecret: vi.fn((value: string) => value.replace(/^enc:/, '')),
  encryptGoogleBusinessProfileSecret: vi.fn((value: string) => `enc:${value}`),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    child: () => ({
      error: vi.fn(),
      warn: vi.fn(),
    }),
  },
}));

type TableName =
  | 'restaurant_external_profiles'
  | 'restaurant_external_profile_credentials'
  | 'restaurant_external_profile_oauth_states'
  | 'restaurant_memberships';

type CapturedQueries = {
  credentialUpsert: unknown[];
  updates: { table: TableName; payload: unknown }[];
};

type BuildQueryOptions = {
  oauthStateOverrides?: Record<string, unknown>;
  membership?: Record<string, unknown> | null;
};

function buildQuery(table: TableName, captured: CapturedQueries, options: BuildQueryOptions = {}) {
  const profile = {
    id: 'profile-1',
    restaurant_id: 'rest-1',
    provider: 'google_business_profile',
    external_location_id: null,
    external_resource_name: null,
    connection_status: 'pending_auth',
    push_enabled: false,
  };
  const oauthState = {
    id: 'state-1',
    restaurant_id: 'rest-1',
    provider: 'google_business_profile',
    requested_by_user_id: 'user-1',
    state_token: 'state-token',
    return_path: '/app/settings/restaurant/google-business-profile',
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    consumed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...options.oauthStateOverrides,
  };
  const membership =
    options.membership === undefined
      ? {
          user_id: 'user-1',
          restaurant_id: 'rest-1',
          role: 'owner',
          created_at: new Date().toISOString(),
          restaurants: { id: 'rest-1', name: 'Old Crown', slug: 'old-crown' },
        }
      : options.membership;
  let updatePayload: unknown = null;

  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    is: vi.fn(() => query),
    maybeSingle: vi.fn(async () => {
      if (table === 'restaurant_external_profiles') {
        return { data: profile, error: null };
      }
      if (table === 'restaurant_external_profile_oauth_states') {
        if (updatePayload) {
          return { data: { id: oauthState.id }, error: null };
        }
        return { data: oauthState, error: null };
      }
      if (table === 'restaurant_memberships') {
        return { data: membership, error: null };
      }
      return { data: null, error: null };
    }),
    update: vi.fn((payload: unknown) => {
      updatePayload = payload;
      captured.updates.push({ table, payload });
      return query;
    }),
    insert: vi.fn(() => query),
    single: vi.fn(async () => ({ data: profile, error: null })),
    upsert: vi.fn(async (payload: unknown) => {
      captured.credentialUpsert.push(payload);
      return { error: null };
    }),
    then: undefined,
  };

  return query;
}

describe('GBP read-only V1 authorization storage', () => {
  beforeEach(() => {
    vi.resetModules();
    exchangeCodeMock.mockReset();
    fetchIdentityMock.mockReset();
  });

  it('stores encrypted refresh tokens without persisting access tokens', async () => {
    exchangeCodeMock.mockResolvedValue({
      accessToken: 'access-token',
      expiresIn: 3600,
      refreshToken: 'refresh-token',
      grantedScopes: ['https://www.googleapis.com/auth/business.manage'],
      tokenType: 'Bearer',
      idToken: null,
    });
    fetchIdentityMock.mockResolvedValue({
      providerUserId: null,
      email: null,
      name: null,
    });

    const captured = {
      credentialUpsert: [] as unknown[],
      updates: [] as { table: TableName; payload: unknown }[],
    };
    const client = {
      from: vi.fn((table: TableName) => buildQuery(table, captured)),
    };

    const { completeGoogleBusinessProfileAuthorization } =
      await import('@/server/google-business-profile/service');

    await completeGoogleBusinessProfileAuthorization({
      stateToken: 'state-token',
      code: 'code',
      requestedByUserId: 'user-1',
      client: client as never,
    });

    expect(captured.credentialUpsert).toHaveLength(1);
    expect(captured.credentialUpsert[0]).toMatchObject({
      refresh_token_encrypted: 'enc:refresh-token',
      granted_scopes: ['https://www.googleapis.com/auth/business.manage'],
    });
    expect(captured.credentialUpsert[0]).not.toHaveProperty('access_token_encrypted');
    expect(captured.credentialUpsert[0]).not.toHaveProperty('access_token_expires_at');
  });

  it('rejects OAuth completion for a different initiating user before exchanging the code', async () => {
    const captured = {
      credentialUpsert: [] as unknown[],
      updates: [] as { table: TableName; payload: unknown }[],
    };
    const client = {
      from: vi.fn((table: TableName) => buildQuery(table, captured)),
    };

    const { completeGoogleBusinessProfileAuthorization } =
      await import('@/server/google-business-profile/service');

    await expect(
      completeGoogleBusinessProfileAuthorization({
        stateToken: 'state-token',
        code: 'code',
        requestedByUserId: 'user-2',
        client: client as never,
      }),
    ).rejects.toMatchObject({
      code: 'GBP_INVALID_STATE',
      status: 403,
    });

    expect(exchangeCodeMock).not.toHaveBeenCalled();
    expect(captured.updates).toHaveLength(0);
    expect(captured.credentialUpsert).toHaveLength(0);
  });

  it('rejects OAuth completion for the wrong route restaurant before consuming state', async () => {
    const captured = {
      credentialUpsert: [] as unknown[],
      updates: [] as { table: TableName; payload: unknown }[],
    };
    const client = {
      from: vi.fn((table: TableName) => buildQuery(table, captured)),
    };

    const { completeGoogleBusinessProfileAuthorization } =
      await import('@/server/google-business-profile/service');

    await expect(
      completeGoogleBusinessProfileAuthorization({
        stateToken: 'state-token',
        code: 'code',
        requestedByUserId: 'user-1',
        expectedRestaurantId: 'rest-2',
        client: client as never,
      }),
    ).rejects.toMatchObject({
      code: 'GBP_INVALID_STATE',
      status: 400,
    });

    expect(exchangeCodeMock).not.toHaveBeenCalled();
    expect(captured.updates).toHaveLength(0);
    expect(captured.credentialUpsert).toHaveLength(0);
  });

  it('rejects OAuth completion when the initiating user is no longer an admin', async () => {
    const captured = {
      credentialUpsert: [] as unknown[],
      updates: [] as { table: TableName; payload: unknown }[],
    };
    const client = {
      from: vi.fn((table: TableName) => buildQuery(table, captured, { membership: null })),
    };

    const { completeGoogleBusinessProfileAuthorization } =
      await import('@/server/google-business-profile/service');

    await expect(
      completeGoogleBusinessProfileAuthorization({
        stateToken: 'state-token',
        code: 'code',
        requestedByUserId: 'user-1',
        client: client as never,
      }),
    ).rejects.toMatchObject({
      code: 'GBP_STATE_RESTAURANT_FORBIDDEN',
      status: 403,
    });

    expect(exchangeCodeMock).not.toHaveBeenCalled();
    expect(captured.updates).toHaveLength(0);
    expect(captured.credentialUpsert).toHaveLength(0);
  });
});
