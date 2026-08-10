import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: {
    googleBusinessProfile: {
      clientId: 'client-id',
      clientSecret: 'client-secret',
      redirectUri: 'https://app.example/api/ops/google-business/callback',
      tokenEncryptionKey: 'test-key',
      quotaProject: '23639420332',
      configured: true,
    },
  },
}));

import {
  buildGoogleBusinessProfileAuthUrl,
  buildGoogleBusinessProfileFoodMenusName,
  getGoogleBusinessProfileFoodMenus,
  getGoogleBusinessProfileLocationProfile,
  listGoogleBusinessProfileLocations,
  patchGoogleBusinessProfileLocation,
  updateGoogleBusinessProfileFoodMenus,
} from '@/server/google-business-profile/client';

describe('google business profile client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('retires legacy validateOnly location patches before network dispatch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      patchGoogleBusinessProfileLocation(
        'access-token',
        'locations/123',
        { title: 'Old Crown Girton' },
        ['title'],
        { validateOnly: true },
      ),
    ).rejects.toMatchObject({ code: 'GBP_LEGACY_GOOGLE_WRITE_RETIRED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retires legacy real location patches before network dispatch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ name: 'locations/123', title: 'Old Crown Girton' }), {
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      patchGoogleBusinessProfileLocation(
        'access-token',
        'locations/123',
        { title: 'Old Crown Girton' },
        ['title'],
      ),
    ).rejects.toMatchObject({ code: 'GBP_LEGACY_GOOGLE_WRITE_RETIRED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requests the exact GBP and OIDC scopes for consent', () => {
    const url = new URL(buildGoogleBusinessProfileAuthUrl('state-token', 'nonce-token'));

    expect(url.searchParams.get('scope')).toBe(
      'https://www.googleapis.com/auth/business.manage openid email profile',
    );
    expect(url.searchParams.get('nonce')).toBe('nonce-token');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
  });

  it('builds account-scoped FoodMenus resource names from ids or resource names', () => {
    expect(buildGoogleBusinessProfileFoodMenusName('123', '456')).toBe(
      'accounts/123/locations/456/foodMenus',
    );
    expect(buildGoogleBusinessProfileFoodMenusName('accounts/123', 'locations/456')).toBe(
      'accounts/123/locations/456/foodMenus',
    );
    expect(
      buildGoogleBusinessProfileFoodMenusName('accounts/123', 'accounts/123/locations/456'),
    ).toBe('accounts/123/locations/456/foodMenus');
  });

  it('surfaces Google FoodMenus eligibility from location metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          locations: [
            {
              name: 'locations/456',
              title: 'Old Crown Girton',
              metadata: {
                placeId: 'place-1',
                canHaveFoodMenus: true,
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const locations = await listGoogleBusinessProfileLocations(
      'access-token',
      'accounts/123',
      'Account',
    );

    expect(locations[0]).toMatchObject({
      locationId: '456',
      placeId: 'place-1',
      canHaveFoodMenus: true,
    });
    const [request] = fetchMock.mock.calls[0] as [Request];
    expect(new URL(request.url).searchParams.get('readMask')).toBe(
      'name,title,storefrontAddress,metadata',
    );
  });

  it('reads FoodMenus with an optional top-level readMask', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          name: 'accounts/123/locations/456/foodMenus',
          menus: [],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await getGoogleBusinessProfileFoodMenus(
      'access-token',
      'accounts/123/locations/456/foodMenus',
      { readMask: ['name', 'menus'] },
    );

    expect(result).toEqual({ name: 'accounts/123/locations/456/foodMenus', menus: [] });
    const [request] = fetchMock.mock.calls[0] as [Request];
    const requestUrl = new URL(request.url);
    expect(requestUrl.origin).toBe('https://mybusiness.googleapis.com');
    expect(requestUrl.pathname).toBe('/v4/accounts/123/locations/456/foodMenus');
    expect(requestUrl.searchParams.get('readMask')).toBe('name,menus');
    expect(request.method).toBe('GET');
    expect(request.headers.get('authorization')).toBe('Bearer access-token');
    expect(request.headers.get('x-goog-user-project')).toBe('23639420332');
    expect(request.headers.get('x-goog-api-format-version')).toBe('2');
  });

  it('retires legacy FoodMenus updates before network dispatch', async () => {
    const payload = {
      name: 'accounts/123/locations/456/foodMenus',
      menus: [
        {
          labels: [{ displayName: 'Dinner menu', languageCode: 'en-GB' }],
          sections: [],
        },
      ],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      updateGoogleBusinessProfileFoodMenus('access-token', payload, { updateMask: ['menus'] }),
    ).rejects.toMatchObject({ code: 'GBP_LEGACY_GOOGLE_WRITE_RETIRED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('marks service items unavailable when the optional fetch fails', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            name: 'locations/456',
            title: 'Old Crown Girton',
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: 'upstream_error',
          }),
          { status: 500 },
        ),
      );

    const profile = await getGoogleBusinessProfileLocationProfile('token-1', '456');

    expect(profile.title).toBe('Old Crown Girton');
    expect(profile.__nabatableOptionalFetchStatus?.serviceItems).toBe('unavailable');
    expect(Object.prototype.hasOwnProperty.call(profile, 'serviceItems')).toBe(false);
  });

  it('marks service items fetched when Google returns an explicit empty segment', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            name: 'locations/456',
            title: 'Old Crown Girton',
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            serviceItems: [],
          }),
          { status: 200 },
        ),
      );

    const profile = await getGoogleBusinessProfileLocationProfile('token-1', '456');

    expect(profile.__nabatableOptionalFetchStatus?.serviceItems).toBe('fetched');
    expect(profile.serviceItems).toEqual([]);
  });
});
