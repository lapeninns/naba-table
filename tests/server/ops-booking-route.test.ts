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
  createBookingValidationService: vi.fn(),
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
    softCancelBooking: vi.fn(),
    updateBookingRecord: updateBookingRecordMock,
  };
});

vi.mock('@/server/jobs/booking-side-effects', () => ({
  enqueueBookingCancelledSideEffects: vi.fn(),
  enqueueBookingUpdatedSideEffects: enqueueBookingUpdatedSideEffectsMock,
  safeBookingPayload: vi.fn((booking) => booking),
}));

vi.mock('@/server/runtime-policy', () => ({
  getBookingPastTimeGraceMinutes: vi.fn(() => 5),
  isBookingPastTimeBlockingEnabled: vi.fn(() => false),
  isDbStrictConstraintMappingEnabled: vi.fn(() => false),
  isUnifiedBookingValidationEnabled: vi.fn(() => false),
}));

vi.mock('@/server/ops/bookings', () => ({
  invalidateOpsDashboardCaches: invalidateOpsDashboardCachesMock,
}));

import { PATCH } from '@/src/app/api/ops/bookings/[id]/route';

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
    expect(body).toEqual({ error: 'Booking not found' });
    expect(fromMock).not.toHaveBeenCalled();
    expect(beginBookingModificationFlowMock).not.toHaveBeenCalled();
    expect(updateBookingRecordMock).not.toHaveBeenCalled();
  });
});
