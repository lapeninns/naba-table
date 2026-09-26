import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const RESTAURANT_ID = vi.hoisted(() => '11111111-1111-4111-8111-111111111111');
const tenantAuthGetUserMock = vi.hoisted(() => vi.fn());
const serviceFromMock = vi.hoisted(() => vi.fn());
const getRestaurantScheduleMock = vi.hoisted(() => vi.fn());
const softCancelBookingMock = vi.hoisted(() => vi.fn());
const clearBookingTableAssignmentsMock = vi.hoisted(() => vi.fn());
const fetchBookingsForContactMock = vi.hoisted(() => vi.fn());
const logAuditEventMock = vi.hoisted(() => vi.fn());
const enqueueBookingCancelledSideEffectsMock = vi.hoisted(() => vi.fn());
const consumeRateLimitMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/env', () => ({
  env: {
    node: {
      env: 'test',
    },
    security: {
      sessionRecoveryAccessTokenSecret: 'test-session-recovery-secret',
    },
  },
}));

vi.mock('@/server/auth/guards', () => ({
  GuardError: class GuardError extends Error {
    status: number;
    code: string;
    details: unknown;

    constructor(input: { status: number; code: string; message: string; details?: unknown }) {
      super(input.message);
      this.status = input.status;
      this.code = input.code;
      this.details = input.details ?? null;
    }
  },
  listUserRestaurantMemberships: vi.fn(),
  requireSession: vi.fn(),
}));

vi.mock('@/server/bookings', () => ({
  BOOKING_TYPES: ['lunch', 'dinner'],
  buildBookingAuditSnapshot: vi.fn(() => ({})),
  clearBookingTableAssignments: clearBookingTableAssignmentsMock,
  deriveEndTimeFromDuration: vi.fn(() => '20:30'),
  fetchBookingsForContact: fetchBookingsForContactMock,
  inferMealTypeFromTime: vi.fn(() => 'dinner'),
  logAuditEvent: logAuditEventMock,
  softCancelBooking: softCancelBookingMock,
  updateBookingRecord: vi.fn(),
}));

vi.mock('@/server/bookings/modification-flow', () => ({
  beginBookingModificationFlow: vi.fn(),
}));

vi.mock('@/server/observability', () => ({
  recordObservabilityEvent: vi.fn(),
}));

vi.mock('@/server/jobs/booking-side-effects', () => ({
  enqueueBookingCancelledSideEffects: enqueueBookingCancelledSideEffectsMock,
  enqueueBookingUpdatedSideEffects: vi.fn(),
  safeBookingPayload: vi.fn((booking) => booking),
}));

vi.mock('@/server/restaurants/schedule', () => ({
  getRestaurantSchedule: getRestaurantScheduleMock,
}));

vi.mock('@/server/security/rate-limit', () => ({
  consumeRateLimit: consumeRateLimitMock,
}));

vi.mock('@/server/supabase', () => ({
  getDefaultRestaurantId: vi.fn(async () => RESTAURANT_ID),
  getRouteHandlerSupabaseClient: vi.fn(async () => ({
    auth: {
      getUser: tenantAuthGetUserMock,
    },
  })),
  getServiceSupabaseClient: vi.fn(() => ({
    from: serviceFromMock,
  })),
  MissingRestaurantContextError: class MissingRestaurantContextError extends Error {},
}));

vi.mock('@reserve/shared/validation', () => ({
  CUSTOMER_PHONE_LENGTH_MAX: 20,
  CUSTOMER_PHONE_LENGTH_MIN: 10,
  isUKPhone: vi.fn(() => true),
}));

import { DELETE } from '@/src/app/api/bookings/[id]/route';

import { guestRequestHeaders, guestTokenHeaders } from './helpers/guestBookingAccess';

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: '65c3207e-318a-4e4b-b82d-1249a720d776',
    restaurant_id: RESTAURANT_ID,
    customer_id: 'cust-1',
    booking_date: '2026-07-01',
    start_time: '19:00',
    end_time: '20:30',
    start_at: null,
    end_at: null,
    reference: 'NB123456',
    party_size: 2,
    booking_type: 'dinner',
    seating_preference: 'any',
    status: 'confirmed',
    checked_in_at: null,
    customer_name: 'Alex Guest',
    customer_email: 'alex@example.com',
    customer_phone: '+447700900123',
    notes: null,
    marketing_opt_in: false,
    auth_user_id: null,
    client_request_id: 'request-1',
    idempotency_key: 'idem-1',
    details: null,
    created_at: '2026-06-01T12:00:00.000Z',
    updated_at: '2026-06-01T12:00:00.000Z',
    ...overrides,
  };
}

