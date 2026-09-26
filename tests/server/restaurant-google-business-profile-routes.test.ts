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
const requireProviderRefreshBudgetMock = vi.hoisted(() => vi.fn());
const loadOperatorConnectionStateMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn(() => ({ service: true })));
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
  createGoogleBusinessProfileAuthorization: createAuthorizationUrlMock,
  getGoogleBusinessProfileConnectionState: getConnectionStateMock,
  linkGoogleBusinessProfileLocation: linkLocationMock,
  syncGoogleBusinessProfileBusinessInformation: syncBusinessInfoMock,
  disconnectGoogleBusinessProfileConnection: disconnectConnectionMock,
}));

vi.mock('@/server/auth/password-confirmation', () => ({
  PasswordConfirmationError: PasswordConfirmationErrorMock,
  verifyUserPasswordConfirmation: verifyUserPasswordConfirmationMock,
}));

vi.mock('@/server/security/provider-rate-limit', () => ({
  requireProviderRefreshBudget: requireProviderRefreshBudgetMock,
}));
vi.mock('@/server/dual-sync/freshness/operator-connection-state', () => ({
  loadGbpOperatorConnectionState: loadOperatorConnectionStateMock,
}));
vi.mock('@/server/supabase', () => ({ getServiceSupabaseClient: getServiceSupabaseClientMock }));

