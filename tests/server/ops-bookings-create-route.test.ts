import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUserMock = vi.hoisted(() => vi.fn());
const requireMembershipForRestaurantMock = vi.hoisted(() => vi.fn());
const fetchUserMembershipsMock = vi.hoisted(() => vi.fn());
const getRestaurantScheduleMock = vi.hoisted(() => vi.fn());
const getRestaurantTurnBandsMock = vi.hoisted(() => vi.fn());
const resolveBookingDurationMinutesMock = vi.hoisted(() => vi.fn());
const upsertCustomerMock = vi.hoisted(() => vi.fn());
const fetchBookingsForContactMock = vi.hoisted(() => vi.fn());
const insertBookingRecordMock = vi.hoisted(() => vi.fn());
const createWithEnforcementMock = vi.hoisted(() => vi.fn());
const enqueueBookingCreatedSideEffectsMock = vi.hoisted(() => vi.fn());
const consumeRateLimitMock = vi.hoisted(() => vi.fn());
const recordObservabilityEventMock = vi.hoisted(() => vi.fn());
const autoAssignEnabledMock = vi.hoisted(() => vi.fn(() => false));
const retrySchedulerMock = vi.hoisted(() => vi.fn());
const inlineAutoAssignMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/bookings/auto-assign-domain', () => ({
  scheduleBookingCreateAutoAssignRetry: retrySchedulerMock,
}));
vi.mock('@/services/inline-auto-assign', () => ({ runInlineAutoAssign: inlineAutoAssignMock }));

const queryChain = vi.hoisted(() => {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    not: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    maybeSingle: vi.fn(),
  };
  return chain;
});
const maybeSingleMock = queryChain.maybeSingle;
const fromMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/env', () => ({ env: {} }));

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: getUserMock },
  })),
  getServiceSupabaseClient: vi.fn(() => ({ from: fromMock })),
}));

