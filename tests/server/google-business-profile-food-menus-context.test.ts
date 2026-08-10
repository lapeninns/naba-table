import { beforeEach, describe, expect, it, vi } from 'vitest';

const refreshGoogleBusinessProfileAccessTokenMock = vi.hoisted(() => vi.fn());
const getGoogleBusinessProfileLocationProfileMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/google-business-profile/client', () => ({
  buildGoogleBusinessProfileAuthUrl: vi.fn(),
  buildGoogleBusinessProfileFoodMenusName: vi.fn(
    (accountNameOrId: string, locationNameOrId: string) =>
      `${accountNameOrId}/${locationNameOrId.replace(/^locations\//, 'locations/')}/foodMenus`,
  ),
  exchangeGoogleBusinessProfileCode: vi.fn(),
  fetchGoogleBusinessProfileIdentity: vi.fn(),
  getGoogleBusinessProfileLocationAttributes: vi.fn(),
  getGoogleBusinessProfileLocationProfile: getGoogleBusinessProfileLocationProfileMock,
  listGoogleBusinessProfileAccounts: vi.fn(),
  listGoogleBusinessProfileLocations: vi.fn(),
  parseGoogleLocationId: vi.fn((name: string) => name.split('/').at(-1) ?? name),
  patchGoogleBusinessProfileLocation: vi.fn(),
  refreshGoogleBusinessProfileAccessToken: refreshGoogleBusinessProfileAccessTokenMock,
  revokeGoogleBusinessProfileToken: vi.fn(),
  updateGoogleBusinessProfileLocationAttributes: vi.fn(),
}));

vi.mock('@/server/google-business-profile/crypto', () => ({
  decryptGoogleBusinessProfileSecret: vi.fn((value: string) => value.replace(/^enc:/, '')),
  decryptGoogleBusinessProfileSecretWithMetadata: vi.fn((value: string) => ({
    plaintext: value.replace(/^enc:/, ''),
    keyId: 'active',
    requiresRewrap: false,
  })),
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
  | string;

function makeQuery(table: TableName) {
  const profile = {
    id: 'external-profile-1',
    restaurant_id: 'rest-1',
    provider: 'google_business_profile',
    connection_status: 'linked',
    external_account_id: '123',
    external_account_name: 'accounts/123',
    external_location_id: '456',
    external_location_name: 'locations/456',
    external_resource_name: 'locations/456',
    external_profile_id: null,
    connection_generation: 1,
    consent_epoch: 1,
    updated_at: new Date().toISOString(),
    push_enabled: true,
  };
  const credential = {
    external_profile_id: 'external-profile-1',
    refresh_token_encrypted: 'enc:refresh-token',
    granted_scopes: ['https://www.googleapis.com/auth/business.manage'],
    token_type: 'Bearer',
  };
  const query = {
    select: vi.fn(() => query),
    update: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => {
      if (table === 'restaurant_external_profiles') return { data: profile, error: null };
      if (table === 'restaurant_external_profile_credentials') {
        return { data: credential, error: null };
      }
      return { data: null, error: null };
    }),
    then: (resolve: (value: { data: null; error: null }) => unknown) =>
      Promise.resolve(resolve({ data: null, error: null })),
  };
  return query;
}

describe('Google Business Profile FoodMenus context', () => {
  beforeEach(() => {
    refreshGoogleBusinessProfileAccessTokenMock.mockReset();
    getGoogleBusinessProfileLocationProfileMock.mockReset();
    refreshGoogleBusinessProfileAccessTokenMock.mockResolvedValue({
      accessToken: 'access-token',
      expiresIn: 3600,
      refreshToken: null,
      grantedScopes: ['https://www.googleapis.com/auth/business.manage'],
      tokenType: 'Bearer',
      idToken: null,
    });
  });

  it('returns FoodMenus eligibility from the linked Google location metadata', async () => {
    getGoogleBusinessProfileLocationProfileMock.mockResolvedValue({
      name: 'locations/456',
      metadata: { canHaveFoodMenus: true },
    });
    const client = {
      from: vi.fn((table: TableName) => makeQuery(table)),
      rpc: vi.fn(async () => ({
        data: {
          external_profile_id: 'external-profile-1',
          refresh_token_encrypted: 'enc:refresh-token',
          granted_scopes: ['https://www.googleapis.com/auth/business.manage'],
          token_type: 'Bearer',
        },
        error: null,
      })),
    };
    const { getGoogleBusinessProfileFoodMenusContext } =
      await import('@/server/google-business-profile/service');

    const context = await getGoogleBusinessProfileFoodMenusContext({
      client,
      restaurantId: 'rest-1',
      requirePushEnabled: true,
    });

    expect(context).toMatchObject({
      externalProfileId: 'external-profile-1',
      accessToken: 'access-token',
      foodMenusName: 'accounts/123/locations/456/foodMenus',
      canHaveFoodMenus: true,
    });
  });

  it('blocks FoodMenus context when Google marks the location as ineligible', async () => {
    getGoogleBusinessProfileLocationProfileMock.mockResolvedValue({
      name: 'locations/456',
      metadata: { canHaveFoodMenus: false },
    });
    const client = {
      from: vi.fn((table: TableName) => makeQuery(table)),
      rpc: vi.fn(async () => ({
        data: {
          external_profile_id: 'external-profile-1',
          refresh_token_encrypted: 'enc:refresh-token',
          granted_scopes: ['https://www.googleapis.com/auth/business.manage'],
          token_type: 'Bearer',
        },
        error: null,
      })),
    };
    const { getGoogleBusinessProfileFoodMenusContext } =
      await import('@/server/google-business-profile/service');

    await expect(
      getGoogleBusinessProfileFoodMenusContext({
        client,
        restaurantId: 'rest-1',
      }),
    ).rejects.toMatchObject({
      code: 'GBP_FOOD_MENUS_NOT_ELIGIBLE',
      status: 409,
    });
  });
});
