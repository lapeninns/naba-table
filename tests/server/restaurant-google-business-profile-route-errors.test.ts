import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ensureRestaurantAdminAccessMock = vi.hoisted(() => vi.fn());
const resolveRestaurantIdMock = vi.hoisted(() => vi.fn());
const getConnectionStateMock = vi.hoisted(() => vi.fn());
const linkLocationMock = vi.hoisted(() => vi.fn());
const syncBusinessInfoMock = vi.hoisted(() => vi.fn());
const disconnectConnectionMock = vi.hoisted(() => vi.fn());
const verifyUserPasswordConfirmationMock = vi.hoisted(() => vi.fn());
const requireProviderRefreshBudgetMock = vi.hoisted(() => vi.fn());
const loggerErrorMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/ops/restaurants/[id]/_shared', () => ({
  ensureRestaurantAdminAccess: ensureRestaurantAdminAccessMock,
  resolveRestaurantId: resolveRestaurantIdMock,
}));
vi.mock('@/server/google-business-profile/service', () => ({
  getGoogleBusinessProfileConnectionState: getConnectionStateMock,
  linkGoogleBusinessProfileLocation: linkLocationMock,
  syncGoogleBusinessProfileBusinessInformation: syncBusinessInfoMock,
  disconnectGoogleBusinessProfileConnection: disconnectConnectionMock,
}));
vi.mock('@/server/auth/password-confirmation', () => ({
  PasswordConfirmationError: class PasswordConfirmationError extends Error {},
  verifyUserPasswordConfirmation: verifyUserPasswordConfirmationMock,
}));
vi.mock('@/server/security/provider-rate-limit', () => ({
  requireProviderRefreshBudget: requireProviderRefreshBudgetMock,
}));
vi.mock('@/server/dual-sync/freshness/operator-connection-state', () => ({
  loadGbpOperatorConnectionState: vi.fn(),
}));
vi.mock('@/server/supabase', () => ({ getServiceSupabaseClient: vi.fn(() => ({})) }));
vi.mock('@/lib/logger', async (importOriginal) => ({
  ...(await importOriginal<typeof LoggerModule>()),
  logger: { error: loggerErrorMock, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { GoogleBusinessProfileError } from '@/server/google-business-profile/errors';
import {
  DELETE,
  GET,
  POST,
  PUT,
} from '@/src/app/api/ops/restaurants/[id]/google-business-profile/route';

import type * as LoggerModule from '@/lib/logger';

const SENTINEL = 'SECRET_PROVIDER_DETAIL';
const context = () => ({ params: Promise.resolve({ id: 'rest-1' }) });
const linkBody = {
  accountName: 'accounts/1',
  accountId: '1',
  locationName: 'locations/2',
  locationId: '2',
};

function request(method: string, body?: unknown) {
  return new NextRequest('https://example.com/api/ops/restaurants/rest-1/google-business-profile', {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function expectError(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  expect(response.headers.get('cache-control')).toContain('no-store');
  const text = await response.text();
  expect(text).not.toContain(SENTINEL);
  const body = JSON.parse(text) as Record<string, unknown>;
  expect(body.code).toBe(code);
  expect(body.error).toBe(body.message);
  return body;
}

describe('google-business-profile route error classification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({ userId: 'user-1', userEmail: 'o@x.test' });
    verifyUserPasswordConfirmationMock.mockResolvedValue(undefined);
    requireProviderRefreshBudgetMock.mockResolvedValue(null);
  });

  it.each([
    ['GBP_LOCATION_NOT_FOUND', 404, 404, 'GBP_LOCATION_NOT_FOUND'],
    ['GBP_NOT_CONNECTED', 404, 409, 'GBP_NOT_CONNECTED'],
    ['GBP_REAUTH_REQUIRED', 409, 409, 'GBP_REAUTH_REQUIRED'],
    ['GBP_NOT_CONFIGURED', 503, 503, 'GBP_NOT_CONFIGURED'],
  ] as const)(
    '@contract link classifies %s by error code, not message',
    async (code, domainStatus, status, responseCode) => {
      linkLocationMock.mockRejectedValue(
        new GoogleBusinessProfileError(`${SENTINEL} opaque text`, { code, status: domainStatus }),
      );

      await expectError(await PUT(request('PUT', linkBody), context()), status, responseCode);
    },
  );

  it('@contract link treats a provider reauth kind as reconnect-required', async () => {
    linkLocationMock.mockRejectedValue(
      new GoogleBusinessProfileError(`${SENTINEL}`, {
        code: 'GBP_PROVIDER_ERROR',
        status: 401,
        kind: 'reauth',
      }),
    );

    await expectError(await PUT(request('PUT', linkBody), context()), 409, 'GBP_REAUTH_REQUIRED');
  });

  it('@contract a plain error mentioning "no longer available" is no longer a 404', async () => {
    linkLocationMock.mockRejectedValue(
      new Error(`${SENTINEL} The selected location is no longer available.`),
    );

    await expectError(await PUT(request('PUT', linkBody), context()), 500, 'INTERNAL_ERROR');
    expect(loggerErrorMock).toHaveBeenCalledWith(
      'api.internal_error',
      expect.objectContaining({
        route: 'ops.restaurants.google-business-profile',
        restaurantId: 'rest-1',
        action: 'link',
      }),
    );
  });

  it('@contract link validation returns field paths', async () => {
    const body = await expectError(
      await PUT(request('PUT', { accountName: 'accounts/1' }), context()),
      400,
      'VALIDATION_FAILED',
    );
    expect(body.fields).toHaveProperty('locationId');
  });

  it.each([
    ['GBP_LOCATION_NOT_LINKED', 409, 'GBP_LOCATION_NOT_LINKED'],
    ['GBP_ACCOUNT_NOT_LINKED', 409, 'GBP_LOCATION_NOT_LINKED'],
    ['GBP_NOT_CONNECTED', 409, 'GBP_NOT_CONNECTED'],
    ['GBP_REAUTH_REQUIRED', 409, 'GBP_REAUTH_REQUIRED'],
  ] as const)('@contract sync classifies %s by error code', async (code, status, responseCode) => {
    syncBusinessInfoMock.mockRejectedValue(
      new GoogleBusinessProfileError(`${SENTINEL}`, { code, status: 409 }),
    );

    await expectError(
      await POST(request('POST', { password: 'pw' }), context()),
      status,
      responseCode,
    );
  });

  it('@contract sync maps provider quota and outages to a retryable 503', async () => {
    syncBusinessInfoMock.mockRejectedValue(
      new GoogleBusinessProfileError(`${SENTINEL}`, {
        code: 'GBP_PROVIDER_ERROR',
        status: 429,
        kind: 'quota',
      }),
    );

    const body = await expectError(
      await POST(request('POST', { password: 'pw' }), context()),
      503,
      'GBP_PROVIDER_UNAVAILABLE',
    );
    expect(body.retryable).toBe(true);
  });

  it('@contract sync: a plain error mentioning "reconnect" is an internal error', async () => {
    syncBusinessInfoMock.mockRejectedValue(new Error(`${SENTINEL} please reconnect`));

    await expectError(
      await POST(request('POST', { password: 'pw' }), context()),
      500,
      'INTERNAL_ERROR',
    );
  });

  it('@contract GET and DELETE unexpected failures return INTERNAL_ERROR', async () => {
    getConnectionStateMock.mockRejectedValue(new Error(SENTINEL));
    disconnectConnectionMock.mockRejectedValue(new Error(SENTINEL));

    await expectError(await GET(request('GET'), context()), 500, 'INTERNAL_ERROR');
    await expectError(
      await DELETE(request('DELETE', { password: 'pw' }), context()),
      500,
      'INTERNAL_ERROR',
    );
  });
});