vi.mock('@/server/team/access', () => ({
  requireMembershipForRestaurant: requireMembershipForRestaurantMock,
  fetchUserMemberships: fetchUserMembershipsMock,
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

vi.mock('@/server/customers', () => ({
  normalizeEmail: (value: string) => value.trim().toLowerCase(),
  normalizePhone: (value: string | null | undefined) => value ?? null,
  upsertCustomer: upsertCustomerMock,
}));

vi.mock('@/server/bookings', () => ({
  deriveEndTimeFromDuration: vi.fn(() => '21:00'),
  fetchBookingsForContact: fetchBookingsForContactMock,
  inferMealTypeFromTime: vi.fn(() => 'dinner'),
  insertBookingRecord: insertBookingRecordMock,
  logAuditEvent: vi.fn(),
}));

vi.mock('@/server/booking', () => ({
  createBookingValidationService: vi.fn(() => ({
    createWithEnforcement: createWithEnforcementMock,
  })),
  BookingValidationError: class BookingValidationError extends Error {
    response: { ok: false; issues: Array<Record<string, unknown>> };

    constructor(response?: { ok: false; issues: Array<Record<string, unknown>> }) {
      super('Booking validation failed');
      this.response = response ?? { ok: false, issues: [] };
    }
  },
}));

vi.mock('@/server/booking/http', () => ({
  mapValidationFailure: vi.fn((response: { issues: unknown[] }) => ({
    body: { ok: false, issues: response.issues },
    status: 400,
  })),
  withValidationHeaders: vi.fn((options) => options),
}));

vi.mock('@/server/runtime-policy', () => ({
  getBookingPastTimeGraceMinutes: vi.fn(() => 5),
  getInlineAutoAssignTimeoutMs: vi.fn(() => 4_000),
  isAutoAssignOnBookingEnabled: autoAssignEnabledMock,
  isBookingPastTimeBlockingEnabled: vi.fn(() => false),
}));

vi.mock('@/server/jobs/booking-side-effects', () => ({
  enqueueBookingCreatedSideEffects: enqueueBookingCreatedSideEffectsMock,
  safeBookingPayload: vi.fn((booking) => booking),
}));

vi.mock('@/server/observability', () => ({
  recordObservabilityEvent: recordObservabilityEventMock,
}));

vi.mock('@/server/security/rate-limit', () => ({
  consumeRateLimit: consumeRateLimitMock,
}));

vi.mock('@/server/security/request', () => ({
  anonymizeIp: vi.fn((ip: string) => `anon:${ip}`),
  extractClientIp: vi.fn(() => '203.0.113.10'),
}));

import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '@/lib/security/csrf';
import { BookingValidationError } from '@/server/booking';
import { POST } from '@/src/app/api/ops/bookings/route';

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';
const CSRF_TOKEN = 'ops-bookings-create-csrf-token';

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'booking-1',
    restaurant_id: RESTAURANT_ID,
    booking_date: '2026-07-01',
    start_time: '19:30',
    end_time: '21:00',
    party_size: 4,
    booking_type: 'dinner',
    seating_preference: 'any',
    status: 'pending',
    customer_id: 'customer-1',
    customer_name: 'Alex Guest',
    customer_email: 'alex@example.com',
    customer_phone: '',
    client_request_id: 'client-request-1',
    ...overrides,
  };
}

describe('POST /api/ops/bookings', () => {
  beforeEach(() => {
    autoAssignEnabledMock.mockReturnValue(false);
    retrySchedulerMock.mockReset();
    inlineAutoAssignMock.mockReset();
    getUserMock.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'ops@example.com' } },
      error: null,
    });
    requireMembershipForRestaurantMock.mockResolvedValue(undefined);
    fetchUserMembershipsMock.mockResolvedValue([{ restaurant_id: RESTAURANT_ID, role: 'owner' }]);
    getRestaurantScheduleMock.mockResolvedValue({
      date: '2026-07-01',
      timezone: 'Europe/London',
      slots: [{ value: '19:30', bookingOption: 'dinner', disabled: false }],
      isClosed: false,
    });
    getRestaurantTurnBandsMock.mockResolvedValue(null);
    resolveBookingDurationMinutesMock.mockResolvedValue({ durationMinutes: 90 });
    upsertCustomerMock.mockReset();
    upsertCustomerMock.mockResolvedValue({ id: 'customer-1' });
    fromMock.mockReset();
    fromMock.mockImplementation(() => queryChain);
    for (const fn of [queryChain.select, queryChain.eq, queryChain.not, queryChain.order, queryChain.limit]) {
      fn.mockClear();
    }
    maybeSingleMock.mockReset();
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
    createWithEnforcementMock.mockReset();
    enqueueBookingCreatedSideEffectsMock.mockReset();
    createWithEnforcementMock.mockResolvedValue({
      booking: makeBooking(),
      response: { ok: true, overridden: false, overrideCodes: [] },
      duplicate: false,
    });
    fetchBookingsForContactMock.mockResolvedValue([]);
    enqueueBookingCreatedSideEffectsMock.mockResolvedValue(undefined);
    consumeRateLimitMock.mockResolvedValue({
      ok: true,
      limit: 60,
      remaining: 59,
      resetAt: Date.now() + 60_000,
      source: 'memory',
    });
    recordObservabilityEventMock.mockResolvedValue(undefined);
    insertBookingRecordMock.mockReset();
  });

  it('schedules recovery for a confirmed walk-in when inline assignment times out', async () => {
    autoAssignEnabledMock.mockReturnValue(true);
    inlineAutoAssignMock.mockResolvedValue(null);
    createWithEnforcementMock.mockResolvedValue({
      booking: makeBooking({ status: 'confirmed' }),
      response: { ok: true, overridden: false, overrideCodes: [] },
      duplicate: false,
    });

    const response = await POST(
      new NextRequest('https://app.nabatable.com/api/ops/bookings', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [CSRF_HEADER_NAME]: CSRF_TOKEN,
          cookie: `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}`,
        },
        body: JSON.stringify({
          restaurantId: RESTAURANT_ID,
          date: '2026-07-01',
          time: '19:30',
          party: 4,
          bookingType: 'dinner',
          seating: 'any',
          name: 'Alex Guest',
          email: 'alex@example.com',
          phone: null,
          marketingOptIn: false,
          whatsappOptIn: false,
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(retrySchedulerMock).toHaveBeenCalledWith({
      autoAssignEnabled: true,
      bookingId: 'booking-1',
      bookingStatus: 'confirmed',
    });
  });

  it('uses capacity-enforced creation', async () => {
    const response = await POST(
      new NextRequest('https://app.nabatable.com/api/ops/bookings', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [CSRF_HEADER_NAME]: CSRF_TOKEN,
          cookie: `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}`,
        },
        body: JSON.stringify({
          restaurantId: RESTAURANT_ID,
          date: '2026-07-01',
          time: '19:30',
          party: 4,
          bookingType: 'dinner',
          seating: 'any',
          name: 'Alex Guest',
          email: 'alex@example.com',
          phone: null,
          marketingOptIn: false,
          whatsappOptIn: false,
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(createWithEnforcementMock).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: RESTAURANT_ID,
        partySize: 4,
        start: '2026-07-01T19:30:00.000+01:00',
      }),
      expect.objectContaining({
        actorId: 'user-1',
        actorCapabilities: ['booking.override'],
      }),
    );
    expect(insertBookingRecordMock).not.toHaveBeenCalled();
    expect(enqueueBookingCreatedSideEffectsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: RESTAURANT_ID,
      }),
    );
  });

  it('rejects emails containing PostgREST filter control characters before customer upsert', async () => {
    const response = await POST(
      new NextRequest('https://app.nabatable.com/api/ops/bookings', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [CSRF_HEADER_NAME]: CSRF_TOKEN,
          cookie: `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}`,
        },
        body: JSON.stringify({
          restaurantId: RESTAURANT_ID,
          date: '2026-07-01',
          time: '19:30',
          party: 4,
          bookingType: 'dinner',
          seating: 'any',
          name: 'Alex Guest',
          email: 'x",id.not.is.null,email_normalized.eq."y@z.co',
          phone: null,
          marketingOptIn: false,
          whatsappOptIn: false,
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(upsertCustomerMock).not.toHaveBeenCalled();
    expect(createWithEnforcementMock).not.toHaveBeenCalled();
  });

  describe('idempotency and C1 errors', () => {
    const KEY = '0f8fad5b-d9cb-469f-a165-70867728950e';
    const walkInBody = {
      restaurantId: RESTAURANT_ID,
      date: '2026-07-01',
      time: '19:30',
      party: 4,
      bookingType: 'dinner',
      seating: 'any',
      name: 'Alex Guest',
      email: 'alex@example.com',
      phone: null,
      marketingOptIn: false,
      whatsappOptIn: false,
    };

    function postWalkIn(body: Record<string, unknown> = walkInBody, key: string | null = KEY) {
      return POST(
        new NextRequest('https://app.nabatable.com/api/ops/bookings', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            [CSRF_HEADER_NAME]: CSRF_TOKEN,
            cookie: `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}`,
            ...(key ? { 'Idempotency-Key': key } : {}),
          },
          body: JSON.stringify(body),
        }),
      );
    }

    it('replays the booking stored under the same key without writing a customer or booking', async () => {
      maybeSingleMock.mockResolvedValueOnce({
        data: makeBooking({ idempotency_key: KEY, start_time: '19:30:00' }),
        error: null,
      });

      const response = await postWalkIn();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toMatchObject({ duplicate: true, booking: { id: 'booking-1' } });
      expect(queryChain.eq).toHaveBeenCalledWith('idempotency_key', KEY);
      expect(upsertCustomerMock).not.toHaveBeenCalled();
      expect(createWithEnforcementMock).not.toHaveBeenCalled();
      expect(enqueueBookingCreatedSideEffectsMock).not.toHaveBeenCalled();
    });

    it('rejects the same key with a different party size as 409 IDEMPOTENCY_KEY_REUSED', async () => {
      maybeSingleMock.mockResolvedValueOnce({
        data: makeBooking({ idempotency_key: KEY, party_size: 2 }),
        error: null,
      });

      const response = await postWalkIn();
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body).toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED', retryable: false });
      expect(body).not.toHaveProperty('booking');
      expect(upsertCustomerMock).not.toHaveBeenCalled();
      expect(createWithEnforcementMock).not.toHaveBeenCalled();
      expect(JSON.stringify(recordObservabilityEventMock.mock.calls)).not.toContain(KEY);
    });

    it('creates a new booking when the only same-slot booking was cancelled (signature ignores it)', async () => {
      const response = await postWalkIn();

      expect(response.status).toBe(201);
      expect(queryChain.not).toHaveBeenCalledWith('status', 'in', '(cancelled,no_show)');
      expect(queryChain.eq).toHaveBeenCalledWith('party_size', 4);
      expect(createWithEnforcementMock).toHaveBeenCalledWith(
        expect.objectContaining({ idempotencyKey: KEY }),
        expect.anything(),
      );
    });

    it('maps the create RPC key conflict to 409 IDEMPOTENCY_KEY_REUSED', async () => {
      createWithEnforcementMock.mockRejectedValueOnce(
        new BookingValidationError({
          ok: false,
          issues: [{ code: 'UNKNOWN', message: 'x', detail: { idempotencyConflict: true } }],
        }),
      );

      const response = await postWalkIn();

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
    });

    it('keeps a transient create race retryable', async () => {
      createWithEnforcementMock.mockRejectedValueOnce(
        new BookingValidationError({
          ok: false,
          issues: [{ code: 'CAPACITY_EXCEEDED', message: 'x', detail: { bookingConflict: true } }],
        }),
      );

      const response = await postWalkIn();

      expect(response.status).toBe(409);
      expect(response.headers.get('Retry-After')).toBe('1');
      await expect(response.json()).resolves.toMatchObject({
        code: 'BOOKING_CONFLICT',
        retryable: true,
        retryAfter: 1,
      });
    });

    it('adds C1 fields to validation failures and keeps the issues', async () => {
      createWithEnforcementMock.mockRejectedValueOnce(
        new BookingValidationError({
          ok: false,
          issues: [{ code: 'OUTSIDE_HOURS', message: 'Outside operating hours.' }],
        }),
      );

      const response = await postWalkIn();

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        code: 'OUTSIDE_HOURS',
        error: 'Outside operating hours.',
        message: 'Outside operating hours.',
        issues: [{ code: 'OUTSIDE_HOURS' }],
      });
    });

    it('returns C1 VALIDATION_FAILED with field messages for an invalid payload', async () => {
      const response = await postWalkIn({ ...walkInBody, party: 0 });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.code).toBe('VALIDATION_FAILED');
      expect(body.fields).toHaveProperty('party');
    });

    it('returns C1 401 and 403', async () => {
      getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null });
      const unauthenticated = await postWalkIn();
      expect(unauthenticated.status).toBe(401);
      await expect(unauthenticated.json()).resolves.toMatchObject({ code: 'UNAUTHENTICATED' });

      requireMembershipForRestaurantMock.mockRejectedValueOnce(new Error('not a member'));
      const forbidden = await postWalkIn();
      expect(forbidden.status).toBe(403);
      await expect(forbidden.json()).resolves.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('never returns raw database text for unexpected failures', async () => {
      createWithEnforcementMock.mockRejectedValueOnce(
        new Error('duplicate key value violates unique constraint "bookings_pkey"'),
      );

      const response = await postWalkIn();
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.code).toBe('INTERNAL_ERROR');
      expect(JSON.stringify(body)).not.toContain('constraint');
    });
  });
});
