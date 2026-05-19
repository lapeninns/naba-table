import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUserMock = vi.hoisted(() => vi.fn());
const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const requireMembershipForRestaurantMock = vi.hoisted(() => vi.fn());
const requireApiRateLimitMock = vi.hoisted(() => vi.fn());
const isBookingLifecycleAllowedTodayMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/auth/supabase-auth-errors', () => ({
  mapSupabaseAuthError: vi.fn(() => ({
    code: 'AUTH_RESOLUTION_FAILED',
    message: 'Authentication could not be resolved',
    status: 401,
  })),
}));

vi.mock('@/server/ops/booking-lifecycle/availability', () => ({
  isBookingLifecycleAllowedToday: isBookingLifecycleAllowedTodayMock,
}));

vi.mock('@/server/security/api-rate-limit', () => ({
  requireApiRateLimit: requireApiRateLimitMock,
}));

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

vi.mock('@/server/team/access', () => ({
  requireMembershipForRestaurant: requireMembershipForRestaurantMock,
}));

import { loadLifecycleRouteContext } from '@/src/app/api/ops/bookings/[id]/_shared/lifecycleRoute';

const RESTAURANT_ID = 'restaurant-1';
const USER_ID = 'user-1';
const BOOKING_ID = 'booking-1';

const BOOKING = {
  id: BOOKING_ID,
  restaurant_id: RESTAURANT_ID,
  status: 'confirmed',
  checked_in_at: null,
  checked_out_at: null,
  booking_date: '2026-05-16',
  start_time: '19:00',
  end_time: '20:30',
};

const RESTAURANT = {
  timezone: 'Europe/London',
  reservation_lifecycle_grace_minutes: 15,
};

function createQuery<T>(response: { data: T | null; error: { message: string } | null }) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => response),
  };
  return query;
}

function createServiceSupabase(
  options: {
    bookingResponse?: { data: typeof BOOKING | null; error: { message: string } | null };
    restaurantResponse?: { data: typeof RESTAURANT | null; error: { message: string } | null };
  } = {},
) {
  const bookingQuery = createQuery(options.bookingResponse ?? { data: BOOKING, error: null });
  const restaurantQuery = createQuery(
    options.restaurantResponse ?? { data: RESTAURANT, error: null },
  );
  const serviceSupabase = {
    from: vi.fn((table: string) => {
      if (table === 'bookings') return bookingQuery;
      if (table === 'restaurants') return restaurantQuery;
      throw new Error(`Unexpected table ${table}`);
    }),
  };

  return { bookingQuery, restaurantQuery, serviceSupabase };
}

function request() {
  return new NextRequest(`https://app.nabatable.com/api/ops/bookings/${BOOKING_ID}/check-in`, {
    method: 'POST',
  });
}

describe('ops booking lifecycle route context', () => {
  let serviceSupabase: ReturnType<typeof createServiceSupabase>['serviceSupabase'];

  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({
      data: { user: { id: USER_ID, email: 'ops@example.com' } },
      error: null,
    });
    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      auth: { getUser: getUserMock },
    });
    ({ serviceSupabase } = createServiceSupabase());
    getServiceSupabaseClientMock.mockReturnValue(serviceSupabase);
    requireMembershipForRestaurantMock.mockResolvedValue(undefined);
    requireApiRateLimitMock.mockResolvedValue(null);
    isBookingLifecycleAllowedTodayMock.mockReturnValue(true);
  });

  it('rejects unauthenticated users before booking lookup', async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const result = await loadLifecycleRouteContext({
      req: request(),
      bookingId: BOOKING_ID,
      logLabel: 'booking-check-in',
    });
    const response = result.response;
    const body = await response?.json();

    expect(response?.status).toBe(401);
    expect(body).toEqual({ error: 'Authentication required' });
    expect(getServiceSupabaseClientMock).not.toHaveBeenCalled();
    expect(requireMembershipForRestaurantMock).not.toHaveBeenCalled();
  });

  it('hides bookings when the ops user lacks restaurant membership', async () => {
    requireMembershipForRestaurantMock.mockRejectedValue(new Error('not a member'));
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      const result = await loadLifecycleRouteContext({
        req: request(),
        bookingId: BOOKING_ID,
        logLabel: 'booking-check-in',
      });
      const response = result.response;
      const body = await response?.json();

      expect(response?.status).toBe(404);
      expect(body).toEqual({ error: 'Booking not found' });
      expect(requireMembershipForRestaurantMock).toHaveBeenCalledWith({
        userId: USER_ID,
        restaurantId: RESTAURANT_ID,
        client: expect.anything(),
      });
      expect(requireApiRateLimitMock).not.toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('returns context for an authenticated member on an allowed lifecycle date', async () => {
    const result = await loadLifecycleRouteContext({
      req: request(),
      bookingId: BOOKING_ID,
      logLabel: 'booking-check-in',
    });

    expect(result.response).toBeUndefined();
    expect(result.context).toEqual({
      userId: USER_ID,
      serviceSupabase,
      booking: BOOKING,
    });
    expect(requireApiRateLimitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: RESTAURANT_ID,
        userId: USER_ID,
        scope: 'ops-bookings:lifecycle',
      }),
    );
    expect(isBookingLifecycleAllowedTodayMock).toHaveBeenCalledWith({
      bookingDate: BOOKING.booking_date,
      timezone: RESTAURANT.timezone,
      startTime: BOOKING.start_time,
      endTime: BOOKING.end_time,
      graceMinutes: RESTAURANT.reservation_lifecycle_grace_minutes,
    });
  });

  it('returns rate-limit responses before loading restaurant lifecycle settings', async () => {
    requireApiRateLimitMock.mockResolvedValue(
      NextResponse.json(
        { error: 'Too many booking lifecycle requests. Please try again later.' },
        { status: 429 },
      ),
    );

    const result = await loadLifecycleRouteContext({
      req: request(),
      bookingId: BOOKING_ID,
      logLabel: 'booking-check-in',
    });
    const response = result.response;
    const body = await response?.json();

    expect(response?.status).toBe(429);
    expect(body).toEqual({ error: 'Too many booking lifecycle requests. Please try again later.' });
    expect(serviceSupabase.from).toHaveBeenCalledWith('bookings');
    expect(serviceSupabase.from).not.toHaveBeenCalledWith('restaurants');
  });
});
