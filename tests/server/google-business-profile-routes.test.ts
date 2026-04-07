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

vi.mock('@/lib/env', () => ({
  env: {
    app: {
      url: 'https://www.nabatable.com',
    },
  },
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
      returnTo: '/settings/restaurant/profile',
    });
    expect(payload.authorizationUrl).toContain('accounts.google.com');
  });

  it('syncs the selected Google location for the restaurant', async () => {
    syncProfileMock.mockResolvedValue({
      connected: true,
      status: 'synced',
      locationId: '987654321',
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
    expect(payload.status).toBe('synced');
  });

  it('refreshes the location catalog and deletes the connection', async () => {
    refreshCatalogMock.mockResolvedValue({
      connected: true,
      status: 'connected',
      availableLocations: [],
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
      returnTo: '/settings/restaurant/profile',
      issuedAt: Date.now(),
    });
    connectProfileMock.mockResolvedValue(undefined);

    const response = await callbackRoute(
      new NextRequest('https://www.nabatable.com/api/ops/google-business-profile/callback?code=test-code&state=signed-state'),
    );

    expect(connectProfileMock).toHaveBeenCalledWith('rest-1', 'test-code', { kind: 'service-client' });
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://www.nabatable.com/settings/restaurant/profile?googleBusinessProfile=connected',
    );
  });
});
