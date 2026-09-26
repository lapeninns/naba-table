import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const tenantAuthGetUserMock = vi.hoisted(() => vi.fn());
const serviceFromMock = vi.hoisted(() => vi.fn());
const getRestaurantScheduleMock = vi.hoisted(() => vi.fn());
const resolveBookingDurationMinutesMock = vi.hoisted(() => vi.fn());
const updateBookingRecordMock = vi.hoisted(() => vi.fn());
const beginBookingModificationFlowMock = vi.hoisted(() => vi.fn());
const logAuditEventMock = vi.hoisted(() => vi.fn());
const enqueueBookingUpdatedSideEffectsMock = vi.hoisted(() => vi.fn());
const consumeRateLimitMock = vi.hoisted(() => vi.fn());
const createBookingValidationServiceMock = vi.hoisted(() => vi.fn());
const isUnifiedBookingValidationEnabledMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/env', () => ({
  env: {
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

vi.mock('@/server/bookings/modification-flow', async () => {
  // The real module pulls in the email stack. This stand-in keeps the contract the route
  // relies on (S2-modification-flow.md §1): a 409 error class with a code and retryable
  // flag, a type guard, and a C1 response helper with safe copy.
  const { conflict } = await import('@/lib/api/errors');
  class BookingModificationConflictError extends Error {
    readonly status = 409 as const;
    readonly retryable: boolean;
    constructor(
      readonly code: string,
      options: { reason?: string | null } = {},
    ) {
      super('Booking validation failed');
      this.name = 'BookingModificationConflictError';
      this.retryable = !['MODIFICATION_NO_TABLES', 'MODIFICATION_UNAVAILABLE'].includes(code);
      void options;
    }
  }
  return {
    beginBookingModificationFlow: beginBookingModificationFlowMock,
    BookingModificationConflictError,
    isBookingModificationConflictError: (error: unknown) =>
      error instanceof BookingModificationConflictError,
    bookingModificationConflictResponse: (error: BookingModificationConflictError) =>
      conflict(error.code, `Refused (${error.code}). The booking has not been changed.`, {
        retryable: error.retryable,
      }),
  };
});

vi.mock('@/server/booking', () => ({
  BookingValidationError: class BookingValidationError extends Error {
    response: Record<string, unknown>;

    constructor(response: Record<string, unknown>) {
      super('Booking validation failed');
      this.response = response;
    }
  },
  createBookingValidationService: createBookingValidationServiceMock,
}));

vi.mock('@/server/booking/http', () => ({
  mapValidationFailure: vi.fn(),
  withValidationHeaders: vi.fn((response) => response),
}));

vi.mock('@/server/customers', () => ({
  normalizeEmail: vi.fn((value: string | null | undefined) => (value ?? '').trim().toLowerCase()),
  // Mirrors normalizeComparablePhone's digits-only comparable output
  // (e.g. '+447700900123' -> '447700900123') for the WhatsApp-consent patch path.
  normalizePhone: vi.fn((value: string | null | undefined) =>
    (value ?? '').trim().replace(/[^0-9]/g, ''),
  ),
}));

vi.mock('@/server/jobs/booking-side-effects', () => ({
  enqueueBookingCancelledSideEffects: vi.fn(),
  enqueueBookingUpdatedSideEffects: enqueueBookingUpdatedSideEffectsMock,
  safeBookingPayload: vi.fn((booking) => booking),
}));

vi.mock('@/server/runtime-policy', () => ({
  getBookingPastTimeGraceMinutes: vi.fn(() => 5),
  getPendingSelfServeGraceMinutes: vi.fn(() => 10),
  isUnifiedBookingValidationEnabled: isUnifiedBookingValidationEnabledMock,
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

vi.mock('@/server/security/rate-limit', () => ({
  consumeRateLimit: consumeRateLimitMock,
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

import * as modificationFlow from '@/server/bookings/modification-flow';
import { PUT } from '@/src/app/api/bookings/[id]/route';

import { guestTokenHeaders } from './helpers/guestBookingAccess';

const restaurantId = '11111111-1111-4111-8111-111111111111';
const otherRestaurantId = '22222222-2222-4222-8222-222222222222';

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: '65c3207e-318a-4e4b-b82d-1249a720d776',
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
  return new NextRequest(
    'https://www.nabatable.com/api/bookings/65c3207e-318a-4e4b-b82d-1249a720d776',
    {
      method: 'PUT',
      headers: guestTokenHeaders(makeBooking()),
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
    },
  );
}

function makeDashboardUpdateRequest(overrides: Record<string, unknown> = {}) {
  return new NextRequest(
    'https://www.nabatable.com/api/bookings/65c3207e-318a-4e4b-b82d-1249a720d776',
    {
      method: 'PUT',
      headers: guestTokenHeaders(makeBooking()),
      body: JSON.stringify({
        startIso: '2026-07-02T18:30:00.000Z',
        partySize: 4,
        notes: 'Updated window seat',
        ...overrides,
      }),
    },
  );
}

describe('public PUT /api/bookings/[id]', () => {
  beforeEach(() => {
    // Pin the wall clock so the 2026-07-01 19:00 Europe/London fixtures stay in the
    // future for the real-clock guards (evaluateGuestModificationLock,
    // assertBookingNotInPast). Instant matches the suite family's injected
    // time providers (now = 2026-05-16).
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-16T12:00:00.000Z'));
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
        start_at: payload.start_at,
        end_at: payload.end_at,
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
    consumeRateLimitMock.mockReset();
    consumeRateLimitMock.mockResolvedValue({
      ok: true,
      limit: 10,
      remaining: 9,
      resetAt: Date.now() + 60_000,
      source: 'memory',
    });
    createBookingValidationServiceMock.mockReset();
    isUnifiedBookingValidationEnabledMock.mockReset();
    isUnifiedBookingValidationEnabledMock.mockReturnValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows booking-cookie guest updates for the scoped booking', async () => {
    const lookup = makeBookingLookup(makeBooking());
    serviceFromMock.mockReturnValueOnce(lookup);

    const response = await PUT(makeUpdateRequest(), {
      params: Promise.resolve({ id: '65c3207e-318a-4e4b-b82d-1249a720d776' }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.booking).toMatchObject({
      id: '65c3207e-318a-4e4b-b82d-1249a720d776',
      restaurant_id: restaurantId,
      booking_date: '2026-07-01',
      start_time: '19:00',
      end_time: '20:30',
      party_size: 2,
      // Token access gets masked contact details.
      customer_email: '',
      customer_phone: '***0123',
      notes: 'Window seat if possible',
    });
    expect(body.booking).not.toHaveProperty('idempotency_key');
    expect(body.booking).not.toHaveProperty('client_request_id');
    expect(lookup.eq).toHaveBeenCalledWith('id', '65c3207e-318a-4e4b-b82d-1249a720d776');
    expect(lookup.eq).toHaveBeenCalledWith('restaurant_id', restaurantId);
    expect(updateBookingRecordMock).toHaveBeenCalledWith(
      expect.anything(),
      '65c3207e-318a-4e4b-b82d-1249a720d776',
      expect.objectContaining({
        restaurant_id: restaurantId,
        booking_date: '2026-07-01',
        start_time: '19:00',
        end_time: '20:30',
        start_at: '2026-07-01T18:00:00.000Z',
        end_at: '2026-07-01T19:30:00.000Z',
        customer_email: 'alex@example.com',
      }),
      { restaurantId },
    );
    expect(beginBookingModificationFlowMock).not.toHaveBeenCalled();
    expect(logAuditEventMock).toHaveBeenCalledOnce();
    expect(enqueueBookingUpdatedSideEffectsMock).toHaveBeenCalledOnce();
  });

  it('passes canonical instants through booking-cookie dashboard realignment updates', async () => {
    getRestaurantScheduleMock.mockResolvedValue({
      date: '2026-07-02',
      timezone: 'Europe/London',
      isClosed: false,
      window: {
        opensAt: '17:00',
        closesAt: '22:00',
      },
      slots: [
        {
          value: '19:30',
          display: '7:30 PM',
          disabled: false,
        },
      ],
    });
    const lookup = makeBookingLookup(
      makeBooking({
        booking_date: '2026-07-01',
        start_time: '19:00',
        end_time: '20:30',
        start_at: '2026-07-01T18:00:00.000Z',
        end_at: '2026-07-01T19:30:00.000Z',
      }),
    );
    serviceFromMock.mockReturnValueOnce(lookup);
    beginBookingModificationFlowMock.mockImplementation(async ({ payload }) =>
      makeBooking({
        ...payload,
        start_at: '2026-07-01T18:00:00.000Z',
        end_at: '2026-07-01T19:30:00.000Z',
      }),
    );

    const response = await PUT(makeDashboardUpdateRequest(), {
      params: Promise.resolve({ id: '65c3207e-318a-4e4b-b82d-1249a720d776' }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(beginBookingModificationFlowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          booking_date: '2026-07-02',
          start_time: '19:30',
          end_time: '21:00',
          start_at: '2026-07-02T18:30:00.000Z',
          end_at: '2026-07-02T20:00:00.000Z',
          party_size: 4,
        }),
      }),
    );
    expect(body).toMatchObject({
      id: '65c3207e-318a-4e4b-b82d-1249a720d776',
      startIso: '2026-07-02T18:30:00.000Z',
      endIso: '2026-07-02T20:00:00.000Z',
      booking: {
        start_at: '2026-07-02T18:30:00.000Z',
        end_at: '2026-07-02T20:00:00.000Z',
      },
    });
  });

  it('realigns tables when a unified dashboard update changes party size', async () => {
    isUnifiedBookingValidationEnabledMock.mockReturnValue(true);
    const lookup = makeBookingLookup(makeBooking({ party_size: 2 }));
    serviceFromMock.mockReturnValueOnce(lookup);

    const validateUpdate = vi.fn(async () => ({
      response: {
        ok: true,
        issues: [],
        overridden: false,
        overrideCodes: [],
      },
      metadata: {},
    }));
    const updateWithEnforcement = vi.fn();
    createBookingValidationServiceMock.mockReturnValue({
      validateUpdate,
      updateWithEnforcement,
    });
    beginBookingModificationFlowMock.mockImplementation(async ({ payload }) =>
      makeBooking({
        ...payload,
      }),
    );

    const response = await PUT(
      makeDashboardUpdateRequest({
        startIso: '2026-07-01T18:00:00.000Z',
        partySize: 5,
      }),
      {
        params: Promise.resolve({ id: '65c3207e-318a-4e4b-b82d-1249a720d776' }),
      },
    );

    expect(response.status).toBe(200);
    expect(validateUpdate).toHaveBeenCalledOnce();
    expect(beginBookingModificationFlowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'guest',
        payload: expect.objectContaining({
          party_size: 5,
          booking_date: '2026-07-01',
          start_time: '19:00',
          end_time: '20:30',
        }),
      }),
    );
    expect(updateWithEnforcement).not.toHaveBeenCalled();
  });

  it('blocks booking-cookie updates when the payload moves the booking across restaurants', async () => {
    serviceFromMock.mockReturnValueOnce(makeBookingLookup(makeBooking()));

    const response = await PUT(makeUpdateRequest({ restaurantId: otherRestaurantId }), {
      params: Promise.resolve({ id: '65c3207e-318a-4e4b-b82d-1249a720d776' }),
    });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe('RESTAURANT_LOCKED');
    expect(updateBookingRecordMock).not.toHaveBeenCalled();
    expect(beginBookingModificationFlowMock).not.toHaveBeenCalled();
  });

  it('rejects booking-cookie updates once the booking contact changed (revoked)', async () => {
    serviceFromMock.mockReturnValueOnce(
      makeBookingLookup(makeBooking({ customer_email: 'changed@example.com' })),
    );

    const response = await PUT(makeUpdateRequest(), {
      params: Promise.resolve({ id: '65c3207e-318a-4e4b-b82d-1249a720d776' }),
    });
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body.code).toBe('ACCESS_TOKEN_REVOKED');
    expect(response.headers.getSetCookie().join('\n')).toContain(
      '__Host-nt_bk.65c3207e-318a-4e4b-b82d-1249a720d776=;',
    );
    expect(updateBookingRecordMock).not.toHaveBeenCalled();
    expect(beginBookingModificationFlowMock).not.toHaveBeenCalled();
  });

  describe('refused modifications (S2b BookingModificationConflictError) answer a C1 409', () => {
    const { BookingModificationConflictError } = modificationFlow as unknown as {
      BookingModificationConflictError: new (
        code: string,
        options?: { reason?: string | null },
      ) => Error;
    };
    const params = { params: Promise.resolve({ id: '65c3207e-318a-4e4b-b82d-1249a720d776' }) };

    async function expectConflict(response: Response, code: string, retryable: boolean) {
      const body = await response.json();
      expect(response.status).toBe(409);
      expect(body).toEqual({
        error: body.message,
        code,
        message: expect.stringContaining('The booking has not been changed.'),
        retryable,
      });
      expect(logAuditEventMock).not.toHaveBeenCalled();
      expect(enqueueBookingUpdatedSideEffectsMock).not.toHaveBeenCalled();
      expect(updateBookingRecordMock).not.toHaveBeenCalled();
    }

    it('maps the full-schema (wizard edit) PUT', async () => {
      serviceFromMock.mockReturnValueOnce(makeBookingLookup(makeBooking()));
      beginBookingModificationFlowMock.mockRejectedValue(
        new BookingModificationConflictError('MODIFICATION_NO_TABLES', {
          reason: 'planner detail',
        }),
      );

      const response = await PUT(makeUpdateRequest({ party: 4 }), params);

      await expectConflict(response, 'MODIFICATION_NO_TABLES', false);
      expect(beginBookingModificationFlowMock).toHaveBeenCalledOnce();
    });

    it('maps the dashboard schema, non-unified branch', async () => {
      serviceFromMock.mockReturnValueOnce(makeBookingLookup(makeBooking()));
      beginBookingModificationFlowMock.mockRejectedValue(
        new BookingModificationConflictError('MODIFICATION_UNAVAILABLE'),
      );

      const response = await PUT(
        makeDashboardUpdateRequest({ startIso: '2026-07-01T18:00:00.000Z', partySize: 4 }),
        params,
      );

      await expectConflict(response, 'MODIFICATION_UNAVAILABLE', false);
      expect(beginBookingModificationFlowMock).toHaveBeenCalledOnce();
    });

    it('maps the dashboard schema, unified branch, to the C1 body (not the issues body)', async () => {
      isUnifiedBookingValidationEnabledMock.mockReturnValue(true);
      serviceFromMock.mockReturnValueOnce(makeBookingLookup(makeBooking({ party_size: 2 })));
      createBookingValidationServiceMock.mockReturnValue({
        validateUpdate: vi.fn(async () => ({
          response: { ok: true, issues: [], overridden: false, overrideCodes: [] },
          metadata: {},
        })),
        updateWithEnforcement: vi.fn(),
      });
      beginBookingModificationFlowMock.mockRejectedValue(
        new BookingModificationConflictError('MODIFICATION_TABLES_UNCONFIRMED'),
      );

      const response = await PUT(
        makeDashboardUpdateRequest({ startIso: '2026-07-01T18:00:00.000Z', partySize: 5 }),
        params,
      );

      await expectConflict(response, 'MODIFICATION_TABLES_UNCONFIRMED', true);
    });

    it('maps BOOKING_STATE_CONFLICT (booking changed meanwhile) as retryable', async () => {
      serviceFromMock.mockReturnValueOnce(makeBookingLookup(makeBooking()));
      beginBookingModificationFlowMock.mockRejectedValue(
        new BookingModificationConflictError('BOOKING_STATE_CONFLICT'),
      );

      const response = await PUT(makeUpdateRequest({ party: 4 }), params);

      await expectConflict(response, 'BOOKING_STATE_CONFLICT', true);
    });
  });
});
