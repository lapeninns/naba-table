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

const maybeSingleMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    maybeSingle: maybeSingleMock,
  };
  return vi.fn(() => chain);
});

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
    response = { ok: false, issues: [] };
  },
}));

vi.mock('@/server/booking/http', () => ({
  mapValidationFailure: vi.fn(() => ({ body: { error: 'validation failed' }, status: 422 })),
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
    upsertCustomerMock.mockResolvedValue({ id: 'customer-1' });
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
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
});
