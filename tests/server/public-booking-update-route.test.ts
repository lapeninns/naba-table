import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const tenantAuthGetUserMock = vi.hoisted(() => vi.fn());
const serviceFromMock = vi.hoisted(() => vi.fn());
const getRestaurantScheduleMock = vi.hoisted(() => vi.fn());
const resolveBookingDurationMinutesMock = vi.hoisted(() => vi.fn());
const updateBookingRecordMock = vi.hoisted(() => vi.fn());
const beginBookingModificationFlowMock = vi.hoisted(() => vi.fn());
const logAuditEventMock = vi.hoisted(() => vi.fn());
const enqueueBookingUpdatedSideEffectsMock = vi.hoisted(() => vi.fn());
const sessionRecoveryTokenMatchesBookingContactMock = vi.hoisted(() => vi.fn());
const validateSessionRecoveryAccessTokenMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/env', () => ({
  env: {
    featureFlags: {
      pendingSelfServeGraceMinutes: 10,
      bookingPastTimeGraceMinutes: 5,
      bookingValidationUnified: false,
    },
    reserve: {
      defaultDurationMinutes: 90,
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
  clearBookingTableAssignments: vi.fn(),
  deriveEndTimeFromDuration: vi.fn(() => '20:30'),
  fetchBookingsForContact: vi.fn(),
  inferMealTypeFromTime: vi.fn(() => 'dinner'),
  logAuditEvent: logAuditEventMock,
  softCancelBooking: vi.fn(),
  updateBookingRecord: updateBookingRecordMock,
}));

vi.mock('@/server/bookings/duration', () => ({
  resolveBookingDurationMinutes: resolveBookingDurationMinutesMock,
}));

vi.mock('@/server/bookings/modification-flow', () => ({
  beginBookingModificationFlow: beginBookingModificationFlowMock,
}));

vi.mock('@/server/booking', () => ({
  BookingValidationError: class BookingValidationError extends Error {
    response: Record<string, unknown>;

    constructor(response: Record<string, unknown>) {
      super('Booking validation failed');
      this.response = response;
    }
  },
  createBookingValidationService: vi.fn(),
}));

vi.mock('@/server/booking/http', () => ({
  mapValidationFailure: vi.fn(),
  withValidationHeaders: vi.fn((response) => response),
}));

vi.mock('@/server/customers', () => ({
  normalizeEmail: vi.fn((value: string | null | undefined) => (value ?? '').trim().toLowerCase()),
}));

vi.mock('@/server/jobs/booking-side-effects', () => ({
  enqueueBookingCancelledSideEffects: vi.fn(),
  enqueueBookingUpdatedSideEffects: enqueueBookingUpdatedSideEffectsMock,
  safeBookingPayload: vi.fn((booking) => booking),
}));

