import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const tenantAuthGetUserMock = vi.hoisted(() => vi.fn());
const serviceFromMock = vi.hoisted(() => vi.fn());
const requireApiRateLimitMock = vi.hoisted(() => vi.fn());
const sessionRecoveryTokenMatchesBookingContactMock = vi.hoisted(() => vi.fn());
const validateSessionRecoveryAccessTokenMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/env', () => ({
  env: {
    featureFlags: {
      bookingPastTimeGraceMinutes: 5,
      bookingValidationUnified: false,
      pendingSelfServeGraceMinutes: 10,
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

vi.mock('@/server/booking', () => ({
  BookingValidationError: class BookingValidationError extends Error {},
  createBookingValidationService: vi.fn(),
}));

vi.mock('@/server/booking/http', () => ({
  mapValidationFailure: vi.fn(),
  withValidationHeaders: vi.fn((response) => response),
}));

vi.mock('@/server/bookings', () => ({
  BOOKING_TYPES: ['lunch', 'dinner'],
  buildBookingAuditSnapshot: vi.fn(() => ({})),
  clearBookingTableAssignments: vi.fn(),
  deriveEndTimeFromDuration: vi.fn(() => '20:30'),
  fetchBookingsForContact: vi.fn(),
  inferMealTypeFromTime: vi.fn(() => 'dinner'),
  logAuditEvent: vi.fn(),
  softCancelBooking: vi.fn(),
  updateBookingRecord: vi.fn(),
}));

vi.mock('@/server/bookings/duration', () => ({
  resolveBookingDurationMinutes: vi.fn(),
}));

vi.mock('@/server/bookings/modification-flow', () => ({
  beginBookingModificationFlow: vi.fn(),
}));

vi.mock('@/server/customers', () => ({
  normalizeEmail: vi.fn((value: string | null | undefined) => (value ?? '').trim().toLowerCase()),
}));

vi.mock('@/server/jobs/booking-side-effects', () => ({
  enqueueBookingCancelledSideEffects: vi.fn(),
  enqueueBookingUpdatedSideEffects: vi.fn(),
  safeBookingPayload: vi.fn((booking) => booking),
}));

vi.mock('@/server/observability', () => ({
  recordObservabilityEvent: vi.fn(),
}));

vi.mock('@/server/restaurants/schedule', () => ({
  getRestaurantSchedule: vi.fn(),
}));

vi.mock('@/server/security/api-rate-limit', () => ({
  requireApiRateLimit: requireApiRateLimitMock,
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

import { GET } from '@/src/app/api/bookings/[id]/route';

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    auth_user_id: null,
    booking_date: '2026-07-01',
    booking_type: 'dinner',
    client_request_id: 'request-1',
    created_at: '2026-06-01T12:00:00.000Z',
    customer_email: 'alex@example.com',
    customer_name: 'Alex Guest',
    customer_phone: '+447700900123',
    details: null,
    end_at: null,
    end_time: '20:30',
    id: '65c3207e-318a-4e4b-b82d-1249a720d776',
    idempotency_key: 'idem-1',
    marketing_opt_in: false,
    notes: null,
    party_size: 2,
    pending_ref: null,
    reference: 'NB123456',
    restaurant_id: 'rest-1',
    seating_preference: 'any',
    start_at: null,
    start_time: '19:00',
    status: 'confirmed',
    updated_at: '2026-06-01T12:00:00.000Z',
    ...overrides,
  };
}

function makeLookup(data: Record<string, unknown> | null, error: unknown = null) {
  const builder = {
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    select: vi.fn(() => builder),
  };
  return builder;
}

function makeRequest(token = 'valid-token') {
  return new NextRequest('https://www.nabatable.com/api/bookings/65c3207e-318a-4e4b-b82d-1249a720d776', {
    headers: {
      'x-session-recovery-token': token,
    },
  });
}

function routeParams(id = '65c3207e-318a-4e4b-b82d-1249a720d776') {
  return {
    params: Promise.resolve({ id }),
  };
}

describe('public booking manage-token access', () => {
  beforeEach(() => {
    tenantAuthGetUserMock.mockReset();
    serviceFromMock.mockReset();
    requireApiRateLimitMock.mockReset();
    requireApiRateLimitMock.mockResolvedValue(null);
    sessionRecoveryTokenMatchesBookingContactMock.mockReset();
    sessionRecoveryTokenMatchesBookingContactMock.mockReturnValue(true);
    validateSessionRecoveryAccessTokenMock.mockReset();
    validateSessionRecoveryAccessTokenMock.mockReturnValue({
      ok: true,
      payload: {
        email: 'alex@example.com',
        exp: Math.floor(Date.now() / 1000) + 900,
        phone: '+447700900123',
        restaurantId: 'rest-1',
      },
    });
  });

  it('allows a scoped recovery token to read its own booking @p0 @api @security @contract', async () => {
    const bookingLookup = makeLookup(makeBooking());
    const restaurantLookup = makeLookup({
      name: 'The Bell',
      slug: 'the-bell',
      timezone: 'Europe/London',
    });
    serviceFromMock.mockReturnValueOnce(bookingLookup).mockReturnValueOnce(restaurantLookup);

    const response = await GET(makeRequest(), routeParams());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.booking).toMatchObject({
      booking_date: '2026-07-01',
      id: '65c3207e-318a-4e4b-b82d-1249a720d776',
      reference: 'NB123456',
      restaurant_id: 'rest-1',
      restaurants: {
        name: 'The Bell',
        slug: 'the-bell',
        timezone: 'Europe/London',
      },
    });
    expect(bookingLookup.eq).toHaveBeenCalledWith('id', '65c3207e-318a-4e4b-b82d-1249a720d776');
    expect(bookingLookup.eq).toHaveBeenCalledWith('restaurant_id', 'rest-1');
    expect(sessionRecoveryTokenMatchesBookingContactMock).toHaveBeenCalledWith({
      booking: {
        email: 'alex@example.com',
        phone: '+447700900123',
        restaurantId: 'rest-1',
      },
      payload: expect.objectContaining({
        email: 'alex@example.com',
        phone: '+447700900123',
        restaurantId: 'rest-1',
      }),
    });
  });

  it('returns only a guest-safe DTO for recovery-token reads @p0 @api @security @contract', async () => {
    serviceFromMock.mockReturnValueOnce(makeLookup(makeBooking())).mockReturnValueOnce(
      makeLookup({
        name: 'The Bell',
        slug: 'the-bell',
        timezone: 'Europe/London',
      }),
    );

    const response = await GET(makeRequest(), routeParams());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.booking).toEqual(
      expect.objectContaining({
        customer_name: 'Guest',
        customer_email: '',
        customer_phone: '',
        marketing_opt_in: false,
        client_request_id: null,
        idempotency_key: null,
        pending_ref: null,
        details: null,
      }),
    );
    expect(JSON.stringify(body)).not.toContain('alex@example.com');
    expect(JSON.stringify(body)).not.toContain('+447700900123');
    expect(JSON.stringify(body)).not.toContain('request-1');
    expect(JSON.stringify(body)).not.toContain('idem-1');
  });

  it('rejects invalid and expired recovery tokens before lookup @p0 @api @security @contract', async () => {
    validateSessionRecoveryAccessTokenMock.mockReturnValueOnce({
      ok: false,
      reason: 'invalid',
    });

    const invalidResponse = await GET(makeRequest('invalid-token'), routeParams());
    const invalidBody = await invalidResponse.json();

    expect(invalidResponse.status).toBe(401);
    expect(invalidBody.code).toBe('INVALID_ACCESS_TOKEN');

    validateSessionRecoveryAccessTokenMock.mockReturnValueOnce({
      ok: false,
      reason: 'expired',
    });

    const expiredResponse = await GET(makeRequest('expired-token'), routeParams());
    const expiredBody = await expiredResponse.json();

    expect(expiredResponse.status).toBe(410);
    expect(expiredBody.code).toBe('ACCESS_TOKEN_EXPIRED');
    expect(serviceFromMock).not.toHaveBeenCalled();
    expect(sessionRecoveryTokenMatchesBookingContactMock).not.toHaveBeenCalled();
  });

  it('rejects malformed booking ids before service-role lookup @p0 @api @security @contract', async () => {
    const response = await GET(makeRequest(), routeParams('not-a-uuid'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('MISSING_BOOKING_ID');
    expect(serviceFromMock).not.toHaveBeenCalled();
  });

  it('does not reveal bookings outside the token restaurant scope @p0 @api @security @contract', async () => {
    const bookingLookup = makeLookup(null);
    serviceFromMock.mockReturnValueOnce(bookingLookup);

    const response = await GET(makeRequest(), routeParams('9876c5cb-9ad9-4af3-a448-b6a5b6dfba42'));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe('BOOKING_NOT_FOUND');
    expect(bookingLookup.eq).toHaveBeenCalledWith('id', '9876c5cb-9ad9-4af3-a448-b6a5b6dfba42');
    expect(bookingLookup.eq).toHaveBeenCalledWith('restaurant_id', 'rest-1');
    expect(sessionRecoveryTokenMatchesBookingContactMock).not.toHaveBeenCalled();
  });

  it('does not reveal bookings when token contact does not match @p0 @api @security @contract', async () => {
    sessionRecoveryTokenMatchesBookingContactMock.mockReturnValue(false);
    serviceFromMock.mockReturnValueOnce(makeLookup(makeBooking()));

    const response = await GET(makeRequest(), routeParams());
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe('BOOKING_NOT_FOUND');
    expect(serviceFromMock).toHaveBeenCalledOnce();
  });
});
