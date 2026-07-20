import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Performance regressions guarded here (production timing marks, July 2026):
 * - list route: rate_limit (p50 ~415ms) ran strictly before memberships — they
 *   must run concurrently.
 * - booking-scoped auth guard: getUser → booking lookup → membership was three
 *   sequential round trips (p50 ~380ms) — the first two must overlap.
 * - PATCH: memberships (and the restaurant schedule) were fetched up to twice
 *   per request — they must be fetched at most once.
 */

const tenantAuthGetUserMock = vi.hoisted(() => vi.fn());
const fetchUserMembershipsMock = vi.hoisted(() => vi.fn());
const consumeRateLimitMock = vi.hoisted(() => vi.fn());
const requireMembershipForRestaurantMock = vi.hoisted(() => vi.fn());
const getRestaurantScheduleMock = vi.hoisted(() => vi.fn());
const getRestaurantTurnBandsMock = vi.hoisted(() => vi.fn());
const resolveBookingDurationMinutesMock = vi.hoisted(() => vi.fn());
const updateBookingRecordMock = vi.hoisted(() => vi.fn());
const createBookingValidationServiceMock = vi.hoisted(() => vi.fn());
const routeHandlerClientFactoryMock = vi.hoisted(() => vi.fn());
const serviceFromMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/env', () => ({
  env: {
    reserve: { defaultDurationMinutes: 90 },
  },
}));

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: routeHandlerClientFactoryMock,
  getServiceSupabaseClient: vi.fn(() => ({ from: serviceFromMock })),
  getTenantServiceSupabaseClient: vi.fn(() => ({ kind: 'tenant-client' })),
}));

vi.mock('@/server/team/access', () => ({
  fetchUserMemberships: fetchUserMembershipsMock,
  requireMembershipForRestaurant: requireMembershipForRestaurantMock,
  MembershipAccessError: class MembershipAccessError extends Error {},
}));

vi.mock('@/server/security/rate-limit', () => ({
  consumeRateLimit: consumeRateLimitMock,
}));

vi.mock('@/server/restaurants/schedule', () => ({
  getRestaurantSchedule: getRestaurantScheduleMock,
}));

vi.mock('@/server/restaurants/turnBands', () => ({
  getRestaurantTurnBands: getRestaurantTurnBandsMock,
}));

vi.mock('@/server/bookings/duration', () => ({
  resolveBookingDurationMinutes: resolveBookingDurationMinutesMock,
}));

vi.mock('@/server/bookings/modification-flow', () => ({
  beginBookingModificationFlow: vi.fn(),
}));

vi.mock('@/server/booking', () => ({
  createBookingValidationService: createBookingValidationServiceMock,
  BookingValidationError: class BookingValidationError extends Error {},
}));

vi.mock('@/server/booking/http', () => ({
  mapValidationFailure: vi.fn(),
  withValidationHeaders: vi.fn((response: unknown) => response),
}));

vi.mock('@/server/bookings', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    buildBookingAuditSnapshot: vi.fn(() => ({})),
    inferMealTypeFromTime: vi.fn(() => 'dinner'),
    logAuditEvent: vi.fn(async () => undefined),
    softCancelBooking: vi.fn(),
    updateBookingRecord: updateBookingRecordMock,
  };
});

vi.mock('@/server/jobs/booking-side-effects', () => ({
  enqueueBookingCancelledSideEffects: vi.fn(),
  enqueueBookingUpdatedSideEffects: vi.fn(async () => undefined),
  safeBookingPayload: vi.fn((booking: unknown) => booking),
}));

vi.mock('@/server/runtime-policy', () => ({
  getBookingPastTimeGraceMinutes: vi.fn(() => 5),
  isBookingPastTimeBlockingEnabled: vi.fn(() => false),
  isDbStrictConstraintMappingEnabled: vi.fn(() => false),
  isUnifiedBookingValidationEnabled: vi.fn(() => true),
}));

vi.mock('@/server/ops/bookings', () => ({
  invalidateOpsDashboardCaches: vi.fn(),
}));

import { withBookingAuthorization } from '@/server/auth/guards';
import { GET as listBookings } from '@/src/app/api/ops/bookings/route';
import { PATCH as patchBooking } from '@/src/app/api/ops/bookings/[id]/route';

const BOOKING_ID = '4f7c1f6a-52ef-4444-9df1-3f4f9a4e21aa';
const RESTAURANT_ID = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';
const USER = { id: 'aa1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb00', email: 'ops@nabatable.com' };

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void };
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ops bookings list route concurrency', () => {
  it('starts the membership lookup before the rate-limit check resolves', async () => {
    tenantAuthGetUserMock.mockResolvedValue({ data: { user: USER }, error: null });
    routeHandlerClientFactoryMock.mockResolvedValue({
      auth: { getUser: tenantAuthGetUserMock },
    });

    const rateLimitGate = deferred<{ ok: boolean }>();
    let membershipsStartedBeforeRateLimitResolved = false;
    consumeRateLimitMock.mockImplementation(() => rateLimitGate.promise);
    fetchUserMembershipsMock.mockImplementation(async () => {
      membershipsStartedBeforeRateLimitResolved = true;
      return [];
    });

    const responsePromise = listBookings(
      new NextRequest('https://app.nabatable.com/api/ops/bookings', { method: 'GET' }),
    );

    // Let the route reach the rate-limit await, then verify memberships already started.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchUserMembershipsMock).toHaveBeenCalledTimes(1);
    expect(membershipsStartedBeforeRateLimitResolved).toBe(true);

    rateLimitGate.resolve({ ok: true });
    const response = await responsePromise;
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ items: [] });
  });
});

