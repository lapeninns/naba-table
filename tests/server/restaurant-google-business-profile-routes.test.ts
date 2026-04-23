import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ensureRestaurantAdminAccessMock = vi.hoisted(() => vi.fn());
const resolveRestaurantIdMock = vi.hoisted(() => vi.fn());
const createAuthorizationUrlMock = vi.hoisted(() => vi.fn());
const getConnectionStateMock = vi.hoisted(() => vi.fn());
const linkLocationMock = vi.hoisted(() => vi.fn());
const syncBusinessInfoMock = vi.hoisted(() => vi.fn());
const disconnectConnectionMock = vi.hoisted(() => vi.fn());
const verifyUserPasswordConfirmationMock = vi.hoisted(() => vi.fn());
const PasswordConfirmationErrorMock = vi.hoisted(
  () =>
    class PasswordConfirmationError extends Error {
      code: string;
      status: number;

      constructor(message: string, options: { code?: string; status?: number } = {}) {
        super(message);
        this.code = options.code ?? 'PASSWORD_CONFIRMATION_FAILED';
        this.status = options.status ?? 403;
      }
    },
);

vi.mock('@/app/api/ops/restaurants/[id]/_shared', () => ({
  ensureRestaurantAdminAccess: ensureRestaurantAdminAccessMock,
  resolveRestaurantId: resolveRestaurantIdMock,
}));

vi.mock('@/server/google-business-profile/service', () => ({
  createGoogleBusinessProfileAuthorizationUrl: createAuthorizationUrlMock,
  getGoogleBusinessProfileConnectionState: getConnectionStateMock,
  linkGoogleBusinessProfileLocation: linkLocationMock,
  syncGoogleBusinessProfileBusinessInformation: syncBusinessInfoMock,
  disconnectGoogleBusinessProfileConnection: disconnectConnectionMock,
}));

vi.mock('@/server/auth/password-confirmation', () => ({
  PasswordConfirmationError: PasswordConfirmationErrorMock,
  verifyUserPasswordConfirmation: verifyUserPasswordConfirmationMock,
}));

import { GET as connectGET } from '@/src/app/api/ops/restaurants/[id]/google-business-profile/connect/route';
import {
  DELETE as connectionDELETE,
  GET as connectionGET,
  POST as connectionPOST,
  PUT as connectionPUT,
} from '@/src/app/api/ops/restaurants/[id]/google-business-profile/route';

