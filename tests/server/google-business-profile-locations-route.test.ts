import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolveRestaurantIdMock = vi.hoisted(() => vi.fn());
const ensureRestaurantAdminAccessMock = vi.hoisted(() => vi.fn());
const getAvailableLocationsMock = vi.hoisted(() => vi.fn());
const requireBudgetMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/ops/restaurants/[id]/_shared', () => ({
  resolveRestaurantId: resolveRestaurantIdMock,
  ensureRestaurantAdminAccess: ensureRestaurantAdminAccessMock,
}));
vi.mock('@/server/google-business-profile/service', () => ({
  getGoogleBusinessProfileAvailableLocations: getAvailableLocationsMock,
}));
vi.mock('@/server/security/provider-rate-limit', () => ({
  requireProviderRefreshBudget: requireBudgetMock,
}));

import { GET } from '@/app/api/ops/restaurants/[id]/google-business-profile/locations/route';

describe('Google Business Profile locations route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({
      userId: 'user-1',
      userEmail: 'owner@example.test',
    });
    requireBudgetMock.mockResolvedValue(null);
    getAvailableLocationsMock.mockResolvedValue([]);
  });

  it('lists available locations through the canonical admin-scoped no-store route', async () => {
    getAvailableLocationsMock.mockResolvedValueOnce([
      { locationName: 'locations/456', title: 'Old Crown' },
    ]);

    const response = await GET(
      new NextRequest(
        'https://example.test/api/ops/restaurants/rest-1/google-business-profile/locations',
      ),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('private');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(ensureRestaurantAdminAccessMock).toHaveBeenCalledWith(
      'rest-1',
      'google-business-profile-locations',
    );
    expect(requireBudgetMock).toHaveBeenCalledWith({
      provider: 'google_business_profile',
      restaurantId: 'rest-1',
      action: 'location-discovery-read',
      limit: 30,
    });
    expect(getAvailableLocationsMock).toHaveBeenCalledWith('rest-1', undefined, {
      forceRefresh: false,
    });
    await expect(response.json()).resolves.toEqual({
      locations: [{ locationName: 'locations/456', title: 'Old Crown' }],
    });
  });

  it('preserves private no-store headers when admin access is denied', async () => {
    ensureRestaurantAdminAccessMock.mockResolvedValueOnce(
      NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    );

    const response = await GET(new NextRequest('https://example.test'), {
      params: Promise.resolve({ id: 'rest-1' }),
    });

    expect(response.status).toBe(403);
    expect(response.headers.get('cache-control')).toContain('private');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(requireBudgetMock).not.toHaveBeenCalled();
    expect(getAvailableLocationsMock).not.toHaveBeenCalled();
  });

  it('passes an explicit refresh through the existing discovery budget and service behavior', async () => {
    const response = await GET(new NextRequest('https://example.test?refresh=1'), {
      params: Promise.resolve({ id: 'rest-1' }),
    });

    expect(response.status).toBe(200);
    expect(requireBudgetMock).toHaveBeenCalledWith({
      provider: 'google_business_profile',
      restaurantId: 'rest-1',
      action: 'location-discovery-refresh',
      limit: undefined,
    });
    expect(getAvailableLocationsMock).toHaveBeenCalledWith('rest-1', undefined, {
      forceRefresh: true,
    });
  });

  it('returns a safe no-store error without reflecting provider failures', async () => {
    getAvailableLocationsMock.mockRejectedValueOnce(
      new Error('provider secret account and access token'),
    );

    const response = await GET(new NextRequest('https://example.test'), {
      params: Promise.resolve({ id: 'rest-1' }),
    });
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(body).toEqual({
      error: 'Unable to list Google Business Profile locations.',
      code: 'GBP_LOCATION_DISCOVERY_FAILED',
    });
    expect(JSON.stringify(body)).not.toContain('provider secret');
  });
});
