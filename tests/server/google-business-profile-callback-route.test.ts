import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const completeGoogleBusinessProfileAuthorizationMock = vi.hoisted(() => vi.fn());
const authGetUserMock = vi.hoisted(() => vi.fn());
const loggerErrorMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/google-business-profile/service', () => ({
  completeGoogleBusinessProfileAuthorization: completeGoogleBusinessProfileAuthorizationMock,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: loggerErrorMock,
  },
}));

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: vi.fn(async () => ({
    auth: {
      getUser: authGetUserMock,
    },
  })),
}));

import { GET } from '@/src/app/api/ops/google-business-profile/callback/route';
import { GET as legacyGET } from '@/src/app/api/ops/restaurants/[id]/google-business/callback/route';

describe('google business profile callback route', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.nabatable.com';
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'nabatable.com';
    completeGoogleBusinessProfileAuthorizationMock.mockReset();
    authGetUserMock.mockReset().mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    loggerErrorMock.mockReset();
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  });

  it('uses the trusted app origin on successful authorization', async () => {
    completeGoogleBusinessProfileAuthorizationMock.mockResolvedValue({
      restaurantId: 'rest-1',
      returnPath:
        'https://preview.nabatable.example/app/settings/restaurant/google-business-profile',
    });

    const response = await GET(
      new NextRequest(
        'https://preview.nabatable.example/api/ops/google-business-profile/callback?state=test-state&code=test-code',
        {
          headers: {
            cookie: 'sr-gbp-oauth-state=test-state',
          },
        },
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://app.nabatable.com/app/settings/restaurant/google-business-profile?gbp=connected',
    );
    expect(completeGoogleBusinessProfileAuthorizationMock).toHaveBeenCalledWith({
      stateToken: 'test-state',
      code: 'test-code',
      requestedByUserId: 'user-1',
    });
    expect(response.headers.get('set-cookie')).toContain('sr-gbp-oauth-state=');
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('ignores forwarded host headers for error redirects', async () => {
    const response = await GET(
      new NextRequest(
        'http://internal-host/api/ops/google-business-profile/callback?error=access_denied',
        {
          headers: {
            'x-forwarded-host': 'staging.nabatable.example',
            'x-forwarded-proto': 'https',
          },
        },
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://app.nabatable.com/app/settings/restaurant/google-business-profile?gbp=error&message=Google+authorization+was+cancelled+or+denied.',
    );
    expect(response.headers.get('set-cookie')).toContain('sr-gbp-oauth-state=');
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
    expect(authGetUserMock).not.toHaveBeenCalled();
    expect(completeGoogleBusinessProfileAuthorizationMock).not.toHaveBeenCalled();
  });

  it('rejects incomplete callbacks before session or OAuth completion', async () => {
    const response = await GET(
      new NextRequest(
        'https://preview.nabatable.example/api/ops/google-business-profile/callback?state=test-state',
        {
          headers: {
            cookie: 'sr-gbp-oauth-state=test-state',
          },
        },
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('gbp=error');
    expect(response.headers.get('location')).toContain(
      'Google+authorization+response+was+incomplete',
    );
    expect(response.headers.get('set-cookie')).toContain('sr-gbp-oauth-state=');
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
    expect(authGetUserMock).not.toHaveBeenCalled();
    expect(completeGoogleBusinessProfileAuthorizationMock).not.toHaveBeenCalled();
  });

  it('rejects callbacks without the initiating browser state cookie before completing OAuth', async () => {
    const response = await GET(
      new NextRequest(
        'https://preview.nabatable.example/api/ops/google-business-profile/callback?state=test-state&code=test-code',
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('gbp=error');
    expect(response.headers.get('location')).toContain('could+not+be+verified');
    expect(response.headers.get('set-cookie')).toContain('sr-gbp-oauth-state=');
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
    expect(authGetUserMock).not.toHaveBeenCalled();
    expect(completeGoogleBusinessProfileAuthorizationMock).not.toHaveBeenCalled();
  });

  it('rejects callbacks with a mismatched browser state cookie before completing OAuth', async () => {
    const response = await GET(
      new NextRequest(
        'https://preview.nabatable.example/api/ops/google-business-profile/callback?state=test-state&code=test-code',
        {
          headers: {
            cookie: 'sr-gbp-oauth-state=other-state',
          },
        },
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('gbp=error');
    expect(response.headers.get('location')).toContain('could+not+be+verified');
    expect(response.headers.get('set-cookie')).toContain('sr-gbp-oauth-state=');
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
    expect(authGetUserMock).not.toHaveBeenCalled();
    expect(completeGoogleBusinessProfileAuthorizationMock).not.toHaveBeenCalled();
  });

  it('rejects callbacks without a Nabatable session before completing OAuth', async () => {
    authGetUserMock.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const response = await GET(
      new NextRequest(
        'https://preview.nabatable.example/api/ops/google-business-profile/callback?state=test-state&code=test-code',
        {
          headers: {
            cookie: 'sr-gbp-oauth-state=test-state',
          },
        },
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('gbp=error');
    expect(response.headers.get('location')).toContain('Sign+in+to+Nabatable');
    expect(completeGoogleBusinessProfileAuthorizationMock).not.toHaveBeenCalled();
  });

  it('redirects safely and clears state when OAuth completion rejects the stored state', async () => {
    completeGoogleBusinessProfileAuthorizationMock.mockRejectedValue(
      new Error('Google authorization state expired or belongs to a different restaurant.'),
    );

    const response = await GET(
      new NextRequest(
        'https://preview.nabatable.example/api/ops/google-business-profile/callback?state=test-state&code=test-code',
        {
          headers: {
            cookie: 'sr-gbp-oauth-state=test-state',
          },
        },
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://app.nabatable.com/app/settings/restaurant/google-business-profile?gbp=error&message=Google+authorization+state+expired+or+belongs+to+a+different+restaurant.',
    );
    expect(response.headers.get('set-cookie')).toContain('sr-gbp-oauth-state=');
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('redirects safely and clears state when Google returns an invalid grant', async () => {
    completeGoogleBusinessProfileAuthorizationMock.mockRejectedValue(
      new Error(
        'Google authorization has expired or been revoked. Please reconnect Google Business Profile.',
      ),
    );

    const response = await GET(
      new NextRequest(
        'https://preview.nabatable.example/api/ops/google-business-profile/callback?state=test-state&code=test-code',
        {
          headers: {
            cookie: 'sr-gbp-oauth-state=test-state',
          },
        },
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://app.nabatable.com/app/settings/restaurant/google-business-profile?gbp=error&message=Google+authorization+has+expired+or+been+revoked.+Please+reconnect+Google+Business+Profile.',
    );
    expect(response.headers.get('set-cookie')).toContain('sr-gbp-oauth-state=');
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('binds legacy per-restaurant callbacks to the route restaurant before completing OAuth', async () => {
    completeGoogleBusinessProfileAuthorizationMock.mockResolvedValue({
      restaurantId: 'rest-1',
      returnPath:
        'https://preview.nabatable.example/app/settings/restaurant/google-business-profile',
    });

    const response = await legacyGET(
      new NextRequest(
        'https://preview.nabatable.example/api/ops/restaurants/rest-1/google-business/callback?state=test-state&code=test-code',
        {
          headers: {
            cookie: 'sr-gbp-oauth-state=test-state',
          },
        },
      ),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://app.nabatable.com/app/settings/restaurant/google-business-profile?gbp=connected',
    );
    expect(completeGoogleBusinessProfileAuthorizationMock).toHaveBeenCalledWith({
      stateToken: 'test-state',
      code: 'test-code',
      requestedByUserId: 'user-1',
      expectedRestaurantId: 'rest-1',
    });
  });

  it('rejects legacy callbacks when the completed state belongs to another restaurant', async () => {
    completeGoogleBusinessProfileAuthorizationMock.mockResolvedValue({
      restaurantId: 'rest-2',
      returnPath:
        'https://preview.nabatable.example/app/settings/restaurant/google-business-profile',
    });

    const response = await legacyGET(
      new NextRequest(
        'https://preview.nabatable.example/api/ops/restaurants/rest-1/google-business/callback?state=test-state&code=test-code',
        {
          headers: {
            cookie: 'sr-gbp-oauth-state=test-state',
          },
        },
      ),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('gbp=error');
    expect(response.headers.get('location')).toContain('did+not+match+this+restaurant');
    expect(response.headers.get('set-cookie')).toContain('sr-gbp-oauth-state=');
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });
});
