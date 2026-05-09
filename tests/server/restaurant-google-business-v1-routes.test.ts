import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ensureRestaurantAdminAccessMock = vi.hoisted(() => vi.fn());
const resolveRestaurantIdMock = vi.hoisted(() => vi.fn());
const createAuthorizationUrlMock = vi.hoisted(() => vi.fn());
const getBusinessDetailsStatusMock = vi.hoisted(() => vi.fn());
const getConnectionStateMock = vi.hoisted(() => vi.fn());
const getAvailableLocationsMock = vi.hoisted(() => vi.fn());
const linkLocationMock = vi.hoisted(() => vi.fn());
const syncBusinessInfoMock = vi.hoisted(() => vi.fn());
const disconnectConnectionMock = vi.hoisted(() => vi.fn());
const requireProviderRefreshBudgetMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/ops/restaurants/[id]/_shared', () => ({
  ensureRestaurantAdminAccess: ensureRestaurantAdminAccessMock,
  resolveRestaurantId: resolveRestaurantIdMock,
}));

vi.mock('@/server/google-business-profile/service', () => ({
  createGoogleBusinessProfileAuthorizationUrl: createAuthorizationUrlMock,
  disconnectGoogleBusinessProfileConnection: disconnectConnectionMock,
  getGoogleBusinessProfileAvailableLocations: getAvailableLocationsMock,
  getGoogleBusinessProfileBusinessDetailsStatus: getBusinessDetailsStatusMock,
  getGoogleBusinessProfileConnectionState: getConnectionStateMock,
  linkGoogleBusinessProfileLocation: linkLocationMock,
  syncGoogleBusinessProfileBusinessInformation: syncBusinessInfoMock,
}));

vi.mock('@/server/security/provider-rate-limit', () => ({
  requireProviderRefreshBudget: requireProviderRefreshBudgetMock,
}));

import { POST as callbackConnectPOST } from '@/src/app/api/ops/restaurants/[id]/google-business/connect/route';
import { GET as locationsGET } from '@/src/app/api/ops/restaurants/[id]/google-business/locations/route';
import { POST as selectLocationPOST } from '@/src/app/api/ops/restaurants/[id]/google-business/locations/select/route';
import {
  DELETE as statusDELETE,
  GET as statusGET,
} from '@/src/app/api/ops/restaurants/[id]/google-business/route';
import { POST as syncPOST } from '@/src/app/api/ops/restaurants/[id]/google-business/sync/route';

const routeContext = { params: Promise.resolve({ id: 'rest-1' }) };