function makeBookingLookup(booking: Record<string, unknown> | null) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn().mockResolvedValue({ data: booking, error: null }),
  };
  return builder;
}

function makeDeleteRequest(headers: Record<string, string> = guestRequestHeaders()) {
  return new NextRequest(
    'https://www.nabatable.com/api/bookings/65c3207e-318a-4e4b-b82d-1249a720d776',
    {
      method: 'DELETE',
      headers,
    },
  );
}

describe('public DELETE /api/bookings/[id]', () => {
  beforeEach(() => {
    // Pin the wall clock so the 2026-07-01 19:00 Europe/London fixtures stay in the
    // future for the real-clock guest-modification lock (SERVICE_STARTED). Instant
    // matches the suite family's injected time providers (now = 2026-05-16).
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-16T12:00:00.000Z'));
    tenantAuthGetUserMock.mockReset();
    tenantAuthGetUserMock.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'alex@example.com' } },
      error: null,
    });
    serviceFromMock.mockReset();
    getRestaurantScheduleMock.mockReset();
    getRestaurantScheduleMock.mockResolvedValue({ timezone: 'Europe/London' });
    softCancelBookingMock.mockReset();
    softCancelBookingMock.mockResolvedValue({
      booking: makeBooking({ status: 'cancelled' }),
      cancelled: true,
    });
    clearBookingTableAssignmentsMock.mockReset();
    clearBookingTableAssignmentsMock.mockResolvedValue(undefined);
    fetchBookingsForContactMock.mockReset();
    fetchBookingsForContactMock.mockResolvedValue([]);
    logAuditEventMock.mockReset();
    logAuditEventMock.mockResolvedValue(undefined);
    enqueueBookingCancelledSideEffectsMock.mockReset();
    enqueueBookingCancelledSideEffectsMock.mockResolvedValue(undefined);
    consumeRateLimitMock.mockReset();
    consumeRateLimitMock.mockResolvedValue({
      ok: true,
      limit: 10,
      remaining: 9,
      resetAt: Date.now() + 60_000,
      source: 'memory',
    });
  });

  it('rejects a cancellation without the CSRF double-submit token', async () => {
    serviceFromMock.mockReturnValueOnce(makeBookingLookup(makeBooking({ auth_user_id: 'user-1' })));

    const response = await DELETE(makeDeleteRequest({}), {
      params: Promise.resolve({ id: '65c3207e-318a-4e4b-b82d-1249a720d776' }),
    });

    expect(response.status).toBe(403);
    expect(softCancelBookingMock).not.toHaveBeenCalled();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects authenticated email-only cancellation of an unbound guest booking', async () => {
    const lookup = makeBookingLookup(makeBooking({ auth_user_id: null }));
    serviceFromMock.mockReturnValueOnce(lookup);

    const response = await DELETE(makeDeleteRequest(), {
      params: Promise.resolve({ id: '65c3207e-318a-4e4b-b82d-1249a720d776' }),
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe('BOOKING_NOT_FOUND');
    expect(lookup.eq).toHaveBeenCalledWith('id', '65c3207e-318a-4e4b-b82d-1249a720d776');
    expect(softCancelBookingMock).not.toHaveBeenCalled();
    expect(clearBookingTableAssignmentsMock).not.toHaveBeenCalled();
  });

  it('allows authenticated cancellation when the booking is bound to the user id', async () => {
    serviceFromMock.mockReturnValueOnce(makeBookingLookup(makeBooking({ auth_user_id: 'user-1' })));

    const response = await DELETE(makeDeleteRequest(), {
      params: Promise.resolve({ id: '65c3207e-318a-4e4b-b82d-1249a720d776' }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      id: '65c3207e-318a-4e4b-b82d-1249a720d776',
      status: 'cancelled',
    });
    expect(softCancelBookingMock).toHaveBeenCalledWith(
      expect.anything(),
      '65c3207e-318a-4e4b-b82d-1249a720d776',
      {
        restaurantId: RESTAURANT_ID,
      },
    );
    expect(clearBookingTableAssignmentsMock).not.toHaveBeenCalled();
    expect(enqueueBookingCancelledSideEffectsMock).toHaveBeenCalledOnce();
  });

  it('does not replay cancellation side effects for already cancelled bookings', async () => {
    serviceFromMock.mockReturnValueOnce(
      makeBookingLookup(makeBooking({ auth_user_id: 'user-1', status: 'cancelled' })),
    );

    const response = await DELETE(makeDeleteRequest(), {
      params: Promise.resolve({ id: '65c3207e-318a-4e4b-b82d-1249a720d776' }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      id: '65c3207e-318a-4e4b-b82d-1249a720d776',
      status: 'cancelled',
    });
    expect(softCancelBookingMock).not.toHaveBeenCalled();
    expect(clearBookingTableAssignmentsMock).not.toHaveBeenCalled();
    expect(logAuditEventMock).not.toHaveBeenCalled();
    expect(enqueueBookingCancelledSideEffectsMock).not.toHaveBeenCalled();
  });

  it('applies guest self-service locks to booking-cookie cancellation', async () => {
    serviceFromMock.mockReturnValueOnce(
      makeBookingLookup(
        makeBooking({
          auth_user_id: null,
          status: 'checked_in',
          checked_in_at: '2026-07-01T18:55:00.000Z',
        }),
      ),
    );

    const response = await DELETE(
      new NextRequest(
        'https://www.nabatable.com/api/bookings/65c3207e-318a-4e4b-b82d-1249a720d776',
        {
          method: 'DELETE',
          headers: guestTokenHeaders(makeBooking()),
        },
      ),
      {
        params: Promise.resolve({ id: '65c3207e-318a-4e4b-b82d-1249a720d776' }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe('CHECKED_IN_LOCKED');
    expect(softCancelBookingMock).not.toHaveBeenCalled();
    expect(clearBookingTableAssignmentsMock).not.toHaveBeenCalled();
  });

  it('scopes booking-cookie cancellation lookups to the token restaurant', async () => {
    const lookup = makeBookingLookup(makeBooking({ auth_user_id: null }));
    serviceFromMock.mockReturnValueOnce(lookup);

    await DELETE(
      new NextRequest(
        'https://www.nabatable.com/api/bookings/65c3207e-318a-4e4b-b82d-1249a720d776',
        {
          method: 'DELETE',
          headers: guestTokenHeaders(makeBooking()),
        },
      ),
      {
        params: Promise.resolve({ id: '65c3207e-318a-4e4b-b82d-1249a720d776' }),
      },
    );

    expect(lookup.eq).toHaveBeenCalledWith('id', '65c3207e-318a-4e4b-b82d-1249a720d776');
    expect(lookup.eq).toHaveBeenCalledWith('restaurant_id', RESTAURANT_ID);
    expect(softCancelBookingMock).toHaveBeenCalledWith(
      expect.anything(),
      '65c3207e-318a-4e4b-b82d-1249a720d776',
      {
        restaurantId: RESTAURANT_ID,
      },
    );
  });

  it('answers 409 BOOKING_NOT_CANCELLABLE when the DB guard refuses (checked in meanwhile)', async () => {
    serviceFromMock.mockReturnValueOnce(makeBookingLookup(makeBooking({ auth_user_id: null })));
    // Mirrors server/bookings.ts BookingNotCancellableError (S3a), including its code.
    const refused = Object.assign(new Error('booking_not_cancellable: SECRET_DB_DETAIL'), {
      name: 'BookingNotCancellableError',
      code: 'BOOKING_NOT_CANCELLABLE',
      currentStatus: 'checked_in',
    });
    softCancelBookingMock.mockRejectedValueOnce(refused);

    const response = await DELETE(
      new NextRequest(
        'https://www.nabatable.com/api/bookings/65c3207e-318a-4e4b-b82d-1249a720d776',
        { method: 'DELETE', headers: guestTokenHeaders(makeBooking()) },
      ),
      { params: Promise.resolve({ id: '65c3207e-318a-4e4b-b82d-1249a720d776' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      error: 'This booking can no longer be cancelled.',
      code: 'BOOKING_NOT_CANCELLABLE',
      message: 'This booking can no longer be cancelled.',
      retryable: false,
      details: { currentStatus: 'checked_in' },
    });
    expect(JSON.stringify(body)).not.toContain('SECRET_DB_DETAIL');
    expect(logAuditEventMock).not.toHaveBeenCalled();
    expect(enqueueBookingCancelledSideEffectsMock).not.toHaveBeenCalled();
  });
});
