import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateBookingRecordMock = vi.hoisted(() => vi.fn());
const updateBookingAndClearAssignmentsAtomicallyMock = vi.hoisted(() => vi.fn());
const clearBookingTableAssignmentsMock = vi.hoisted(() => vi.fn());
const quoteTablesForBookingMock = vi.hoisted(() => vi.fn());
const atomicConfirmAndTransitionMock = vi.hoisted(() => vi.fn());
const sendBookingModificationPendingEmailMock = vi.hoisted(() => vi.fn());
const sendBookingModificationConfirmedEmailMock = vi.hoisted(() => vi.fn());
const recordObservabilityEventMock = vi.hoisted(() => vi.fn());
const autoAssignAndConfirmIfPossibleMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/env', () => ({
  env: {
    featureFlags: {
      inlineAutoAssignTimeoutMs: 10,
    },
  },
}));

vi.mock('@/server/bookings', () => ({
  updateBookingRecord: updateBookingRecordMock,
  updateBookingAndClearAssignmentsAtomically: updateBookingAndClearAssignmentsAtomicallyMock,
  clearBookingTableAssignments: clearBookingTableAssignmentsMock,
}));

vi.mock('@/server/capacity/tables', () => ({
  quoteTablesForBooking: quoteTablesForBookingMock,
  atomicConfirmAndTransition: atomicConfirmAndTransitionMock,
}));

vi.mock('@/server/emails/bookings', () => ({
  sendBookingModificationPendingEmail: sendBookingModificationPendingEmailMock,
  sendBookingModificationConfirmedEmail: sendBookingModificationConfirmedEmailMock,
}));

vi.mock('@/server/observability', () => ({
  recordObservabilityEvent: recordObservabilityEventMock,
}));

vi.mock('@/server/jobs/auto-assign', () => ({
  autoAssignAndConfirmIfPossible: autoAssignAndConfirmIfPossibleMock,
}));

import { beginBookingModificationFlow } from '@/server/bookings/modification-flow';

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'booking-1',
    restaurant_id: 'rest-1',
    booking_date: '2026-07-01',
    start_time: '19:30',
    end_time: '21:00',
    party_size: 4,
    booking_type: 'dinner',
    seating_preference: 'any',
    status: 'confirmed',
    customer_email: 'guest@example.com',
    customer_name: 'Guest',
    customer_phone: '',
    auto_assign_idempotency_key: 'auto-key',
    ...overrides,
  };
}

function makeClient(reloaded = makeBooking()) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: reloaded });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));

  return { from } as never;
}

describe('beginBookingModificationFlow inline assignment timeout', () => {
  beforeEach(() => {
    updateBookingRecordMock.mockReset();
    updateBookingAndClearAssignmentsAtomicallyMock.mockReset();
    clearBookingTableAssignmentsMock.mockReset();
    quoteTablesForBookingMock.mockReset();
    atomicConfirmAndTransitionMock.mockReset();
    sendBookingModificationPendingEmailMock.mockReset();
    sendBookingModificationConfirmedEmailMock.mockReset();
    recordObservabilityEventMock.mockReset();
    autoAssignAndConfirmIfPossibleMock.mockReset();

    updateBookingAndClearAssignmentsAtomicallyMock.mockImplementation(
      async (_client, _bookingId, payload) =>
        makeBooking({
          ...payload,
        }),
    );
    recordObservabilityEventMock.mockResolvedValue(undefined);
    sendBookingModificationPendingEmailMock.mockResolvedValue(undefined);
    sendBookingModificationConfirmedEmailMock.mockResolvedValue(undefined);
    autoAssignAndConfirmIfPossibleMock.mockResolvedValue(undefined);
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

  it('returns the pending booking and schedules fallback work when inline assignment times out', async () => {
    const promise = beginBookingModificationFlow({
      client: {} as never,
      bookingId: 'booking-1',
      existingBooking: makeBooking(),
      payload: {
        booking_date: '2026-07-01',
        start_time: '19:45',
        end_time: '21:15',
        party_size: 4,
      },
      source: 'ops',
    });

    const result = await promise;

    expect(result.status).toBe('pending');
    expect(updateBookingAndClearAssignmentsAtomicallyMock).toHaveBeenCalledWith(
      expect.anything(),
      'booking-1',
      expect.objectContaining({
        booking_date: '2026-07-01',
        start_time: '19:45',
        status: 'pending',
      }),
      { restaurantId: 'rest-1' },
    );
    expect(quoteTablesForBookingMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 'booking-1',
        signal: expect.any(AbortSignal),
      }),
    );
    expect(atomicConfirmAndTransitionMock).not.toHaveBeenCalled();
    expect(updateBookingRecordMock).toHaveBeenCalledWith(
      expect.anything(),
      'booking-1',
      expect.objectContaining({
        auto_assign_last_result: expect.objectContaining({
          reason: 'INLINE_TIMEOUT',
          success: false,
        }),
      }),
    );
    expect(sendBookingModificationPendingEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'booking-1', status: 'pending' }),
    );
    expect(autoAssignAndConfirmIfPossibleMock).toHaveBeenCalledWith('booking-1', {
      bypassFeatureFlag: true,
      reason: 'modification',
      emailVariant: 'modified',
    });
  });

  it('passes the timeout signal into quote and confirm on successful inline assignment', async () => {
    let quoteSignal: AbortSignal | null = null;
    let confirmSignal: AbortSignal | null = null;

    quoteTablesForBookingMock.mockImplementation(({ signal }: { signal: AbortSignal }) => {
      quoteSignal = signal;
      return Promise.resolve({
        hold: { id: 'hold-1' },
        reason: null,
        alternates: [],
      });
    });
    atomicConfirmAndTransitionMock.mockImplementation(({ signal }: { signal: AbortSignal }) => {
      confirmSignal = signal;
      return Promise.resolve(undefined);
    });

    const result = await beginBookingModificationFlow({
      client: makeClient(makeBooking({ status: 'confirmed' })),
      bookingId: 'booking-1',
      existingBooking: makeBooking(),
      payload: {
        booking_date: '2026-07-01',
        start_time: '19:45',
        end_time: '21:15',
        party_size: 4,
      },
      source: 'ops',
    });

    expect(result.status).toBe('confirmed');
    expect(quoteSignal).toBeInstanceOf(AbortSignal);
    expect(confirmSignal).toBe(quoteSignal);
    expect(quoteSignal?.aborted).toBe(false);
    expect(atomicConfirmAndTransitionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 'booking-1',
        holdId: 'hold-1',
        signal: quoteSignal,
      }),
    );
    expect(sendBookingModificationConfirmedEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'booking-1', status: 'confirmed' }),
    );
    expect(sendBookingModificationPendingEmailMock).not.toHaveBeenCalled();
    expect(autoAssignAndConfirmIfPossibleMock).not.toHaveBeenCalled();
  });
});
