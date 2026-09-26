import { NextRequest, NextResponse } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const withPlatformAdminAuthorizationMock = vi.hoisted(() => vi.fn());
const requireApiRateLimitMock = vi.hoisted(() => vi.fn());
const createRestaurantMock = vi.hoisted(() => vi.fn());
const listRestaurantsForOpsMock = vi.hoisted(() => vi.fn());
const upsertRestaurantBusinessDescriptionMock = vi.hoisted(() => vi.fn());
const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/auth/guards', () => ({
  withPlatformAdminAuthorization: withPlatformAdminAuthorizationMock,
}));

vi.mock('@/server/security/api-rate-limit', () => ({
  requireApiRateLimit: requireApiRateLimitMock,
}));

vi.mock('@/server/restaurants', () => ({
  createRestaurant: createRestaurantMock,
  listRestaurantsForOps: listRestaurantsForOpsMock,
}));

vi.mock('@/server/restaurants/details', () => ({
  upsertRestaurantBusinessDescription: upsertRestaurantBusinessDescriptionMock,
}));

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

import {
  RestaurantAccessExistsError,
  RestaurantCreateValidationError,
  RestaurantSlugUnavailableError,
} from '@/server/restaurants/create-errors';
import { POST } from '@/src/app/api/ops/restaurants/route';

const PLATFORM_USER_ID = '22222222-2222-4222-8222-222222222222';

function request(
  body: unknown = {
    name: 'Test Restaurant',
    slug: 'test-restaurant',
    timezone: 'Europe/London',
  },
) {
  return new NextRequest('https://app.nabatable.com/api/ops/restaurants', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function authorized() {
  return {
    ok: true as const,
    user: { id: PLATFORM_USER_ID, email: 'admin@example.com' },
    supabase: { tag: 'route-client' },
    platformAdmin: true as const,
  };
}

describe('POST /api/ops/restaurants security', () => {
  beforeEach(() => {
    withPlatformAdminAuthorizationMock.mockReset();
    requireApiRateLimitMock.mockReset();
    createRestaurantMock.mockReset();
    listRestaurantsForOpsMock.mockReset();
    upsertRestaurantBusinessDescriptionMock.mockReset();
    getRouteHandlerSupabaseClientMock.mockReset();
    getServiceSupabaseClientMock.mockReset();

    requireApiRateLimitMock.mockResolvedValue(null);
    getServiceSupabaseClientMock.mockReturnValue({ tag: 'service-client' });
  });

  it('rejects non-platform admins before parsing or service-role creation', async () => {
    withPlatformAdminAuthorizationMock.mockResolvedValue({
      ok: false,
      response: NextResponse.json(
        { error: 'Platform administrator access required', code: 'PLATFORM_ADMIN_REQUIRED' },
        { status: 403 },
      ),
    });

    const response = await POST(request('{not-json'));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'Platform administrator access required',
      code: 'PLATFORM_ADMIN_REQUIRED',
    });
    expect(withPlatformAdminAuthorizationMock).toHaveBeenCalledWith(expect.any(Request), {
      csrf: true,
    });
    expect(requireApiRateLimitMock).not.toHaveBeenCalled();
    expect(getServiceSupabaseClientMock).not.toHaveBeenCalled();
    expect(createRestaurantMock).not.toHaveBeenCalled();
  });

  it('rate limits platform restaurant creation before parsing or service-role creation', async () => {
    withPlatformAdminAuthorizationMock.mockResolvedValue(authorized());
    requireApiRateLimitMock.mockResolvedValue(
      NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 }),
    );

    const response = await POST(request('{not-json'));

    expect(response.status).toBe(429);
    expect(requireApiRateLimitMock).toHaveBeenCalledWith({
      request: expect.any(Request),
      scope: 'ops.restaurants.create',
      limit: 10,
      windowMs: 60_000,
      userId: PLATFORM_USER_ID,
      message: 'Too many restaurant creation attempts',
    });
    expect(getServiceSupabaseClientMock).not.toHaveBeenCalled();
    expect(createRestaurantMock).not.toHaveBeenCalled();
  });

  it('creates restaurants only after platform-admin authorization and rate limiting pass', async () => {
    withPlatformAdminAuthorizationMock.mockResolvedValue(authorized());
    createRestaurantMock.mockResolvedValue({
      id: 'restaurant-1',
      name: 'Test Restaurant',
      slug: 'test-restaurant',
      isActive: true,
      timezone: 'Europe/London',
      capacity: null,
      contactEmail: null,
      contactPhone: null,
      address: null,
      managerDailySummaryEnabled: false,
      managerNotificationPhone: null,
      googleMapUrl: null,
      googleReviewUrl: null,
      bookingPolicy: null,
      logoUrl: null,
      emailSendReminder24h: true,
      emailSendReminderShort: true,
      emailSendReviewRequest: true,
      reservationIntervalMinutes: 15,
      reservationDefaultDurationMinutes: 90,
      reservationLastSeatingBufferMinutes: null,
      reservationLifecycleGraceMinutes: null,
      createdAt: '2026-05-16T00:00:00.000Z',
      updatedAt: '2026-05-16T00:00:00.000Z',
    });

    const response = await POST(request());

    expect(response.status).toBe(201);
    expect(createRestaurantMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Test Restaurant', slug: 'test-restaurant' }),
      PLATFORM_USER_ID,
      { tag: 'service-client' },
    );
  });

  describe('creation errors (C1)', () => {
    const SECRET = 'SECRET_DB_DETAIL owner@example.com';
    let consoleError: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      withPlatformAdminAuthorizationMock.mockResolvedValue(authorized());
      consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
      consoleError.mockRestore();
    });

    it('returns a fixed 500 without echoing an unexpected creation failure', async () => {
      createRestaurantMock.mockRejectedValue(new Error(`Failed to create restaurant: ${SECRET}`));

      const response = await POST(request());
      const text = await response.text();

      expect(response.status).toBe(500);
      expect(JSON.parse(text)).toEqual({
        error: 'Unable to create restaurant',
        code: 'INTERNAL_ERROR',
        message: 'Unable to create restaurant',
      });
      expect(text).not.toContain('SECRET_DB_DETAIL');
      expect(JSON.stringify(consoleError.mock.calls)).not.toContain('owner@example.com');
    });

    it('maps an exhausted slug to 409 SLUG_TAKEN', async () => {
      createRestaurantMock.mockRejectedValue(new RestaurantSlugUnavailableError());

      const response = await POST(request());

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toMatchObject({
        code: 'SLUG_TAKEN',
        fields: { slug: [expect.any(String)] },
      });
    });

    it('maps existing restaurant access to 409 RESTAURANT_ACCESS_EXISTS', async () => {
      createRestaurantMock.mockRejectedValue(new RestaurantAccessExistsError());

      const response = await POST(request());

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toMatchObject({ code: 'RESTAURANT_ACCESS_EXISTS' });
    });

    it('maps a creation rule failure to 400 VALIDATION_FAILED with its safe message', async () => {
      createRestaurantMock.mockRejectedValue(
        new RestaurantCreateValidationError('Choose a valid timezone.'),
      );

      const response = await POST(request());

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        code: 'VALIDATION_FAILED',
        error: 'Choose a valid timezone.',
      });
    });
  });
});