import {
  GET as connectGET,
  POST as connectPOST,
} from '@/src/app/api/ops/restaurants/[id]/google-business-profile/connect/route';
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
    requireProviderRefreshBudgetMock.mockReset().mockResolvedValue(null);
    loadOperatorConnectionStateMock.mockReset();
  });

  it('starts Google OAuth from the connect route over POST', async () => {
    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({ userId: 'user-1' });
    createAuthorizationUrlMock.mockResolvedValue({
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=test',
      stateToken: 'test',
    });

    const request = new NextRequest(
      'https://example.com/api/ops/restaurants/rest-1/google-business-profile/connect',
      { method: 'POST' },
    );
    const response = await connectPOST(request, { params: Promise.resolve({ id: 'rest-1' }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=test',
    });
    expect(response.headers.get('set-cookie')).toContain('sr-gbp-oauth-state=v1.');
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(response.headers.get('set-cookie')).not.toContain('sr-gbp-oauth-state=test');
    expect(ensureRestaurantAdminAccessMock).toHaveBeenCalledWith(
      'rest-1',
      'google-business-profile',
      request,
    );
    expect(createAuthorizationUrlMock).toHaveBeenCalledWith({
      restaurantId: 'rest-1',
      requestedByUserId: 'user-1',
      returnPath: 'https://nabatable.com/app/settings/restaurant/google-business-profile',
    });
  });

  it('rejects GET on the connect route without starting OAuth', async () => {
    const response = await connectGET();

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining('Use POST'),
    });
    expect(createAuthorizationUrlMock).not.toHaveBeenCalled();
    expect(ensureRestaurantAdminAccessMock).not.toHaveBeenCalled();
  });

  it('ignores forwarded host and protocol for GBP connect return paths', async () => {
    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({ userId: 'user-1' });
    createAuthorizationUrlMock.mockResolvedValue({
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=test',
      stateToken: 'test',
    });

    await connectPOST(
      new NextRequest(
        'http://internal-host/api/ops/restaurants/rest-1/google-business-profile/connect',
        {
          method: 'POST',
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
      returnPath: 'https://nabatable.com/app/settings/restaurant/google-business-profile',
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
    expect(requireProviderRefreshBudgetMock).not.toHaveBeenCalled();
    expect(getConnectionStateMock).not.toHaveBeenCalled();
  });

  it('rejects cross-tenant location linking before service calls', async () => {
    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue(
      NextResponse.json({ message: 'Forbidden', error: 'Forbidden' }, { status: 403 }),
    );

    const response = await connectionPUT(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/google-business-profile', {
        method: 'PUT',
        body: 'not-json',
      }),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(403);
    expect(linkLocationMock).not.toHaveBeenCalled();
    expect(requireProviderRefreshBudgetMock).not.toHaveBeenCalled();
  });

  it('rejects cross-tenant manual sync before password or provider calls', async () => {
    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue(
      NextResponse.json({ message: 'Forbidden', error: 'Forbidden' }, { status: 403 }),
    );

    const response = await connectionPOST(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/google-business-profile', {
        method: 'POST',
        body: 'not-json',
      }),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(403);
    expect(verifyUserPasswordConfirmationMock).not.toHaveBeenCalled();
    expect(requireProviderRefreshBudgetMock).not.toHaveBeenCalled();
    expect(syncBusinessInfoMock).not.toHaveBeenCalled();
  });

  it('rejects cross-tenant disconnect before password or unlink calls', async () => {
    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue(
      NextResponse.json({ message: 'Forbidden', error: 'Forbidden' }, { status: 403 }),
    );

    const response = await connectionDELETE(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/google-business-profile', {
        method: 'DELETE',
        body: 'not-json',
      }),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(403);
    expect(verifyUserPasswordConfirmationMock).not.toHaveBeenCalled();
    expect(disconnectConnectionMock).not.toHaveBeenCalled();
  });

  it('rejects cross-tenant OAuth start before creating state', async () => {
    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue(
      NextResponse.json({ message: 'Forbidden', error: 'Forbidden' }, { status: 403 }),
    );

    const response = await connectPOST(
      new NextRequest(
        'https://example.com/api/ops/restaurants/rest-1/google-business-profile/connect',
        { method: 'POST' },
      ),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(403);
    expect(createAuthorizationUrlMock).not.toHaveBeenCalled();
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

  it('returns the strict canonical operator connection state', async () => {
    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({ userId: 'user-1' });
    const legacyState = { provider: 'google_business_profile', status: 'linked' };
    getConnectionStateMock.mockResolvedValue(legacyState);
    const canonicalState = {
      version: 'v1',
      restaurantId: 'rest-1',
      provider: 'google_business_profile',
      connectionStatus: 'linked',
      writeState: 'blocked',
      connectionGeneration: 2,
      consentEpoch: 3,
      reasonCode: 'operator_disabled',
      rollout: { eligible: true, cohort: 'all', evaluatedAt: '2026-08-09T10:00:00.000Z' },
      pendingUpdates: { version: 'v1', restaurantId: 'rest-1', state: 'none' },
      notifications: { enabled: false, refCount: 0 },
      refresh: {
        status: 'idle',
        lastAttemptAt: null,
        lastSucceededAt: null,
        safeErrorCode: null,
      },
    };
    loadOperatorConnectionStateMock.mockResolvedValue(canonicalState);

    const response = await connectionGET(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/google-business-profile'),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    await expect(response.json()).resolves.toEqual(canonicalState);
    expect(loadOperatorConnectionStateMock).toHaveBeenCalledWith({
      client: { service: true },
      restaurantId: 'rest-1',
      connection: legacyState,
    });
  });

  it('returns a stable safe error for connection load failures', async () => {
    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({ userId: 'user-1' });
    getConnectionStateMock.mockRejectedValue(new Error('GBP provider unavailable'));

    const response = await connectionGET(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/google-business-profile'),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      message: 'Unable to load Google Business Profile connection.',
      error: 'Unable to load Google Business Profile connection.',
      code: 'INTERNAL_ERROR',
    });
  });

  it('returns the updated connection state after disconnecting', async () => {
    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({
      userId: 'user-1',
      userEmail: 'owner@example.com',
    });
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
        body: JSON.stringify({ password: 'secret-password' }),
      }),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('unlinked');
    expect(verifyUserPasswordConfirmationMock).toHaveBeenCalledWith({
      email: 'owner@example.com',
      password: 'secret-password',
    });
    expect(disconnectConnectionMock).toHaveBeenCalledWith('rest-1');
  });

  it('requires password confirmation before disconnecting', async () => {
    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({
      userId: 'user-1',
      userEmail: 'owner@example.com',
    });

    const response = await connectionDELETE(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/google-business-profile', {
        method: 'DELETE',
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(400);
    expect(verifyUserPasswordConfirmationMock).not.toHaveBeenCalled();
    expect(disconnectConnectionMock).not.toHaveBeenCalled();
  });

  it('does not disconnect when password confirmation fails', async () => {
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

    const response = await connectionDELETE(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/google-business-profile', {
        method: 'DELETE',
        body: JSON.stringify({ password: 'wrong-password' }),
      }),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(403);
    expect(disconnectConnectionMock).not.toHaveBeenCalled();
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
    expect(requireProviderRefreshBudgetMock).toHaveBeenCalledWith({
      provider: 'google_business_profile',
      restaurantId: 'rest-1',
      action: 'business-info-sync',
    });
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