vi.mock('@/server/observability', () => ({
  recordObservabilityEvent: vi.fn(),
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
  getDefaultRestaurantId: vi.fn(async () => '11111111-1111-4111-8111-111111111111'),
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

import { PUT } from '@/src/app/api/bookings/[id]/route';

const restaurantId = '11111111-1111-4111-8111-111111111111';
const otherRestaurantId = '22222222-2222-4222-8222-222222222222';

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'booking-1',
    restaurant_id: restaurantId,
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
    client_request_id: '11111111-1111-4111-8111-111111111111',
    idempotency_key: 'idem-1',
    pending_ref: null,
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

function makeUpdateRequest(overrides: Record<string, unknown> = {}) {
  return new NextRequest('https://www.nabatable.com/api/bookings/booking-1', {
    method: 'PUT',
    headers: {
      'x-session-recovery-token': 'valid-token',
    },
    body: JSON.stringify({
      restaurantId,
      date: '2026-07-01',
      time: '19:00',
      party: 2,
      bookingType: 'dinner',
      notes: 'Window seat if possible',
      name: 'Alex Guest',
      email: 'alex@example.com',
      phone: '+447700900123',
      marketingOptIn: false,
      ...overrides,
    }),
  });
}

describe('public PUT /api/bookings/[id]', () => {
  beforeEach(() => {
    tenantAuthGetUserMock.mockReset();
    tenantAuthGetUserMock.mockResolvedValue({ data: { user: null }, error: null });
    serviceFromMock.mockReset();
    getRestaurantScheduleMock.mockReset();
    getRestaurantScheduleMock.mockResolvedValue({
      date: '2026-07-01',
      timezone: 'Europe/London',
      isClosed: false,
      window: {
        opensAt: '17:00',
        closesAt: '22:00',
      },
      slots: [
        {
          value: '19:00',
          display: '7:00 PM',
          disabled: false,
        },
      ],
    });
    resolveBookingDurationMinutesMock.mockReset();
    resolveBookingDurationMinutesMock.mockResolvedValue({ durationMinutes: 90 });
    updateBookingRecordMock.mockReset();
    updateBookingRecordMock.mockImplementation(async (_client, _id, payload) =>
      makeBooking({
        booking_date: payload.booking_date,
        start_time: payload.start_time,
        end_time: payload.end_time,
        party_size: payload.party_size,
        booking_type: payload.booking_type,
        customer_name: payload.customer_name,
        customer_email: payload.customer_email,
        customer_phone: payload.customer_phone,
        notes: payload.notes,
        marketing_opt_in: payload.marketing_opt_in,
      }),
    );
    beginBookingModificationFlowMock.mockReset();
    logAuditEventMock.mockReset();
    logAuditEventMock.mockResolvedValue(undefined);
    enqueueBookingUpdatedSideEffectsMock.mockReset();
    enqueueBookingUpdatedSideEffectsMock.mockResolvedValue(undefined);
    validateSessionRecoveryAccessTokenMock.mockReset();
    validateSessionRecoveryAccessTokenMock.mockReturnValue({
      ok: true,
      payload: {
        restaurantId,
        email: 'alex@example.com',
        phone: '+447700900123',
      },
    });
    sessionRecoveryTokenMatchesBookingContactMock.mockReset();
    sessionRecoveryTokenMatchesBookingContactMock.mockReturnValue(true);
  });

  it('allows session-recovery guest updates for the scoped booking contact', async () => {
    const lookup = makeBookingLookup(makeBooking());
    serviceFromMock.mockReturnValueOnce(lookup);

    const response = await PUT(makeUpdateRequest(), {
      params: Promise.resolve({ id: 'booking-1' }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.booking).toMatchObject({
      id: 'booking-1',
      restaurant_id: restaurantId,
      booking_date: '2026-07-01',
      start_time: '19:00',
      end_time: '20:30',
      party_size: 2,
      customer_email: 'alex@example.com',
      notes: 'Window seat if possible',
    });
    expect(lookup.eq).toHaveBeenCalledWith('id', 'booking-1');
    expect(lookup.eq).toHaveBeenCalledWith('restaurant_id', restaurantId);
    expect(updateBookingRecordMock).toHaveBeenCalledWith(
      expect.anything(),
      'booking-1',
      expect.objectContaining({
        restaurant_id: restaurantId,
        booking_date: '2026-07-01',
        start_time: '19:00',
        end_time: '20:30',
        customer_email: 'alex@example.com',
      }),
      { restaurantId },
    );
    expect(beginBookingModificationFlowMock).not.toHaveBeenCalled();
    expect(logAuditEventMock).toHaveBeenCalledOnce();
    expect(enqueueBookingUpdatedSideEffectsMock).toHaveBeenCalledOnce();
  });

  it('blocks session-recovery updates when the payload moves the booking across restaurants', async () => {
    serviceFromMock.mockReturnValueOnce(makeBookingLookup(makeBooking()));

    const response = await PUT(makeUpdateRequest({ restaurantId: otherRestaurantId }), {
      params: Promise.resolve({ id: 'booking-1' }),
    });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe('RESTAURANT_LOCKED');
    expect(updateBookingRecordMock).not.toHaveBeenCalled();
    expect(beginBookingModificationFlowMock).not.toHaveBeenCalled();
  });

  it('rejects session-recovery updates when the token does not match booking contact data', async () => {
    sessionRecoveryTokenMatchesBookingContactMock.mockReturnValue(false);
    serviceFromMock.mockReturnValueOnce(makeBookingLookup(makeBooking()));

    const response = await PUT(makeUpdateRequest(), {
      params: Promise.resolve({ id: 'booking-1' }),
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe('BOOKING_NOT_FOUND');
    expect(updateBookingRecordMock).not.toHaveBeenCalled();
    expect(beginBookingModificationFlowMock).not.toHaveBeenCalled();
  });
});