describe('restaurant google business V1 routes', () => {
  beforeEach(() => {
    ensureRestaurantAdminAccessMock.mockReset();
    resolveRestaurantIdMock.mockReset().mockResolvedValue('rest-1');
    createAuthorizationUrlMock.mockReset();
    getBusinessDetailsStatusMock.mockReset();
    getConnectionStateMock.mockReset();
    getAvailableLocationsMock.mockReset();
    linkLocationMock.mockReset();
    syncBusinessInfoMock.mockReset();
    disconnectConnectionMock.mockReset();
    requireProviderRefreshBudgetMock.mockReset().mockResolvedValue(null);
    ensureRestaurantAdminAccessMock.mockResolvedValue({
      userId: 'user-1',
      userEmail: 'owner@example.com',
    });
  });

  it('requires ops admin access for status reads', async () => {
    ensureRestaurantAdminAccessMock.mockResolvedValue(
      NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
    );

    const response = await statusGET(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/google-business'),
      routeContext,
    );

    expect(response.status).toBe(401);
    expect(getBusinessDetailsStatusMock).not.toHaveBeenCalled();
  });

  it('returns V1 status with advisory diffs', async () => {
    getBusinessDetailsStatusMock.mockResolvedValue({
      connection: { status: 'connected' },
      selectedLocation: { title: 'Old Crown Girton' },
      lastSync: { pulledAt: '2026-04-28T12:00:00.000Z', pushedAt: null },
      fieldDiffs: [{ field: 'name', status: 'matches' }],
      availableLocations: [],
    });

    const response = await statusGET(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/google-business'),
      routeContext,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      connection: { status: 'connected' },
      fieldDiffs: [{ field: 'name', status: 'matches' }],
    });
  });

  it('creates OAuth state and returns the Google consent URL', async () => {
    createAuthorizationUrlMock.mockResolvedValue('https://accounts.google.com/o/oauth2/v2/auth');

    const response = await callbackConnectPOST(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/google-business/connect', {
        method: 'POST',
      }),
      routeContext,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    });
    expect(createAuthorizationUrlMock).toHaveBeenCalledWith({
      restaurantId: 'rest-1',
      requestedByUserId: 'user-1',
      returnPath: 'https://example.com/app/settings/restaurant/google-business-profile',
    });
  });

  it('lists available GBP locations', async () => {
    getAvailableLocationsMock.mockResolvedValue([
      { locationName: 'locations/456', title: 'Old Crown' },
    ]);

    const response = await locationsGET(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/google-business/locations'),
      routeContext,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      locations: [{ locationName: 'locations/456', title: 'Old Crown' }],
    });
    expect(getAvailableLocationsMock).toHaveBeenCalledWith('rest-1', undefined, {
      forceRefresh: false,
    });
    expect(requireProviderRefreshBudgetMock).not.toHaveBeenCalled();
  });

  it('returns frontend-readable messages for location discovery failures', async () => {
    getAvailableLocationsMock.mockRejectedValue(new Error('Google locations unavailable'));

    const response = await locationsGET(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/google-business/locations'),
      routeContext,
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      message: 'Google locations unavailable',
      error: 'Google locations unavailable',
      code: 'GBP_ERROR',
    });
  });

  it('rate-limits explicit GBP location refreshes', async () => {
    getAvailableLocationsMock.mockResolvedValue([]);

    const response = await locationsGET(
      new NextRequest(
        'https://example.com/api/ops/restaurants/rest-1/google-business/locations?refresh=1',
      ),
      routeContext,
    );

    expect(response.status).toBe(200);
    expect(requireProviderRefreshBudgetMock).toHaveBeenCalledWith({
      provider: 'google_business_profile',
      restaurantId: 'rest-1',
      action: 'location-discovery',
    });
    expect(getAvailableLocationsMock).toHaveBeenCalledWith('rest-1', undefined, {
      forceRefresh: true,
    });
  });

  it('selects a location and syncs a read-only snapshot', async () => {
    getBusinessDetailsStatusMock.mockResolvedValue({
      connection: { status: 'connected' },
      selectedLocation: { locationId: '456' },
      fieldDiffs: [],
    });

    const response = await selectLocationPOST(
      new NextRequest(
        'https://example.com/api/ops/restaurants/rest-1/google-business/locations/select',
        {
          method: 'POST',
          body: JSON.stringify({
            accountName: 'accounts/123',
            accountId: '123',
            locationName: 'locations/456',
            locationId: '456',
          }),
        },
      ),
      routeContext,
    );

    expect(response.status).toBe(200);
    expect(linkLocationMock).toHaveBeenCalledWith('rest-1', {
      accountName: 'accounts/123',
      accountId: '123',
      locationName: 'locations/456',
      locationId: '456',
    });
    expect(syncBusinessInfoMock).toHaveBeenCalledWith('rest-1', undefined, {
      runKind: 'location_selection',
    });
  });

  it('syncs manually without requiring a password payload', async () => {
    getBusinessDetailsStatusMock.mockResolvedValue({
      connection: { status: 'connected' },
      fieldDiffs: [],
    });

    const response = await syncPOST(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/google-business/sync', {
        method: 'POST',
      }),
      routeContext,
    );

    expect(response.status).toBe(200);
    expect(requireProviderRefreshBudgetMock).toHaveBeenCalledWith({
      provider: 'google_business_profile',
      restaurantId: 'rest-1',
      action: 'business-info-sync',
    });
    expect(syncBusinessInfoMock).toHaveBeenCalledWith('rest-1');
  });

  it('disconnects and returns the refreshed V1 status', async () => {
    getBusinessDetailsStatusMock.mockResolvedValue({
      connection: { status: 'not_connected' },
      selectedLocation: null,
      fieldDiffs: [],
    });

    const response = await statusDELETE(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/google-business', {
        method: 'DELETE',
      }),
      routeContext,
    );

    expect(response.status).toBe(200);
    expect(disconnectConnectionMock).toHaveBeenCalledWith('rest-1');
  });
});
