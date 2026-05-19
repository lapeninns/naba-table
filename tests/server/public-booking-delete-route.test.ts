import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const tenantAuthGetUserMock = vi.hoisted(() => vi.fn());
const serviceFromMock = vi.hoisted(() => vi.fn());
const getRestaurantScheduleMock = vi.hoisted(() => vi.fn());
const softCancelBookingMock = vi.hoisted(() => vi.fn());
const clearBookingTableAssignmentsMock = vi.hoisted(() => vi.fn());
const fetchBookingsForContactMock = vi.hoisted(() => vi.fn());
const logAuditEventMock = vi.hoisted(() => vi.fn());
const enqueueBookingCancelledSideEffectsMock = vi.hoisted(() => vi.fn());
const sessionRecoveryTokenMatchesBookingContactMock = vi.hoisted(() => vi.fn());
const validateSessionRecoveryAccessTokenMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/env', () => ({
  env: {
    node: {
      env: 'test',
    },
    featureFlags: {
      pendingSelfServeGraceMinutes: 10,
      bookingPastTimeGraceMinutes: 5,
      bookingValidationUnified: false,
      holds: {
        enabled: true,
        strictConflicts: true,
      },
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

vi.mock('@/server/customers', () => ({
  normalizeEmail: vi.fn((value: string | null | undefined) => (value ?? '').trim().toLowerCase()),
}));

vi.mock('@/server/jobs/booking-side-effects', () => ({
  enqueueBookingCancelledSideEffects: enqueueBookingCancelledSideEffectsMock,
  enqueueBookingUpdatedSideEffects: vi.fn(),
  safeBookingPayload: vi.fn((booking) => booking),
}));

vi.mock('@/server/restaurants/schedule', () => ({
  getRestaurantSchedule: getRestaurantScheduleMock,
}));

vi.mock('@/server/security/api-rate-limit', () => ({
  requireApiRateLimit: vi.fn(async () => null),
}));

vi.mock('@/server/security/session-recovery-access-token', () => ({
  sessionRecoveryTokenMatchesBookingContact: sessionRecoveryTokenMatchesBookingContactMock,
  validateSessionRecoveryAccessToken: validateSessionRecoveryAccessTokenMock,
}));

vi.mock('@/server/supabase', () => ({
  getDefaultRestaurantId: vi.fn(async () => 'rest-1'),
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

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'booking-1',
    restaurant_id: 'rest-1',
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

function makeDeleteRequest() {
  return new NextRequest('https://www.nabatable.com/api/bookings/booking-1', {
    method: 'DELETE',
  });
}

describe('public DELETE /api/bookings/[id]', () => {
  beforeEach(() => {
    tenantAuthGetUserMock.mockReset();
    tenantAuthGetUserMock.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'alex@example.com' } },
      error: null,
    });
    serviceFromMock.mockReset();
    getRestaurantScheduleMock.mockReset();
    getRestaurantScheduleMock.mockResolvedValue({ timezone: 'Europe/London' });
    softCancelBookingMock.mockReset();
    softCancelBookingMock.mockResolvedValue(makeBooking({ status: 'cancelled' }));
    clearBookingTableAssignmentsMock.mockReset();
    clearBookingTableAssignmentsMock.mockResolvedValue(undefined);
    fetchBookingsForContactMock.mockReset();
    fetchBookingsForContactMock.mockResolvedValue([]);
    logAuditEventMock.mockReset();
    logAuditEventMock.mockResolvedValue(undefined);
    enqueueBookingCancelledSideEffectsMock.mockReset();
    enqueueBookingCancelledSideEffectsMock.mockResolvedValue(undefined);
    sessionRecoveryTokenMatchesBookingContactMock.mockReset();
    sessionRecoveryTokenMatchesBookingContactMock.mockReturnValue(false);
    validateSessionRecoveryAccessTokenMock.mockReset();
    validateSessionRecoveryAccessTokenMock.mockReturnValue({ ok: false, reason: 'invalid' });
  });

  it('rejects authenticated email-only cancellation of an unbound guest booking', async () => {
    const lookup = makeBookingLookup(makeBooking({ auth_user_id: null }));
    serviceFromMock.mockReturnValueOnce(lookup);

    const response = await DELETE(makeDeleteRequest(), {
      params: Promise.resolve({ id: 'booking-1' }),
    });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe('FORBIDDEN');
    expect(lookup.eq).toHaveBeenCalledWith('id', 'booking-1');
    expect(softCancelBookingMock).not.toHaveBeenCalled();
    expect(clearBookingTableAssignmentsMock).not.toHaveBeenCalled();
  });

  it('allows authenticated cancellation when the booking is bound to the user id', async () => {
    serviceFromMock.mockReturnValueOnce(makeBookingLookup(makeBooking({ auth_user_id: 'user-1' })));

    const response = await DELETE(makeDeleteRequest(), {
      params: Promise.resolve({ id: 'booking-1' }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ id: 'booking-1', status: 'cancelled', bookings: [] });
    expect(softCancelBookingMock).toHaveBeenCalledWith(expect.anything(), 'booking-1');
    expect(clearBookingTableAssignmentsMock).toHaveBeenCalledWith(expect.anything(), 'booking-1');
    expect(enqueueBookingCancelledSideEffectsMock).toHaveBeenCalledOnce();
  });

  it('applies guest self-service locks to session recovery cancellation', async () => {
    validateSessionRecoveryAccessTokenMock.mockReturnValue({
      ok: true,
      payload: {
        restaurantId: 'rest-1',
        email: 'alex@example.com',
        phone: '+447700900123',
      },
    });
    sessionRecoveryTokenMatchesBookingContactMock.mockReturnValue(true);
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
      new NextRequest('https://www.nabatable.com/api/bookings/booking-1', {
        method: 'DELETE',
        headers: {
          'x-session-recovery-token': 'valid-token',
        },
      }),
      {
        params: Promise.resolve({ id: 'booking-1' }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe('CHECKED_IN_LOCKED');
    expect(softCancelBookingMock).not.toHaveBeenCalled();
    expect(clearBookingTableAssignmentsMock).not.toHaveBeenCalled();
  });
});
