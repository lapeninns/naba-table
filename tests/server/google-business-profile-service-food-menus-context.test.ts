import { beforeEach, describe, expect, it, vi } from 'vitest';

const getLinkedExternalProfileWithLocationMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/google-business-profile/client', () => ({
  buildGoogleBusinessProfileFoodMenusName: vi.fn(
    (accountNameOrId: string, locationNameOrId: string) =>
      `${accountNameOrId}/${locationNameOrId.replace(/^locations\//, 'locations/')}/foodMenus`,
  ),
}));

vi.mock('@/server/google-business-profile/serviceLinkedLocationRuntime', () => ({
  getLinkedExternalProfileWithLocation: getLinkedExternalProfileWithLocationMock,
}));

describe('google business profile service FoodMenus context', () => {
  beforeEach(() => {
    getLinkedExternalProfileWithLocationMock.mockReset();
  });

  it('builds FoodMenus context from the linked profile and fetched location', async () => {
    getLinkedExternalProfileWithLocationMock.mockResolvedValue({
      externalProfile: {
        id: 'external-profile-1',
        external_account_id: '123',
        external_account_name: 'accounts/123',
        push_enabled: true,
      },
      accessToken: 'access-token',
      locationResourceName: 'locations/456',
      location: {
        name: 'locations/456',
        metadata: { canHaveFoodMenus: true },
      },
    });

    const { getGoogleBusinessProfileFoodMenusContext } =
      await import('@/server/google-business-profile/serviceFoodMenusContext');

    await expect(
      getGoogleBusinessProfileFoodMenusContext({
        restaurantId: 'rest-1',
        client: {} as never,
        requirePushEnabled: true,
      }),
    ).resolves.toEqual({
      externalProfileId: 'external-profile-1',
      accessToken: 'access-token',
      foodMenusName: 'accounts/123/locations/456/foodMenus',
      canHaveFoodMenus: true,
    });
  });

  it('keeps the push-enabled guard for callers that require push', async () => {
    getLinkedExternalProfileWithLocationMock.mockResolvedValue({
      externalProfile: {
        id: 'external-profile-1',
        external_account_id: '123',
        external_account_name: 'accounts/123',
        push_enabled: false,
      },
      accessToken: 'access-token',
      locationResourceName: 'locations/456',
      location: {
        name: 'locations/456',
        metadata: { canHaveFoodMenus: true },
      },
    });

    const { getGoogleBusinessProfileFoodMenusContext } =
      await import('@/server/google-business-profile/serviceFoodMenusContext');

    await expect(
      getGoogleBusinessProfileFoodMenusContext({
        restaurantId: 'rest-1',
        client: {} as never,
        requirePushEnabled: true,
      }),
    ).rejects.toMatchObject({
      code: 'GBP_GOOGLE_PUSH_DISABLED',
      status: 409,
    });
  });
});