describe('withBookingAuthorization concurrency', () => {
  it('issues the booking lookup while getUser is still in flight', async () => {
    const authGate = deferred<{ data: { user: typeof USER }; error: null }>();
    let bookingLookupStartedBeforeAuthResolved = false;

    const bookingQuery = {
      select: vi.fn(() => bookingQuery),
      eq: vi.fn(() => bookingQuery),
      maybeSingle: vi.fn(() => {
        bookingLookupStartedBeforeAuthResolved = true;
        return Promise.resolve({ data: { id: BOOKING_ID, restaurant_id: RESTAURANT_ID } });
      }),
    };
    routeHandlerClientFactoryMock.mockResolvedValue({
      auth: { getUser: vi.fn(() => authGate.promise) },
      from: vi.fn(() => bookingQuery),
    });
    requireMembershipForRestaurantMock.mockResolvedValue({
      restaurant_id: RESTAURANT_ID,
      role: 'manager',
    });

    const resultPromise = withBookingAuthorization(
      new NextRequest('https://app.nabatable.com/api/ops/bookings/x/dialog', { method: 'GET' }),
      BOOKING_ID,
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(bookingLookupStartedBeforeAuthResolved).toBe(true);

    authGate.resolve({ data: { user: USER }, error: null });
    const result = await resultPromise;
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.restaurantId).toBe(RESTAURANT_ID);
    }
  });

  it('still rejects unauthenticated requests (auth outcome wins over the lookup)', async () => {
    const bookingQuery = {
      select: vi.fn(() => bookingQuery),
      eq: vi.fn(() => bookingQuery),
      maybeSingle: vi.fn(() =>
        Promise.resolve({ data: { id: BOOKING_ID, restaurant_id: RESTAURANT_ID } }),
      ),
    };
    routeHandlerClientFactoryMock.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: null }, error: null })) },
      from: vi.fn(() => bookingQuery),
    });

    const result = await withBookingAuthorization(
      new NextRequest('https://app.nabatable.com/api/ops/bookings/x/dialog', { method: 'GET' }),
      BOOKING_ID,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // 419 is the app's session-expired response for unauthenticated ops calls.
      expect(result.response.status).toBe(419);
    }
    expect(requireMembershipForRestaurantMock).not.toHaveBeenCalled();
  });
});

describe('ops booking PATCH query dedupe (unified path)', () => {
  it('fetches memberships and the schedule at most once per request', async () => {
    tenantAuthGetUserMock.mockResolvedValue({ data: { user: USER }, error: null });
    routeHandlerClientFactoryMock.mockResolvedValue({
      auth: { getUser: tenantAuthGetUserMock },
    });
    fetchUserMembershipsMock.mockResolvedValue([
      { restaurant_id: RESTAURANT_ID, role: 'manager' },
    ]);

    const existingBooking = {
      id: BOOKING_ID,
      restaurant_id: RESTAURANT_ID,
      booking_date: '2026-07-21',
      start_time: '18:00',
      end_time: '19:30',
      start_at: '2026-07-21T17:00:00.000Z',
      end_at: '2026-07-21T18:30:00.000Z',
      party_size: 2,
      status: 'confirmed',
      booking_type: 'dinner',
      notes: null,
      customer_id: null,
      customer_name: 'Guest',
      customer_email: null,
      customer_phone: null,
      marketing_opt_in: false,
      source: 'web',
      idempotency_key: null,
      client_request_id: null,
      seating_preference: null,
      restaurants: {
        name: 'Test',
        slug: 'test',
        timezone: 'Europe/London',
        reservation_interval_minutes: 15,
      },
    };
    const bookingLookup = {
      select: vi.fn(() => bookingLookup),
      eq: vi.fn(() => bookingLookup),
      in: vi.fn(() => bookingLookup),
      maybeSingle: vi.fn(async () => ({ data: existingBooking, error: null })),
    };
    serviceFromMock.mockReturnValue(bookingLookup);

    getRestaurantScheduleMock.mockResolvedValue({
      date: '2026-07-21',
      timezone: 'Europe/London',
      slots: [],
    });
    getRestaurantTurnBandsMock.mockResolvedValue({});
    resolveBookingDurationMinutesMock.mockResolvedValue({
      bookingOption: 'dinner',
      durationMinutes: 90,
    });
    updateBookingRecordMock.mockResolvedValue({ ...existingBooking, start_time: '19:00' });
    createBookingValidationServiceMock.mockReturnValue({
      updateWithEnforcement: vi.fn(async () => ({
        booking: existingBooking,
        response: { overridden: false },
      })),
    });

    const response = await patchBooking(
      new NextRequest(`https://app.nabatable.com/api/ops/bookings/${BOOKING_ID}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          origin: 'https://app.nabatable.com',
        },
        body: JSON.stringify({
          startIso: '2026-07-21T18:00:00.000+01:00',
          partySize: 2,
        }),
      }),
      { params: Promise.resolve({ id: BOOKING_ID }) },
    );

    expect(response.status).toBe(200);
    // One membership fetch for the whole request (was 2: route + unified handler).
    expect(fetchUserMembershipsMock).toHaveBeenCalledTimes(1);
    // Schedule fetched at most once (was re-fetched inside the unified handler).
    expect(getRestaurantScheduleMock.mock.calls.length).toBeLessThanOrEqual(1);
  });
});
