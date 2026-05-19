import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const clearBookingTableAssignmentsMock = vi.hoisted(() => vi.fn());
const invalidateOpsDashboardCachesMock = vi.hoisted(() => vi.fn());
const prepareCheckInTransitionMock = vi.hoisted(() => vi.fn());
const prepareNoShowTransitionMock = vi.hoisted(() => vi.fn());
const prepareUndoNoShowTransitionMock = vi.hoisted(() => vi.fn());
const loadLifecycleRouteContextMock = vi.hoisted(() => vi.fn());
const parseOptionalRouteBodyMock = vi.hoisted(() => vi.fn());
const persistLifecycleTransitionMock = vi.hoisted(() => vi.fn());
const resolveBookingIdMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/bookings', () => ({
  clearBookingTableAssignments: clearBookingTableAssignmentsMock,
}));

vi.mock('@/server/ops/bookings', () => ({
  invalidateOpsDashboardCaches: invalidateOpsDashboardCachesMock,
}));

vi.mock('@/server/ops/booking-lifecycle/actions', () => ({
  prepareCheckInTransition: prepareCheckInTransitionMock,
  prepareNoShowTransition: prepareNoShowTransitionMock,
  prepareUndoNoShowTransition: prepareUndoNoShowTransitionMock,
}));

vi.mock('@/src/app/api/ops/bookings/[id]/_shared/lifecycleRoute', () => ({
  loadLifecycleRouteContext: loadLifecycleRouteContextMock,
  parseOptionalRouteBody: parseOptionalRouteBodyMock,
  persistLifecycleTransition: persistLifecycleTransitionMock,
  resolveBookingId: resolveBookingIdMock,
}));

import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '@/lib/security/csrf';
import { POST as postCheckIn } from '@/src/app/api/ops/bookings/[id]/check-in/route';
import { POST as postNoShow } from '@/src/app/api/ops/bookings/[id]/no-show/route';
import { POST as postUndoNoShow } from '@/src/app/api/ops/bookings/[id]/undo-no-show/route';

const RESTAURANT_ID = 'restaurant-1';
const USER_ID = 'user-1';
const BOOKING_ID = 'booking-1';
const CSRF_TOKEN = 'ops-lifecycle-csrf-token';

const BOOKING = {
  id: BOOKING_ID,
  restaurant_id: RESTAURANT_ID,
  status: 'confirmed',
  checked_in_at: null,
  checked_out_at: null,
  booking_date: '2026-05-16',
  start_time: '19:00',
};

const HISTORY_ENTRY = {
  id: 'history-1',
  booking_id: BOOKING_ID,
  from_status: 'confirmed',
  to_status: 'no_show',
  changed_by: USER_ID,
  changed_at: '2026-05-16T19:05:00.000Z',
  reason: 'guest did not arrive',
  metadata: { source: 'ops' },
};

const TRANSITIONS = {
  checkIn: { action: 'check-in' },
  noShow: { action: 'no-show' },
  undoNoShow: { action: 'undo-no-show' },
};

const lifecycleResult = {
  status: 'seated',
  checkedInAt: '2026-05-16T19:01:00.000Z',
  checkedOutAt: null,
  updatedAt: '2026-05-16T19:01:00.000Z',
  changed: true,
};

function csrfHeaders(): Headers {
  return new Headers({
    [CSRF_HEADER_NAME]: CSRF_TOKEN,
    cookie: `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}`,
  });
}

function buildRequest(path: string, body: Record<string, unknown> = {}): NextRequest {
  return new NextRequest(`https://app.nabatable.com${path}`, {
    method: 'POST',
    headers: csrfHeaders(),
    body: JSON.stringify(body),
  });
}

function buildRouteParams() {
  return {
    params: Promise.resolve({
      id: BOOKING_ID,
    }),
  };
}

function createHistoryQuery(response: {
  data: typeof HISTORY_ENTRY | null;
  error: { message: string } | null;
}) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    maybeSingle: vi.fn(async () => response),
  };
  return query;
}

