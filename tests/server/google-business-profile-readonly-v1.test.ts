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
  | 'restaurant_external_profile_oauth_states';

function buildQuery(table: TableName, captured: { credentialUpsert: unknown[] }) {
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
  };

  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => {
      if (table === 'restaurant_external_profiles') {
        return { data: profile, error: null };
      }
      if (table === 'restaurant_external_profile_oauth_states') {
        return { data: oauthState, error: null };
      }
      return { data: null, error: null };
    }),
    update: vi.fn(() => query),
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

    const captured = { credentialUpsert: [] as unknown[] };
    const client = {
      from: vi.fn((table: TableName) => buildQuery(table, captured)),
    };

    const { completeGoogleBusinessProfileAuthorization } =
      await import('@/server/google-business-profile/service');

    await completeGoogleBusinessProfileAuthorization({
      stateToken: 'state-token',
      code: 'code',
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
});
