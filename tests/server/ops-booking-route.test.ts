import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const tenantAuthGetUserMock = vi.hoisted(() => vi.fn());
const maybeSingleMock = vi.hoisted(() => vi.fn());
const queryMock = vi.hoisted(() => {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    maybeSingle: maybeSingleMock,
  };
  return query;
});
const selectMock = vi.hoisted(() => queryMock.select);
const eqMock = vi.hoisted(() => queryMock.eq);
const inMock = vi.hoisted(() => queryMock.in);
const fromMock = vi.hoisted(() => vi.fn(() => queryMock));
const requireMembershipForRestaurantMock = vi.hoisted(() => vi.fn());
const fetchUserMembershipsMock = vi.hoisted(() => vi.fn());
const getRestaurantScheduleMock = vi.hoisted(() => vi.fn());
const getRestaurantTurnBandsMock = vi.hoisted(() => vi.fn());
const resolveBookingDurationMinutesMock = vi.hoisted(() => vi.fn());
const beginBookingModificationFlowMock = vi.hoisted(() => vi.fn());
const updateBookingRecordMock = vi.hoisted(() => vi.fn());
const logAuditEventMock = vi.hoisted(() => vi.fn());
const enqueueBookingUpdatedSideEffectsMock = vi.hoisted(() => vi.fn());
const invalidateOpsDashboardCachesMock = vi.hoisted(() => vi.fn());
const createBookingValidationServiceMock = vi.hoisted(() => vi.fn());
const isUnifiedBookingValidationEnabledMock = vi.hoisted(() => vi.fn());
const softCancelBookingMock = vi.hoisted(() => vi.fn());
const enqueueBookingCancelledSideEffectsMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/env', () => ({
  env: {
    reserve: {
      defaultDurationMinutes: 90,
    },
  },
}));

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: vi.fn(async () => ({
    auth: {
      getUser: tenantAuthGetUserMock,
    },
  })),
  getServiceSupabaseClient: vi.fn(() => ({
    from: fromMock,
  })),
  getTenantServiceSupabaseClient: vi.fn(() => ({ kind: 'tenant-client' })),
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

vi.mock('@/server/booking', () => ({
  createBookingValidationService: createBookingValidationServiceMock,
  BookingValidationError: class BookingValidationError extends Error {},
}));

vi.mock('@/server/booking/http', () => ({
  mapValidationFailure: vi.fn(),
  withValidationHeaders: vi.fn((response) => response),
}));

vi.mock('@/server/bookings/duration', () => ({
  resolveBookingDurationMinutes: resolveBookingDurationMinutesMock,
}));

vi.mock('@/server/bookings/modification-flow', () => ({
  beginBookingModificationFlow: beginBookingModificationFlowMock,
}));

vi.mock('@/server/bookings', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    buildBookingAuditSnapshot: vi.fn(() => ({})),
    inferMealTypeFromTime: vi.fn(() => 'dinner'),
    logAuditEvent: logAuditEventMock,
    softCancelBooking: softCancelBookingMock,
    updateBookingRecord: updateBookingRecordMock,
  };
});

vi.mock('@/server/jobs/booking-side-effects', () => ({
  enqueueBookingCancelledSideEffects: enqueueBookingCancelledSideEffectsMock,
  enqueueBookingUpdatedSideEffects: enqueueBookingUpdatedSideEffectsMock,
  safeBookingPayload: vi.fn((booking) => booking),
}));

vi.mock('@/server/runtime-policy', () => ({
  getBookingPastTimeGraceMinutes: vi.fn(() => 5),
  isBookingPastTimeBlockingEnabled: vi.fn(() => false),
  isDbStrictConstraintMappingEnabled: vi.fn(() => false),
  isUnifiedBookingValidationEnabled: isUnifiedBookingValidationEnabledMock,
}));

vi.mock('@/server/ops/bookings', () => ({
  invalidateOpsDashboardCaches: invalidateOpsDashboardCachesMock,
}));

import { BookingNotCancellableError } from '@/server/bookings';
import { DELETE, PATCH } from '@/src/app/api/ops/bookings/[id]/route';