describe('restaurant google business profile routes', () => {
  beforeEach(() => {
    ensureRestaurantAdminAccessMock.mockReset();
    resolveRestaurantIdMock.mockReset();
    createAuthorizationUrlMock.mockReset();
    getConnectionStateMock.mockReset();
    linkLocationMock.mockReset();
    syncBusinessInfoMock.mockReset();
    disconnectConnectionMock.mockReset();
    verifyUserPasswordConfirmationMock.mockReset();
  });

  it('redirects to Google OAuth from the connect route', async () => {
    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({ userId: 'user-1' });
    createAuthorizationUrlMock.mockResolvedValue(
      'https://accounts.google.com/o/oauth2/v2/auth?state=test',
    );

    const response = await connectGET(
      new NextRequest(
        'https://example.com/api/ops/restaurants/rest-1/google-business-profile/connect',
      ),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://accounts.google.com/o/oauth2/v2/auth?state=test',
    );
    expect(createAuthorizationUrlMock).toHaveBeenCalledWith({
      restaurantId: 'rest-1',
      requestedByUserId: 'user-1',
      returnPath: 'https://example.com/app/settings/restaurant/google-business-profile',
    });
  });

  it('uses the forwarded host and protocol for GBP connect return paths', async () => {
    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({ userId: 'user-1' });
    createAuthorizationUrlMock.mockResolvedValue(
      'https://accounts.google.com/o/oauth2/v2/auth?state=test',
    );

    await connectGET(
      new NextRequest(
        'http://internal-host/api/ops/restaurants/rest-1/google-business-profile/connect',
        {
          headers: {
            'x-forwarded-host': 'preview.nabatable.example',
            'x-forwarded-proto': 'https',
          },
        },
      ),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(createAuthorizationUrlMock).toHaveBeenCalledWith({
      restaurantId: 'rest-1',
      requestedByUserId: 'user-1',
      returnPath:
        'https://preview.nabatable.example/app/settings/restaurant/google-business-profile',
    });
  });

  it('returns the shared auth response when GBP state route is unauthorized', async () => {
    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue(
      NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
    );

    const response = await connectionGET(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/google-business-profile'),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(401);
  });

  it('rejects invalid payloads for location linking', async () => {
    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({ userId: 'user-1' });

    const response = await connectionPUT(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/google-business-profile', {
        method: 'PUT',
        body: JSON.stringify({
          accountName: 'accounts/123',
          locationName: 'locations/456',
        }),
      }),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(400);
    expect(linkLocationMock).not.toHaveBeenCalled();
  });

  it('returns the updated connection state after disconnecting', async () => {
    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({ userId: 'user-1' });
    disconnectConnectionMock.mockResolvedValue({
      isConfigured: true,
      provider: 'google_business_profile',
      status: 'unlinked',
      connectedGoogleEmail: null,
      connectedGoogleName: null,
      externalAccountId: null,
      externalAccountName: null,
      externalLocationId: null,
      externalLocationName: null,
      externalLocationTitle: null,
      externalPlaceId: null,
      lastPullAt: null,
      lastError: null,
      availableLocations: [],
      businessInfo: {
        details: null,
        addresses: [],
        phoneNumbers: [],
        links: [],
        categories: [],
        serviceAreas: [],
        hours: [],
        attributes: [],
        serviceItems: [],
        coreNormalization: {
          operatingHours: {
            source: 'unavailable',
            matchStatus: 'unavailable',
            summary:
              'No GBP hour set can be normalized confidently into Nabatable operating hours yet.',
            warnings: [],
            weekly: [],
            overrides: [],
          },
          servicePeriods: {
            source: 'unavailable',
            matchStatus: 'unavailable',
            summary:
              'GBP does not natively guarantee lunch/dinner service-period data, so service periods are only normalizable when more-hours labels explicitly encode meal windows.',
            warnings: [],
            periods: [],
          },
          bookingHours: {
            matchStatus: 'unavailable',
            summary:
              'GBP does not currently provide enough structured data to verify Nabatable booking hours.',
            warnings: [],
            missingInputs: [
              'reservation interval minutes',
              'reservation slot times',
              'default reservation duration',
              'last seating buffer',
              'lifecycle grace rules',
            ],
          },
        },
      },
    });

    const response = await connectionDELETE(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/google-business-profile', {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('unlinked');
    expect(disconnectConnectionMock).toHaveBeenCalledWith('rest-1');
  });

  it('returns refreshed business info after syncing', async () => {
    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({
      userId: 'user-1',
      userEmail: 'owner@example.com',
    });
    syncBusinessInfoMock.mockResolvedValue({
      isConfigured: true,
      provider: 'google_business_profile',
      status: 'linked',
      connectedGoogleEmail: 'owner@example.com',
      connectedGoogleName: 'Owner',
      externalAccountId: '123',
      externalAccountName: 'accounts/123',
      externalLocationId: '456',
      externalLocationName: 'locations/456',
      externalLocationTitle: 'Old Crown Girton',
      externalPlaceId: 'place-1',
      lastPullAt: '2026-04-18T12:00:00.000Z',
      lastError: null,
      availableLocations: [],
      businessInfo: {
        details: {
          businessName: 'Old Crown Girton',
          description: 'A family friendly pub.',
          languageCode: 'en-GB',
          openingDate: '2024-08-01',
          businessStatus: 'OPEN',
          isServiceAreaBusiness: false,
          canReopen: true,
          source: 'gbp',
          managedBy: 'gbp',
          lastSyncedAt: '2026-04-18T12:00:00.000Z',
        },
        addresses: [],
        phoneNumbers: [],
        links: [],
        categories: [],
        serviceAreas: [],
        hours: [],
        attributes: [],
        serviceItems: [],
        coreNormalization: {
          operatingHours: {
            source: 'unavailable',
            matchStatus: 'unavailable',
            summary:
              'No GBP hour set can be normalized confidently into Nabatable operating hours yet.',
            warnings: [],
            weekly: [],
            overrides: [],
          },
          servicePeriods: {
            source: 'unavailable',
            matchStatus: 'unavailable',
            summary:
              'GBP does not natively guarantee lunch/dinner service-period data, so service periods are only normalizable when more-hours labels explicitly encode meal windows.',
            warnings: [],
            periods: [],
          },
          bookingHours: {
            matchStatus: 'unavailable',
            summary:
              'GBP does not currently provide enough structured data to verify Nabatable booking hours.',
            warnings: [],
            missingInputs: [
              'reservation interval minutes',
              'reservation slot times',
              'default reservation duration',
              'last seating buffer',
              'lifecycle grace rules',
            ],
          },
        },
      },
    });

    const response = await connectionPOST(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/google-business-profile', {
        method: 'POST',
        body: JSON.stringify({ password: 'secret-password' }),
      }),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.businessInfo.details.description).toBe('A family friendly pub.');
    expect(syncBusinessInfoMock).toHaveBeenCalledWith('rest-1');
    expect(verifyUserPasswordConfirmationMock).toHaveBeenCalledWith({
      email: 'owner@example.com',
      password: 'secret-password',
    });
  });

  it('surfaces password confirmation failures for GBP sync', async () => {
    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({
      userId: 'user-1',
      userEmail: 'owner@example.com',
    });
    verifyUserPasswordConfirmationMock.mockRejectedValue(
      new PasswordConfirmationErrorMock(
        'Incorrect password. Confirm the change with your login password and try again.',
      ),
    );

    const response = await connectionPOST(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/google-business-profile', {
        method: 'POST',
        body: JSON.stringify({ password: 'wrong-password' }),
      }),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(403);
    expect(syncBusinessInfoMock).not.toHaveBeenCalled();
  });
});
