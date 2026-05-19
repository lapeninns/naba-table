import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '@/lib/security/csrf';

const clearBookingTableAssignmentsMock = vi.hoisted(() => vi.fn());
const enqueueCheckOutSideEffectsMock = vi.hoisted(() => vi.fn());
const invalidateOpsDashboardCachesMock = vi.hoisted(() => vi.fn());
const prepareCheckOutTransitionMock = vi.hoisted(() => vi.fn());
const loadLifecycleRouteContextMock = vi.hoisted(() => vi.fn());
const parseOptionalRouteBodyMock = vi.hoisted(() => vi.fn());
const persistLifecycleTransitionMock = vi.hoisted(() => vi.fn());
const resolveBookingIdMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/bookings', () => ({
  clearBookingTableAssignments: clearBookingTableAssignmentsMock,
}));

vi.mock('@/server/jobs/booking-side-effects', () => ({
  enqueueCheckOutSideEffects: enqueueCheckOutSideEffectsMock,
}));

vi.mock('@/server/ops/bookings', () => ({
  invalidateOpsDashboardCaches: invalidateOpsDashboardCachesMock,
}));

vi.mock('@/server/ops/booking-lifecycle/actions', () => ({
  prepareCheckOutTransition: prepareCheckOutTransitionMock,
}));

vi.mock('@/src/app/api/ops/bookings/[id]/_shared/lifecycleRoute', () => ({
  loadLifecycleRouteContext: loadLifecycleRouteContextMock,
  parseOptionalRouteBody: parseOptionalRouteBodyMock,
  persistLifecycleTransition: persistLifecycleTransitionMock,
  resolveBookingId: resolveBookingIdMock,
}));

import { POST } from '@/src/app/api/ops/bookings/[id]/check-out/route';

const BOOKING = {
  id: 'booking-1',
  restaurant_id: 'restaurant-1',
  status: 'completed',
  checked_in_at: '2026-05-16T10:00:00.000Z',
  checked_out_at: '2026-05-16T11:00:00.000Z',
  booking_date: '2026-05-16',
  start_time: '10:00',
};
const CSRF_TOKEN = 'checkout-csrf-token';

describe('POST /api/ops/bookings/[id]/check-out', () => {
  beforeEach(() => {
    clearBookingTableAssignmentsMock.mockReset();
    clearBookingTableAssignmentsMock.mockResolvedValue(undefined);
    enqueueCheckOutSideEffectsMock.mockReset();
    enqueueCheckOutSideEffectsMock.mockResolvedValue(undefined);
    invalidateOpsDashboardCachesMock.mockReset();
    prepareCheckOutTransitionMock.mockReset();
    prepareCheckOutTransitionMock.mockReturnValue({ skipUpdate: true });
    loadLifecycleRouteContextMock.mockReset();
    loadLifecycleRouteContextMock.mockResolvedValue({
      context: {
        booking: BOOKING,
        serviceSupabase: { from: vi.fn() },
        userId: 'user-1',
      },
    });
    parseOptionalRouteBodyMock.mockReset();
    parseOptionalRouteBodyMock.mockResolvedValue({ data: {} });
    persistLifecycleTransitionMock.mockReset();
    persistLifecycleTransitionMock.mockResolvedValue({
      result: {
        status: 'completed',
        checkedInAt: BOOKING.checked_in_at,
        checkedOutAt: BOOKING.checked_out_at,
        updatedAt: null,
        changed: false,
      },
    });
    resolveBookingIdMock.mockReset();
    resolveBookingIdMock.mockResolvedValue(BOOKING.id);
  });

  it('does not replay check-out side effects for no-op transitions', async () => {
    const response = await POST(
      new NextRequest('https://app.nabatable.com/api/ops/bookings/booking-1/check-out', {
        method: 'POST',
        headers: {
          [CSRF_HEADER_NAME]: CSRF_TOKEN,
          cookie: `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}`,
        },
      }),
      { params: Promise.resolve({ id: BOOKING.id }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: 'completed',
      checkedInAt: BOOKING.checked_in_at,
      checkedOutAt: BOOKING.checked_out_at,
    });
    expect(clearBookingTableAssignmentsMock).not.toHaveBeenCalled();
    expect(enqueueCheckOutSideEffectsMock).not.toHaveBeenCalled();
    expect(invalidateOpsDashboardCachesMock).not.toHaveBeenCalled();
  });
});
