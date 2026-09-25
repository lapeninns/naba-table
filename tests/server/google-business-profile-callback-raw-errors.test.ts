import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const completeGoogleBusinessProfileAuthorizationMock = vi.hoisted(() => vi.fn());
const loggerErrorMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/google-business-profile/service', () => ({
  completeGoogleBusinessProfileAuthorization: completeGoogleBusinessProfileAuthorizationMock,
}));

vi.mock('@/lib/logger', async (importOriginal) => ({
  ...(await importOriginal<typeof LoggerModule>()),
  logger: { error: loggerErrorMock, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/server/dual-sync/retention/telemetry', () => ({
  captureSafeGbpException: vi.fn(),
}));

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1', email: 'owner@example.com' } },
        error: null,
      }),
    },
  })),
}));

import { GET } from '@/src/app/api/ops/google-business-profile/callback/route';
import { GET as legacyGET } from '@/src/app/api/ops/restaurants/[id]/google-business/callback/route';
import { getGoogleBusinessProfileCallbackErrorCopy } from '@/src/components/features/restaurant-settings/google-business-profile/useGoogleBusinessProfileCallbackStatus';

import type * as LoggerModule from '@/lib/logger';

const SENTINEL = 'SECRET_DB_DETAIL';
const DEFAULT_LOCATION =
  'https://app.nabatable.com/app/settings/restaurant/google-business-profile?gbp=error&message=Google+Business+Profile+authorization+failed.';

function boundStateCookie(stateToken: string, restaurantId: string): string {
  const payload = Buffer.from(JSON.stringify({ restaurantId, stateToken })).toString('base64url');
  return `sr-gbp-oauth-state=v1.${payload}`;
}

function callbackRequest(path: string) {
  return new NextRequest(
    `https://preview.nabatable.example${path}?state=test-state&code=test-code`,
    {
      headers: { cookie: boundStateCookie('test-state', 'rest-1') },
    },
  );
}

function expectSafeRedirect(response: Response) {
  expect(response.status).toBe(307);
  const location = response.headers.get('location') ?? '';
  expect(location).not.toContain(SENTINEL);
  expect(location).not.toContain('owner%40example.com');
  expect(location).toBe(DEFAULT_LOCATION);
  expect(response.headers.get('set-cookie')).toContain('Max-Age=0');

  const logged = JSON.stringify(loggerErrorMock.mock.calls);
  expect(loggerErrorMock).toHaveBeenCalled();
  expect(logged).not.toContain(SENTINEL);
  expect(logged).not.toContain('owner@example.com');
  expect(logged).not.toContain('test-code');
}

describe('google business profile callbacks never put raw exception text in the redirect', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.nabatable.com';
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'nabatable.com';
    completeGoogleBusinessProfileAuthorizationMock.mockReset();
    loggerErrorMock.mockReset();
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  });

  it('redirects the ops callback with a fixed failure message', async () => {
    completeGoogleBusinessProfileAuthorizationMock.mockRejectedValue(
      new Error(`${SENTINEL} token exchange failed for owner@example.com`),
    );

    const response = await GET(callbackRequest('/api/ops/google-business-profile/callback'));

    expectSafeRedirect(response);
  });

  it('redirects the legacy per-restaurant callback with a fixed failure message', async () => {
    completeGoogleBusinessProfileAuthorizationMock.mockRejectedValue(
      new Error(`${SENTINEL} token exchange failed for owner@example.com`),
    );

    const response = await legacyGET(
      callbackRequest('/api/ops/restaurants/rest-1/google-business/callback'),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expectSafeRedirect(response);
    expect(loggerErrorMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        route: 'ops.restaurants.google-business.callback',
        restaurantId: 'rest-1',
      }),
    );
  });

  it('keeps known fixed server messages so the client can map them', async () => {
    const known = 'Google authorization state did not match this restaurant.';
    completeGoogleBusinessProfileAuthorizationMock.mockRejectedValue(new Error(known));

    const response = await GET(callbackRequest('/api/ops/google-business-profile/callback'));

    const message = new URL(response.headers.get('location') ?? '').searchParams.get('message');
    expect(message).toBe(known);
    expect(getGoogleBusinessProfileCallbackErrorCopy(message)).toBe(
      'Google authorization was for a different restaurant. Connect Google to try again.',
    );
  });
});
