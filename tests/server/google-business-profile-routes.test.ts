import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUserMock = vi.hoisted(() => vi.fn());
const requireAdminMembershipMock = vi.hoisted(() => vi.fn());
const getStatusMock = vi.hoisted(() => vi.fn());
const refreshCatalogMock = vi.hoisted(() => vi.fn());
const removeProfileMock = vi.hoisted(() => vi.fn());
const buildAuthorizationUrlMock = vi.hoisted(() => vi.fn());
const syncProfileMock = vi.hoisted(() => vi.fn());
const verifyStateMock = vi.hoisted(() => vi.fn());
const connectProfileMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: vi.fn(async () => ({
    auth: {
      getUser: getUserMock,
    },
  })),
  getServiceSupabaseClient: vi.fn(() => ({ kind: 'service-client' })),
}));

vi.mock('@/server/team/access', () => ({
  requireAdminMembership: requireAdminMembershipMock,
}));

vi.mock('@/server/google-business-profile/service', () => ({
  getRestaurantGoogleBusinessProfileStatus: getStatusMock,
  refreshRestaurantGoogleBusinessProfileCatalog: refreshCatalogMock,
  removeRestaurantGoogleBusinessProfile: removeProfileMock,
  syncRestaurantGoogleBusinessProfile: syncProfileMock,
  connectRestaurantGoogleBusinessProfile: connectProfileMock,
}));

vi.mock('@/server/google-business-profile/oauth', () => ({
  buildGoogleBusinessProfileAuthorizationUrl: buildAuthorizationUrlMock,
}));

vi.mock('@/server/google-business-profile/crypto', () => ({
  verifyGoogleBusinessProfileState: verifyStateMock,
}));

import { GET as callbackRoute } from '@/src/app/api/ops/google-business-profile/callback/route';
import { POST as connectRoute } from '@/src/app/api/ops/restaurants/[id]/google-business-profile/connect/route';
import { GET as getStatusRoute, POST as refreshStatusRoute, DELETE as deleteStatusRoute } from '@/src/app/api/ops/restaurants/[id]/google-business-profile/route';
import { POST as syncRoute } from '@/src/app/api/ops/restaurants/[id]/google-business-profile/sync/route';

function buildRestaurantParams() {
  return {
    params: Promise.resolve({
      id: 'rest-1',
    }),
  };
}