function buildRouteParams() {
  return {
    params: Promise.resolve({
      id: 'booking-1',
    }),
  };
}

function buildBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'booking-1',
    restaurant_id: 'rest-1',
    booking_date: '2026-07-01',
    start_time: '19:30',
    end_time: '21:00',
    start_at: '2026-07-01T18:30:00.000Z',
    end_at: '2026-07-01T20:00:00.000Z',
    party_size: 4,
    status: 'confirmed',
    notes: 'Window seat',
    booking_type: 'dinner',
    customer_name: 'Alex',
    customer_email: 'alex@example.com',
    customer_phone: '+447000000000',
    client_request_id: 'req-1',
    source: 'ops',
    seating_preference: null,
    marketing_opt_in: false,
    customer_id: 'cust-1',
    idempotency_key: 'idem-1',
    restaurants: {
      name: 'The Demo',
      slug: 'the-demo',
      timezone: 'Europe/London',
      reservation_interval_minutes: 15,
    },
    ...overrides,
  };
}

describe('ops booking PATCH route timezone handling', () => {
  beforeEach(() => {
    tenantAuthGetUserMock.mockReset();
    maybeSingleMock.mockReset();
    eqMock.mockClear();
    inMock.mockClear();
    selectMock.mockClear();
    fromMock.mockClear();
    requireMembershipForRestaurantMock.mockReset();
    fetchUserMembershipsMock.mockReset();
    getRestaurantScheduleMock.mockReset();
    getRestaurantTurnBandsMock.mockReset();
    resolveBookingDurationMinutesMock.mockReset();
    beginBookingModificationFlowMock.mockReset();
    updateBookingRecordMock.mockReset();
    logAuditEventMock.mockReset();
    enqueueBookingUpdatedSideEffectsMock.mockReset();
    invalidateOpsDashboardCachesMock.mockReset();
    createBookingValidationServiceMock.mockReset();
    isUnifiedBookingValidationEnabledMock.mockReset();
    isUnifiedBookingValidationEnabledMock.mockReturnValue(false);

    tenantAuthGetUserMock.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: 'ops@example.com',
        },
      },
      error: null,
    });
    requireMembershipForRestaurantMock.mockResolvedValue(undefined);
    fetchUserMembershipsMock.mockResolvedValue([{ restaurant_id: 'rest-1', role: 'owner' }]);
    getRestaurantScheduleMock.mockResolvedValue({
      date: '2026-07-01',
      timezone: 'Europe/London',
      operatingHours: { openTime: '12:00', closeTime: '23:00' },
      shifts: [],
      servicePeriods: [],
      closure: null,
      source: 'fallback',
    });
    getRestaurantTurnBandsMock.mockResolvedValue(null);
    resolveBookingDurationMinutesMock.mockResolvedValue({
      durationMinutes: 90,
    });
    enqueueBookingUpdatedSideEffectsMock.mockResolvedValue(undefined);
    logAuditEventMock.mockResolvedValue(undefined);
    invalidateOpsDashboardCachesMock.mockReturnValue(undefined);
  });

  it('persists venue-local clock times when ops edits a booking during DST', async () => {
    maybeSingleMock.mockResolvedValue({
      data: buildBooking({
        start_time: '18:00',
        end_time: '19:30',
        start_at: '2026-07-01T17:00:00.000Z',
        end_at: '2026-07-01T18:30:00.000Z',
      }),
      error: null,
    });
    resolveBookingDurationMinutesMock.mockResolvedValue({
      durationMinutes: 120,
    });
    beginBookingModificationFlowMock.mockImplementation(async ({ payload }) =>
      buildBooking({
        booking_date: payload.booking_date,
        start_time: payload.start_time,
        end_time: payload.end_time,
        party_size: payload.party_size,
        notes: payload.notes,
        start_at: payload.start_at,
        end_at: payload.end_at,
      }),
    );

    const response = await PATCH(
      new NextRequest('https://www.nabatable.com/api/ops/bookings/booking-1', {
        method: 'PATCH',
        body: JSON.stringify({
          startIso: '2026-07-01T18:30:00.000Z',
          endIso: '2026-07-01T20:30:00.000Z',
          partySize: 4,
          notes: 'Updated by ops',
        }),
      }),
      buildRouteParams(),
    );

    expect(response.status).toBe(200);
    expect(fetchUserMembershipsMock).toHaveBeenCalledWith('user-1', expect.anything());
    expect(eqMock).toHaveBeenCalledWith('id', 'booking-1');
    expect(inMock).toHaveBeenCalledWith('restaurant_id', ['rest-1']);
    expect(beginBookingModificationFlowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          booking_date: '2026-07-01',
          start_time: '19:30',
          end_time: '21:30',
          start_at: '2026-07-01T18:30:00.000Z',
          end_at: '2026-07-01T20:30:00.000Z',
          party_size: 4,
        }),
      }),
    );
    expect(updateBookingRecordMock).not.toHaveBeenCalled();
  });

  it('preserves the existing venue-local end time on note-only edits', async () => {
    maybeSingleMock.mockResolvedValue({
      data: buildBooking(),
      error: null,
    });
    updateBookingRecordMock.mockImplementation(async (_client, _bookingId, payload) =>
      buildBooking({
        booking_date: payload.booking_date,
        start_time: payload.start_time,
        end_time: payload.end_time,
        start_at: payload.start_at,
        end_at: payload.end_at,
        notes: payload.notes,
      }),
    );

    const response = await PATCH(
      new NextRequest('https://www.nabatable.com/api/ops/bookings/booking-1', {
        method: 'PATCH',
        body: JSON.stringify({
          startIso: '2026-07-01T18:30:00.000Z',
          partySize: 4,
          notes: 'Guest asked for anniversary candle',
        }),
      }),
      buildRouteParams(),
    );

    expect(response.status).toBe(200);
    expect(fetchUserMembershipsMock).toHaveBeenCalledWith('user-1', expect.anything());
    expect(eqMock).toHaveBeenCalledWith('id', 'booking-1');
    expect(inMock).toHaveBeenCalledWith('restaurant_id', ['rest-1']);
    expect(updateBookingRecordMock).toHaveBeenCalledWith(
      expect.anything(),
      'booking-1',
      expect.objectContaining({
        booking_date: '2026-07-01',
        start_time: '19:30',
        end_time: '21:00',
        start_at: '2026-07-01T18:30:00.000Z',
        end_at: '2026-07-01T20:00:00.000Z',
        notes: 'Guest asked for anniversary candle',
      }),
      { restaurantId: 'rest-1' },
    );
    expect(beginBookingModificationFlowMock).not.toHaveBeenCalled();
  });

  it('clears and recalculates assignments when unified updates change party size', async () => {
    isUnifiedBookingValidationEnabledMock.mockReturnValue(true);
    maybeSingleMock.mockResolvedValue({
      data: buildBooking({ party_size: 2 }),
      error: null,
    });

    const validateUpdate = vi.fn(async () => ({
      response: {
        ok: true,
        issues: [],
        warnings: [],
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
      buildBooking({
        party_size: payload.party_size,
        start_at: payload.start_at,
        end_at: payload.end_at,
      }),
    );

    const response = await PATCH(
      new NextRequest('https://www.nabatable.com/api/ops/bookings/booking-1', {
        method: 'PATCH',
        body: JSON.stringify({
          startIso: '2026-07-01T18:30:00.000Z',
          partySize: 5,
        }),
      }),
      buildRouteParams(),
    );

    expect(response.status).toBe(200);
    expect(validateUpdate).toHaveBeenCalledOnce();
    expect(beginBookingModificationFlowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'ops',
        payload: expect.objectContaining({
          party_size: 5,
          booking_date: '2026-07-01',
          start_time: '19:30',
          end_time: '21:00',
        }),
      }),
    );
    expect(updateWithEnforcement).not.toHaveBeenCalled();
  });

  it('does not look up bookings when the operator has no restaurant memberships', async () => {
    fetchUserMembershipsMock.mockResolvedValue([]);

    const response = await PATCH(
      new NextRequest('https://www.nabatable.com/api/ops/bookings/booking-1', {
        method: 'PATCH',
        body: JSON.stringify({
          startIso: '2026-07-01T18:30:00.000Z',
          partySize: 4,
        }),
      }),
      buildRouteParams(),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({
      error: 'Booking not found',
      code: 'BOOKING_NOT_FOUND',
      message: 'Booking not found',
    });
    expect(fromMock).not.toHaveBeenCalled();
    expect(beginBookingModificationFlowMock).not.toHaveBeenCalled();
    expect(updateBookingRecordMock).not.toHaveBeenCalled();
  });
});

