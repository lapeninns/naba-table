import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const updateBookingRecordMock = vi.hoisted(() => vi.fn());
const quoteTablesForBookingMock = vi.hoisted(() => vi.fn());
const atomicConfirmAndTransitionMock = vi.hoisted(() => vi.fn());
const recordPlannerQuoteTelemetryMock = vi.hoisted(() => vi.fn());
const recordObservabilityEventMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/bookings', () => ({
  updateBookingRecord: updateBookingRecordMock,
}));

vi.mock('@/server/capacity/tables', () => ({
  quoteTablesForBooking: quoteTablesForBookingMock,
  atomicConfirmAndTransition: atomicConfirmAndTransitionMock,
}));

vi.mock('@/server/capacity/planner-telemetry', () => ({
  recordPlannerQuoteTelemetry: recordPlannerQuoteTelemetryMock,
}));

vi.mock('@/server/observability', () => ({
  recordObservabilityEvent: recordObservabilityEventMock,
}));

import { runInlineAutoAssign } from '@/services/inline-auto-assign';

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'booking-1',
    restaurant_id: 'rest-1',
    booking_date: '2026-07-01',
    start_time: '19:30',
    end_time: '21:00',
    party_size: 4,
    status: 'pending',
    auto_assign_last_result: null,
    ...overrides,
  };
}

describe('runInlineAutoAssign timeout cancellation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    updateBookingRecordMock.mockReset();
    quoteTablesForBookingMock.mockReset();
    atomicConfirmAndTransitionMock.mockReset();
    recordPlannerQuoteTelemetryMock.mockReset();
    recordObservabilityEventMock.mockReset();

    updateBookingRecordMock.mockImplementation(async (_client, _bookingId, payload) =>
      makeBooking(payload),
    );
    recordPlannerQuoteTelemetryMock.mockResolvedValue(undefined);
    recordObservabilityEventMock.mockResolvedValue(undefined);
    quoteTablesForBookingMock.mockImplementation(
      ({ signal }: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            const error = new Error('Planner aborted');
            error.name = 'AbortError';
            reject(error);
          });
        }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('persists timeout failure and never persists success after timeout wins', async () => {
    const resultPromise = runInlineAutoAssign({
      bookingId: 'booking-1',
      restaurantId: 'rest-1',
      timeoutMs: 10,
      createdBy: 'ops-walk-in',
      historyReason: 'ops_walk_in_inline_auto_assign',
      observabilitySource: 'api.ops.bookings.inline_auto_assign',
      client: {} as never,
    });

    await vi.advanceTimersByTimeAsync(20);
    const result = await resultPromise;

    expect(result).toBeNull();
    expect(quoteTablesForBookingMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 'booking-1',
        signal: expect.any(AbortSignal),
      }),
    );
    expect(atomicConfirmAndTransitionMock).not.toHaveBeenCalled();

    const persistedResults = updateBookingRecordMock.mock.calls.map(
      (call) => call[2]?.auto_assign_last_result,
    );
    expect(persistedResults).toContainEqual(
      expect.objectContaining({
        reason: 'INLINE_TIMEOUT',
        success: false,
      }),
    );
    expect(persistedResults).not.toContainEqual(
      expect.objectContaining({
        success: true,
      }),
    );
  });
});