describe('google business profile ops routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: 'ops@example.com',
        },
      },
      error: null,
    });
    requireAdminMembershipMock.mockResolvedValue(undefined);
  });

  it('returns current Google Business Profile status for a restaurant', async () => {
    getStatusMock.mockResolvedValue({
      connected: false,
      status: 'disconnected',
      availableLocations: [],
      latestChangeSummary: null,
      syncHistory: [],
    });

    const response = await getStatusRoute(
      new NextRequest('https://www.nabatable.com/api/ops/restaurants/rest-1/google-business-profile'),
      buildRestaurantParams(),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(getStatusMock).toHaveBeenCalledWith('rest-1', { kind: 'service-client' });
    expect(payload.status).toBe('disconnected');
  });

  it('starts the connect flow and returns the authorization URL', async () => {
    buildAuthorizationUrlMock.mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?state=test');

    const response = await connectRoute(
      new Request('https://www.nabatable.com/api/ops/restaurants/rest-1/google-business-profile/connect', {
        method: 'POST',
      }),
      buildRestaurantParams(),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(buildAuthorizationUrlMock).toHaveBeenCalledWith({
      restaurantId: 'rest-1',
      returnTo: '/settings/restaurant/google-business-profile',
      returnOrigin: 'https://www.nabatable.com',
    });
    expect(payload.authorizationUrl).toContain('accounts.google.com');
  });

  it('uses the app.localhost callback URI when the connect flow starts on the app host', async () => {
    buildAuthorizationUrlMock.mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?state=test');

    const response = await connectRoute(
      new NextRequest('http://localhost:3000/api/ops/restaurants/rest-1/google-business-profile/connect', {
        method: 'POST',
        headers: {
          host: 'app.localhost:3000',
          'x-forwarded-host': 'app.localhost:3000',
          'x-forwarded-proto': 'http',
        },
      }),
      buildRestaurantParams(),
    );

    expect(response.status).toBe(200);
    expect(buildAuthorizationUrlMock).toHaveBeenCalledWith({
      restaurantId: 'rest-1',
      returnTo: '/settings/restaurant/google-business-profile',
      returnOrigin: 'http://app.localhost:3000',
    });
  });

  it('syncs the selected Google location for the restaurant', async () => {
    syncProfileMock.mockResolvedValue({
      connected: true,
      status: 'partial',
      locationId: '987654321',
      syncFamilies: [
        {
          key: 'location',
          label: 'Location details',
          status: 'success',
          error: null,
          updatedAt: '2026-04-08T09:30:00Z',
        },
        {
          key: 'performance',
          label: 'Performance',
          status: 'failed',
          error: 'Request contains an invalid argument.',
          updatedAt: '2026-04-08T09:30:00Z',
        },
      ],
      latestChangeSummary: {
        generatedAt: '2026-04-08T09:30:00Z',
        hasBaseline: true,
        totalChanges: 2,
        remainingChanges: 0,
        highlights: [
          {
            key: 'reviewCount',
            label: 'Review count',
            family: 'reviews',
            kind: 'updated',
            before: '398',
            after: '412',
          },
          {
            key: 'serviceItems',
            label: 'Service items',
            family: 'attributes',
            kind: 'updated',
            before: 'Takeout',
            after: 'Delivery | Takeout',
          },
        ],
      },
      syncHistory: [
        {
          id: 'sync-1',
          trigger: 'manual',
          accountId: '1234567890',
          accountName: 'Lapen Inns',
          locationId: '987654321',
          locationName: 'locations/987654321',
          locationTitle: 'The Old Crown Girton',
          startedAt: '2026-04-08T09:28:00Z',
          completedAt: '2026-04-08T09:30:00Z',
          status: 'partial',
          error: 'Partial sync completed. Performance: Request contains an invalid argument.',
          syncFamilies: [
            {
              key: 'location',
              label: 'Location details',
              status: 'success',
              error: null,
              updatedAt: '2026-04-08T09:30:00Z',
            },
            {
              key: 'performance',
              label: 'Performance',
              status: 'failed',
              error: 'Request contains an invalid argument.',
              updatedAt: '2026-04-08T09:30:00Z',
            },
          ],
        },
      ],
    });

    const response = await syncRoute(
      new Request('https://www.nabatable.com/api/ops/restaurants/rest-1/google-business-profile/sync', {
        method: 'POST',
        body: JSON.stringify({
          accountId: '1234567890',
          locationId: '987654321',
        }),
      }),
      buildRestaurantParams(),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(syncProfileMock).toHaveBeenCalledWith(
      {
        restaurantId: 'rest-1',
        accountId: '1234567890',
        locationId: '987654321',
      },
      { kind: 'service-client' },
    );
    expect(payload.status).toBe('partial');
    expect(payload.syncFamilies).toHaveLength(2);
    expect(payload.latestChangeSummary.totalChanges).toBe(2);
    expect(payload.syncHistory).toHaveLength(1);
  });

  it('refreshes the location catalog and deletes the connection', async () => {
    refreshCatalogMock.mockResolvedValue({
      connected: true,
      status: 'connected',
      availableLocations: [],
      latestChangeSummary: null,
      syncHistory: [],
    });
    removeProfileMock.mockResolvedValue(undefined);

    const refreshResponse = await refreshStatusRoute(
      new NextRequest('https://www.nabatable.com/api/ops/restaurants/rest-1/google-business-profile', {
        method: 'POST',
      }),
      buildRestaurantParams(),
    );
    const deleteResponse = await deleteStatusRoute(
      new NextRequest('https://www.nabatable.com/api/ops/restaurants/rest-1/google-business-profile', {
        method: 'DELETE',
      }),
      buildRestaurantParams(),
    );

    expect(refreshResponse.status).toBe(200);
    expect(deleteResponse.status).toBe(200);
    expect(removeProfileMock).toHaveBeenCalledWith('rest-1', { kind: 'service-client' });
  });

  it('completes the OAuth callback and redirects back to the profile settings page', async () => {
    verifyStateMock.mockReturnValue({
      restaurantId: 'rest-1',
      returnTo: '/settings/restaurant/google-business-profile',
      issuedAt: Date.now(),
      redirectUri: 'http://localhost:3000/api/ops/google-business-profile/callback',
      returnOrigin: 'http://app.localhost:3000',
    });
    connectProfileMock.mockResolvedValue(undefined);

    const response = await callbackRoute(
      new NextRequest('http://localhost:3000/api/ops/google-business-profile/callback?code=test-code&state=signed-state', {
        headers: {
          host: 'app.localhost:3000',
          'x-forwarded-host': 'app.localhost:3000',
          'x-forwarded-proto': 'http',
        },
      }),
    );

    expect(connectProfileMock).toHaveBeenCalledWith('rest-1', 'test-code', { kind: 'service-client' }, {
      redirectUri: 'http://localhost:3000/api/ops/google-business-profile/callback',
    });
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://app.localhost:3000/settings/restaurant/google-business-profile?googleBusinessProfile=connected',
    );
  });

  it('allows the localhost callback to finish locally without a shared app.localhost session', async () => {
    verifyStateMock.mockReturnValue({
      restaurantId: 'rest-1',
      returnTo: '/settings/restaurant/google-business-profile',
      issuedAt: Date.now(),
      redirectUri: 'http://localhost:3000/api/ops/google-business-profile/callback',
      returnOrigin: 'http://app.localhost:3000',
    });
    getUserMock.mockResolvedValue({
      data: {
        user: null,
      },
      error: null,
    });
    connectProfileMock.mockResolvedValue(undefined);

    const response = await callbackRoute(
      new NextRequest('http://localhost:3000/api/ops/google-business-profile/callback?code=test-code&state=signed-state'),
    );

    expect(requireAdminMembershipMock).not.toHaveBeenCalled();
    expect(connectProfileMock).toHaveBeenCalledWith('rest-1', 'test-code', { kind: 'service-client' }, {
      redirectUri: 'http://localhost:3000/api/ops/google-business-profile/callback',
    });
    expect(response.headers.get('location')).toBe(
      'http://app.localhost:3000/settings/restaurant/google-business-profile?googleBusinessProfile=connected',
    );
  });

  it('surfaces actionable callback errors when GBP storage is not ready', async () => {
    verifyStateMock.mockReturnValue({
      restaurantId: 'rest-1',
      returnTo: '/settings/restaurant/google-business-profile',
      issuedAt: Date.now(),
      redirectUri: 'http://localhost:3000/api/ops/google-business-profile/callback',
      returnOrigin: 'http://app.localhost:3000',
    });
    connectProfileMock.mockRejectedValue(
      new Error(
        'Google Business Profile storage is not ready in the active Supabase project. Apply the pending restaurant_google_business_profiles migration and retry.',
      ),
    );

    const response = await callbackRoute(
      new NextRequest('http://localhost:3000/api/ops/google-business-profile/callback?code=test-code&state=signed-state'),
    );

    expect(response.headers.get('location')).toBe(
      'http://app.localhost:3000/settings/restaurant/google-business-profile?googleBusinessProfile=error&message=Google+Business+Profile+storage+is+not+ready+in+the+active+Supabase+project.+Apply+the+pending+restaurant_google_business_profiles+migration+and+retry.',
    );
  });
});
