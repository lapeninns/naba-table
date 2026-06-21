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

  it('adds validateOnly alongside updateMask for dry-run location patches', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await patchGoogleBusinessProfileLocation(
      'access-token',
      'locations/123',
      { title: 'Old Crown Girton' },
      ['title'],
      { validateOnly: true },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const requestUrl = new URL(url);
    expect(requestUrl.pathname).toBe('/v1/locations/123');
    expect(requestUrl.searchParams.get('updateMask')).toBe('title');
    expect(requestUrl.searchParams.get('validateOnly')).toBe('true');
    expect(init.method).toBe('PATCH');
    expect(init.body).toBe(JSON.stringify({ title: 'Old Crown Girton' }));
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer access-token',
      'Content-Type': 'application/json',
      'X-Goog-User-Project': '23639420332',
    });
  });

  it('omits validateOnly for real location patches', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ name: 'locations/123', title: 'Old Crown Girton' }), {
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await patchGoogleBusinessProfileLocation(
      'access-token',
      'locations/123',
      { title: 'Old Crown Girton' },
      ['title'],
    );

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    const requestUrl = new URL(url);
    expect(requestUrl.searchParams.get('updateMask')).toBe('title');
    expect(requestUrl.searchParams.has('validateOnly')).toBe(false);
  });

  it('requests only the business.manage OAuth scope for GBP consent', () => {
    const url = new URL(buildGoogleBusinessProfileAuthUrl('state-token'));

    expect(url.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/business.manage');
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
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).searchParams.get('readMask')).toBe('name,title,storefrontAddress,metadata');
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
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const requestUrl = new URL(url);
    expect(requestUrl.origin).toBe('https://mybusiness.googleapis.com');
    expect(requestUrl.pathname).toBe('/v4/accounts/123/locations/456/foodMenus');
    expect(requestUrl.searchParams.get('readMask')).toBe('name,menus');
    expect(init.method).toBeUndefined();
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer access-token',
      'Content-Type': 'application/json',
      'X-Goog-User-Project': '23639420332',
    });
  });

  it('updates FoodMenus with a top-level menus updateMask', async () => {
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

    await updateGoogleBusinessProfileFoodMenus('access-token', payload, { updateMask: ['menus'] });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const requestUrl = new URL(url);
    expect(requestUrl.pathname).toBe('/v4/accounts/123/locations/456/foodMenus');
    expect(requestUrl.searchParams.get('updateMask')).toBe('menus');
    expect(init.method).toBe('PATCH');
    expect(init.body).toBe(JSON.stringify(payload));
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer access-token',
      'Content-Type': 'application/json',
      'X-Goog-User-Project': '23639420332',
    });
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
