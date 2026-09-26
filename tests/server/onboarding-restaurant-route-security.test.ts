import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createRestaurantMock = vi.hoisted(() => vi.fn());
const requireApiRateLimitMock = vi.hoisted(() => vi.fn());
const validateCsrfTokenMock = vi.hoisted(() => vi.fn());
const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const fetchUserMembershipsMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/restaurants/create', () => ({
  createRestaurant: createRestaurantMock,
}));

vi.mock('@/server/security/api-rate-limit', () => ({
  requireApiRateLimit: requireApiRateLimitMock,
}));

vi.mock('@/server/security/csrf', () => ({
  validateCsrfToken: validateCsrfTokenMock,
}));

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

vi.mock('@/server/team/access', () => ({
  fetchUserMemberships: fetchUserMembershipsMock,
}));

import {
  RestaurantAccessExistsError,
  RestaurantCreateValidationError,
  RestaurantSlugUnavailableError,
} from '@/server/restaurants/create-errors';
import { POST } from '@/src/app/api/onboarding/restaurant/route';

const USER_ID = '11111111-1111-4111-8111-111111111111';

function request(body: unknown = { name: 'New Pub', slug: 'new-pub', timezone: 'Europe/London' }) {
  return new NextRequest('https://www.nabatable.com/api/onboarding/restaurant', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/onboarding/restaurant security', () => {
  beforeEach(() => {
    createRestaurantMock.mockReset();
    requireApiRateLimitMock.mockReset().mockResolvedValue(null);
    validateCsrfTokenMock.mockReset().mockReturnValue(true);
    getRouteHandlerSupabaseClientMock.mockReset().mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: USER_ID } },
          error: null,
        }),
      },
    });
    getServiceSupabaseClientMock.mockReset().mockReturnValue({ tag: 'service-client' });
    fetchUserMembershipsMock.mockReset().mockResolvedValue([]);
  });

  it('rate limits authenticated onboarding creation before parsing or service-role writes', async () => {
    requireApiRateLimitMock.mockResolvedValue(
      NextResponse.json({ message: 'Too many requests' }, { status: 429 }),
    );

    const response = await POST(request('{not-json'));

    expect(response.status).toBe(429);
    expect(requireApiRateLimitMock).toHaveBeenCalledWith({
      request: expect.any(Request),
      scope: 'onboarding.restaurant.create',
      userId: USER_ID,
      limit: 5,
      windowMs: 60_000,
      message: 'Too many restaurant setup attempts. Please try again later.',
    });
    expect(fetchUserMembershipsMock).not.toHaveBeenCalled();
    expect(getServiceSupabaseClientMock).not.toHaveBeenCalled();
    expect(createRestaurantMock).not.toHaveBeenCalled();
  });

  it('rejects onboarding restaurant creation when the user already has restaurant access', async () => {
    fetchUserMembershipsMock.mockResolvedValue([{ restaurant_id: 'restaurant-1', role: 'owner' }]);

    const response = await POST(request('{not-json'));

    expect(response.status).toBe(409);
    expect(fetchUserMembershipsMock).toHaveBeenCalledWith(USER_ID, expect.any(Object));
    expect(getServiceSupabaseClientMock).not.toHaveBeenCalled();
    expect(createRestaurantMock).not.toHaveBeenCalled();
  });

  it('creates the first onboarding restaurant after throttle and invariant checks pass', async () => {
    createRestaurantMock.mockResolvedValue({
      id: 'restaurant-1',
      name: 'New Pub',
      slug: 'new-pub',
      timezone: 'Europe/London',
    });

    const response = await POST(request());

    expect(response.status).toBe(201);
    expect(createRestaurantMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'New Pub', slug: 'new-pub' }),
      USER_ID,
      { tag: 'service-client' },
    );
  });

  it('returns the C1 conflict when the account already has a restaurant', async () => {
    fetchUserMembershipsMock.mockResolvedValue([{ restaurant_id: 'restaurant-1', role: 'owner' }]);

    const response = await POST(request());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'ONBOARDING_ALREADY_COMPLETED',
      message: expect.any(String),
    });
  });

  it('maps the RPC membership race to the same 409', async () => {
    createRestaurantMock.mockRejectedValue(new RestaurantAccessExistsError());

    const response = await POST(request());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: 'ONBOARDING_ALREADY_COMPLETED' });
  });

  it('returns 409 SLUG_TAKEN with a slug field error when no slug candidate is free', async () => {
    createRestaurantMock.mockRejectedValue(new RestaurantSlugUnavailableError());

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe('SLUG_TAKEN');
    expect(body.fields.slug).toHaveLength(1);
  });

  it('returns 400 with the safe message for input rule failures', async () => {
    createRestaurantMock.mockRejectedValue(
      new RestaurantCreateValidationError('Choose a valid timezone.'),
    );

    const response = await POST(request());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'VALIDATION_FAILED',
      message: 'Choose a valid timezone.',
    });
  });

  it('never returns database text for unexpected creation failures', async () => {
    createRestaurantMock.mockRejectedValue(
      new Error('Failed to create restaurant: permission denied for table restaurants'),
    );

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(body)).not.toContain('permission denied');
  });

  it('returns field errors for invalid payloads', async () => {
    const response = await POST(request({ name: '', timezone: 'Europe/London' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(body.fields.name).toBeDefined();
    expect(createRestaurantMock).not.toHaveBeenCalled();
  });
});