describe('ops booking DELETE (cancel) route status guard', () => {
  function deleteRequest() {
    return new NextRequest('https://www.nabatable.com/api/ops/bookings/booking-1', {
      method: 'DELETE',
    });
  }

  beforeEach(() => {
    tenantAuthGetUserMock.mockReset();
    tenantAuthGetUserMock.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'ops@example.com' } },
      error: null,
    });
    fetchUserMembershipsMock.mockReset();
    fetchUserMembershipsMock.mockResolvedValue([{ restaurant_id: 'rest-1', role: 'owner' }]);
    maybeSingleMock.mockReset();
    softCancelBookingMock.mockReset();
    logAuditEventMock.mockReset();
    enqueueBookingCancelledSideEffectsMock.mockReset();
    invalidateOpsDashboardCachesMock.mockReset();
  });

  it.each(['checked_in', 'completed', 'no_show'])(
    'rejects cancelling a %s booking with 409 BOOKING_NOT_CANCELLABLE before any write',
    async (status) => {
      maybeSingleMock.mockResolvedValue({ data: buildBooking({ status }), error: null });

      const response = await DELETE(deleteRequest(), buildRouteParams());
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body).toMatchObject({
        code: 'BOOKING_NOT_CANCELLABLE',
        retryable: false,
        details: { currentStatus: status },
      });
      expect(softCancelBookingMock).not.toHaveBeenCalled();
      expect(enqueueBookingCancelledSideEffectsMock).not.toHaveBeenCalled();
    },
  );

  it('maps the DB guard (status changed after the read) to 409 BOOKING_NOT_CANCELLABLE', async () => {
    maybeSingleMock.mockResolvedValue({ data: buildBooking({ status: 'confirmed' }), error: null });
    softCancelBookingMock.mockRejectedValue(new BookingNotCancellableError('checked_in'));

    const response = await DELETE(deleteRequest(), buildRouteParams());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'BOOKING_NOT_CANCELLABLE',
      details: { currentStatus: 'checked_in' },
    });
    expect(logAuditEventMock).not.toHaveBeenCalled();
    expect(enqueueBookingCancelledSideEffectsMock).not.toHaveBeenCalled();
  });

  it('treats an already-cancelled booking as an idempotent 200 without side effects', async () => {
    maybeSingleMock.mockResolvedValue({ data: buildBooking({ status: 'cancelled' }), error: null });

    const response = await DELETE(deleteRequest(), buildRouteParams());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ id: 'booking-1', status: 'cancelled' });
    expect(softCancelBookingMock).not.toHaveBeenCalled();
  });

  it('cancels a confirmed booking and queues side effects', async () => {
    const booking = buildBooking({ status: 'confirmed' });
    maybeSingleMock.mockResolvedValue({ data: booking, error: null });
    softCancelBookingMock.mockResolvedValue({
      cancelled: true,
      booking: { ...booking, status: 'cancelled' },
    });

    const response = await DELETE(deleteRequest(), buildRouteParams());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ id: 'booking-1', status: 'cancelled' });
    expect(softCancelBookingMock).toHaveBeenCalledWith(expect.anything(), 'booking-1', {
      restaurantId: 'rest-1',
    });
    expect(enqueueBookingCancelledSideEffectsMock).toHaveBeenCalledTimes(1);
  });

  it('reports unexpected cancellation failures without database text', async () => {
    maybeSingleMock.mockResolvedValue({ data: buildBooking({ status: 'confirmed' }), error: null });
    softCancelBookingMock.mockRejectedValue(
      Object.assign(new Error('deadlock detected on relation bookings'), { code: '40P01' }),
    );

    const response = await DELETE(deleteRequest(), buildRouteParams());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(body)).not.toContain('deadlock');
  });
});
