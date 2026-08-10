import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolveRestaurantIdMock = vi.hoisted(() => vi.fn(async () => 'rest-1'));
const ensureRestaurantAdminAccessMock = vi.hoisted(() => vi.fn());
const getConnectionMock = vi.hoisted(() => vi.fn());
const requireBudgetMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/ops/restaurants/[id]/_shared', () => ({
  resolveRestaurantId: resolveRestaurantIdMock,
  ensureRestaurantAdminAccess: ensureRestaurantAdminAccessMock,
}));
vi.mock('@/server/google-business-profile/service', () => ({
  getGoogleBusinessProfileConnectionState: getConnectionMock,
}));
vi.mock('@/server/security/provider-rate-limit', () => ({
  requireProviderRefreshBudget: requireBudgetMock,
}));

import { GET } from '@/app/api/ops/restaurants/[id]/google-business-profile/details/route';

const legacyDetails = {
  isConfigured: true,
  provider: 'google_business_profile',
  status: 'linked',
  pushEnabled: false,
  connectedGoogleEmail: 'owner@example.test',
  connectedGoogleName: 'Owner',
  externalAccountId: 'account-1',
  externalAccountName: 'Account',
  externalLocationId: 'location-1',
  externalLocationName: 'locations/location-1',
  externalLocationTitle: 'Nabatable',
  externalPlaceId: 'place-1',
  providerTimezone: 'Europe/London',
  lastPullAt: '2026-08-09T10:00:00.000Z',
  lastPushAt: null,
  lastError: null,
  availableLocations: [],
  businessInfo: null,
};

describe('GBP legacy details route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensureRestaurantAdminAccessMock.mockResolvedValue({
      userId: 'user-1',
      userEmail: 'owner@example.test',
    });
    requireBudgetMock.mockResolvedValue(null);
    getConnectionMock.mockResolvedValue(legacyDetails);
  });

  it('returns only the existing rich connection DTO through an admin-scoped no-store GET', async () => {
    const response = await GET(new NextRequest('https://example.test'), {
      params: Promise.resolve({ id: 'rest-1' }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('private');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(ensureRestaurantAdminAccessMock).toHaveBeenCalledWith(
      'rest-1',
      'google-business-profile-details',
    );
    expect(requireBudgetMock).toHaveBeenCalledWith({
      provider: 'google_business_profile',
      restaurantId: 'rest-1',
      action: 'connection-details-read',
      limit: 60,
    });
    await expect(response.json()).resolves.toEqual(legacyDetails);
  });

  it('preserves private no-store headers on authorization denial', async () => {
    ensureRestaurantAdminAccessMock.mockResolvedValueOnce(
      NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    );

    const response = await GET(new NextRequest('https://example.test'), {
      params: Promise.resolve({ id: 'rest-1' }),
    });

    expect(response.status).toBe(403);
    expect(response.headers.get('cache-control')).toContain('private');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(getConnectionMock).not.toHaveBeenCalled();
  });

  it('does not reflect provider errors or payloads', async () => {
    getConnectionMock.mockRejectedValueOnce(
      new Error('secret provider body with account and access token'),
    );

    const response = await GET(new NextRequest('https://example.test'), {
      params: Promise.resolve({ id: 'rest-1' }),
    });
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(body).toEqual({
      error: 'Unable to load Google Business Profile details.',
      code: 'GBP_CONNECTION_DETAILS_FAILED',
    });
    expect(JSON.stringify(body)).not.toContain('secret provider body');
  });
});