describe('ops booking lifecycle routes', () => {
  let historyQuery: ReturnType<typeof createHistoryQuery>;
  let serviceSupabase: { from: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    clearBookingTableAssignmentsMock.mockReset();
    clearBookingTableAssignmentsMock.mockResolvedValue(undefined);
    invalidateOpsDashboardCachesMock.mockReset();
    prepareCheckInTransitionMock.mockReset();
    prepareCheckInTransitionMock.mockReturnValue(TRANSITIONS.checkIn);
    prepareNoShowTransitionMock.mockReset();
    prepareNoShowTransitionMock.mockReturnValue(TRANSITIONS.noShow);
    prepareUndoNoShowTransitionMock.mockReset();
    prepareUndoNoShowTransitionMock.mockReturnValue(TRANSITIONS.undoNoShow);
    parseOptionalRouteBodyMock.mockReset();
    parseOptionalRouteBodyMock.mockResolvedValue({ data: {} });
    persistLifecycleTransitionMock.mockReset();
    persistLifecycleTransitionMock.mockResolvedValue({
      result: lifecycleResult,
    });
    resolveBookingIdMock.mockReset();
    resolveBookingIdMock.mockResolvedValue(BOOKING_ID);

    historyQuery = createHistoryQuery({ data: HISTORY_ENTRY, error: null });
    serviceSupabase = {
      from: vi.fn(() => historyQuery),
    };
    loadLifecycleRouteContextMock.mockReset();
    loadLifecycleRouteContextMock.mockResolvedValue({
      context: {
        booking: BOOKING,
        serviceSupabase,
        userId: USER_ID,
      },
    });
  });

  it('checks in a booking through the lifecycle transition helper', async () => {
    const performedAt = '2026-05-16T19:01:00.000Z';
    parseOptionalRouteBodyMock.mockResolvedValue({ data: { performedAt } });

    const response = await postCheckIn(
      buildRequest(`/api/ops/bookings/${BOOKING_ID}/check-in`, { performedAt }),
      buildRouteParams(),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: lifecycleResult.status,
      checkedInAt: lifecycleResult.checkedInAt,
      checkedOutAt: lifecycleResult.checkedOutAt,
    });
    expect(prepareCheckInTransitionMock).toHaveBeenCalledWith({
      booking: BOOKING,
      actorId: USER_ID,
      performedAt,
    });
    expect(persistLifecycleTransitionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        booking: BOOKING,
        transition: TRANSITIONS.checkIn,
        serviceSupabase,
        logLabel: 'booking-check-in',
      }),
    );
    expect(invalidateOpsDashboardCachesMock).toHaveBeenCalledWith(RESTAURANT_ID, {
      summaryDates: [BOOKING.booking_date],
    });
  });

  it('marks a booking as no-show and releases table assignments', async () => {
    const performedAt = '2026-05-16T19:10:00.000Z';
    const reason = 'guest did not arrive';
    parseOptionalRouteBodyMock.mockResolvedValue({ data: { performedAt, reason } });
    persistLifecycleTransitionMock.mockResolvedValue({
      result: {
        ...lifecycleResult,
        status: 'no_show',
        checkedInAt: null,
        updatedAt: performedAt,
      },
    });

    const response = await postNoShow(
      buildRequest(`/api/ops/bookings/${BOOKING_ID}/no-show`, { performedAt, reason }),
      buildRouteParams(),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: 'no_show',
      checkedInAt: null,
      checkedOutAt: null,
    });
    expect(prepareNoShowTransitionMock).toHaveBeenCalledWith({
      booking: BOOKING,
      actorId: USER_ID,
      performedAt,
      reason,
    });
    expect(clearBookingTableAssignmentsMock).toHaveBeenCalledWith(serviceSupabase, BOOKING_ID);
    expect(invalidateOpsDashboardCachesMock).toHaveBeenCalledWith(RESTAURANT_ID, {
      summaryDates: [BOOKING.booking_date],
    });
  });

  it('undoes no-show using the latest no-show history entry', async () => {
    const reason = 'guest arrived late';
    parseOptionalRouteBodyMock.mockResolvedValue({ data: { reason } });
    persistLifecycleTransitionMock.mockResolvedValue({
      result: {
        ...lifecycleResult,
        status: 'confirmed',
        checkedInAt: null,
      },
    });

    const response = await postUndoNoShow(
      buildRequest(`/api/ops/bookings/${BOOKING_ID}/undo-no-show`, { reason }),
      buildRouteParams(),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: 'confirmed',
      checkedInAt: null,
      checkedOutAt: null,
    });
    expect(serviceSupabase.from).toHaveBeenCalledWith('booking_state_history');
    expect(historyQuery.eq).toHaveBeenCalledWith('booking_id', BOOKING_ID);
    expect(historyQuery.eq).toHaveBeenCalledWith('to_status', 'no_show');
    expect(historyQuery.order).toHaveBeenCalledWith('changed_at', { ascending: false });
    expect(historyQuery.limit).toHaveBeenCalledWith(1);
    expect(prepareUndoNoShowTransitionMock).toHaveBeenCalledWith({
      booking: BOOKING,
      actorId: USER_ID,
      historyEntry: HISTORY_ENTRY,
      reason,
    });
    expect(persistLifecycleTransitionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        booking: BOOKING,
        transition: TRANSITIONS.undoNoShow,
        serviceSupabase,
        logLabel: 'booking-undo-no-show',
      }),
    );
    expect(invalidateOpsDashboardCachesMock).toHaveBeenCalledWith(RESTAURANT_ID, {
      summaryDates: [BOOKING.booking_date],
    });
  });
});
