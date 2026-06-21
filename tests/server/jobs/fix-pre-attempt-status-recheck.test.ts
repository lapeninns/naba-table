import { beforeEach, describe, expect, it, vi } from 'vitest';

// Regression for bug #20: the job snapshots booking status at start and only
// re-reads it BETWEEN failed attempts, so an admin manual-assign/confirm between
// scheduling and the first quote (attempt 0) still wastes a 180s hold. The job
// must re-check status immediately before attempt 0 and short-circuit if the
// booking is already confirmed (or otherwise terminal).

const quoteTablesForBookingMock = vi.hoisted(() => vi.fn());
const atomicConfirmAndTransitionMock = vi.hoisted(() => vi.fn());
const recordObservabilityEventMock = vi.hoisted(() => vi.fn());
const recordPlannerQuoteTelemetryMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/capacity/tables', () => ({
  quoteTablesForBooking: quoteTablesForBookingMock,
  atomicConfirmAndTransition: atomicConfirmAndTransitionMock,
}));

vi.mock('@/server/observability', () => ({
  recordObservabilityEvent: recordObservabilityEventMock,
}));

vi.mock('@/server/capacity/planner-telemetry', () => ({
  recordPlannerQuoteTelemetry: recordPlannerQuoteTelemetryMock,
}));

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

vi.mock('@/server/runtime-policy', () => ({
  isAutoAssignOnBookingEnabled: vi.fn(() => true),
  getAutoAssignMaxRetries: vi.fn(() => 3),
  getAutoAssignRetryDelaysMs: vi.fn(() => [50]),
  getAutoAssignStartCutoffMinutes: vi.fn(() => 0),
}));

vi.mock('@/server/bookings/confirmation-notifications', () => ({
  sendFirstBookingConfirmationNotifications: vi.fn(),
}));

vi.mock('@/server/emails/bookings', () => ({
  sendBookingModificationConfirmedEmail: vi.fn(),
  sendBookingPendingAttentionEmail: vi.fn(),
}));

vi.mock('@/server/capacity/planner-cache', () => ({
  buildPlannerCacheKey: vi.fn(() => 'cache-key'),
  getPlannerCacheEntry: vi.fn(() => null),
  setPlannerCacheEntry: vi.fn(),
}));

// auto-assign-last-result and auto-assign-retry-policy are pure; leave them real.

import { autoAssignAndConfirmIfPossible } from '@/server/jobs/auto-assign';

const BOOKING_ID = 'booking-job-1';

const pendingBookingRow = {
  id: BOOKING_ID,
  restaurant_id: 'rest-1',
  status: 'pending',
  start_at: '2026-12-31T19:00:00.000Z',
  booking_date: '2026-12-31',
  start_time: '19:00:00',
  booking_type: 'dinner',
  party_size: 2,
  auto_assign_idempotency_key: null,
  auto_assign_last_result: null,
  details: {},
} as const;

/**
 * Supabase stub whose `.maybeSingle()` returns queued results in FIFO order.
 * The job reads via `from('bookings').select(...).eq('id', id).maybeSingle()`.
 */
function makeSupabaseStub(maybeSingleResults: Array<{ data: unknown; error: unknown }>) {
  const queue = [...maybeSingleResults];
  const maybeSingle = vi.fn(async () => queue.shift() ?? { data: null, error: null });
  // Support both `.eq(...).maybeSingle()` and the pending-admin update chain
  // (`.update().eq().eq().is().select().maybeSingle()`), all terminating in maybeSingle.
  const chain: Record<string, unknown> = {};
  const ret = () => chain;
  chain.select = vi.fn(ret);
  chain.eq = vi.fn(ret);
  chain.is = vi.fn(ret);
  chain.update = vi.fn(ret);
  chain.maybeSingle = maybeSingle;
  const from = vi.fn(() => chain);
  return { stub: { from } as never, maybeSingle };
}

describe('auto-assign pre-attempt-0 status re-check (#20)', () => {
  beforeEach(() => {
    quoteTablesForBookingMock.mockReset();
    atomicConfirmAndTransitionMock.mockReset();
    recordObservabilityEventMock.mockReset();
    recordPlannerQuoteTelemetryMock.mockReset();
    getServiceSupabaseClientMock.mockReset();
    recordObservabilityEventMock.mockResolvedValue(undefined);
    recordPlannerQuoteTelemetryMock.mockResolvedValue(undefined);
  });

  it('skips attempt 0 entirely when the booking was confirmed after job start', async () => {
    // 1st maybeSingle -> initial start-of-job lookup (still pending).
    // 2nd maybeSingle -> pre-attempt-0 re-check (now confirmed by an admin).
    const { stub } = makeSupabaseStub([
      { data: pendingBookingRow, error: null },
      { data: { status: 'confirmed' }, error: null },
    ]);
    getServiceSupabaseClientMock.mockReturnValue(stub);

    await autoAssignAndConfirmIfPossible(BOOKING_ID);

    // The hold-acquiring quote must never run for attempt 0.
    expect(quoteTablesForBookingMock).not.toHaveBeenCalled();
    expect(atomicConfirmAndTransitionMock).not.toHaveBeenCalled();
  });

  it('skips attempt 0 when the booking was cancelled after job start', async () => {
    const { stub } = makeSupabaseStub([
      { data: pendingBookingRow, error: null },
      { data: { status: 'cancelled' }, error: null },
    ]);
    getServiceSupabaseClientMock.mockReturnValue(stub);

    await autoAssignAndConfirmIfPossible(BOOKING_ID);

    expect(quoteTablesForBookingMock).not.toHaveBeenCalled();
  });

  it('still runs the quote for attempt 0 when the booking is still pending', async () => {
    const { stub } = makeSupabaseStub([
      { data: pendingBookingRow, error: null }, // start-of-job lookup
      { data: { status: 'pending' }, error: null }, // pre-attempt-0 re-check
      { data: { ...pendingBookingRow, status: 'confirmed' }, error: null }, // post-confirm reload
    ]);
    getServiceSupabaseClientMock.mockReturnValue(stub);

    // Quote returns a hold so attempt 0 confirms and the job returns on success.
    quoteTablesForBookingMock.mockResolvedValue({
      hold: { id: 'hold-xyz' },
      candidate: null,
      alternates: [],
      nextTimes: [],
      reason: undefined,
    });
    atomicConfirmAndTransitionMock.mockResolvedValue(undefined);

    await autoAssignAndConfirmIfPossible(BOOKING_ID);

    expect(quoteTablesForBookingMock).toHaveBeenCalledTimes(1);
    expect(atomicConfirmAndTransitionMock).toHaveBeenCalledTimes(1);
  });

  it('does not short-circuit when the pre-attempt re-check errors (fails safe to running the attempt)', async () => {
    // The re-check returns an error; the job must NOT skip work and must NOT
    // treat the error as "still actionable/available" — it falls through to the
    // attempt using the already-successful start-of-job snapshot.
    const { stub } = makeSupabaseStub([
      { data: pendingBookingRow, error: null }, // start-of-job lookup
      { data: null, error: { message: 'transient read error' } }, // pre-attempt-0 re-check fails
      { data: { ...pendingBookingRow, status: 'confirmed' }, error: null }, // post-confirm reload
    ]);
    getServiceSupabaseClientMock.mockReturnValue(stub);

    quoteTablesForBookingMock.mockResolvedValue({
      hold: { id: 'hold-after-error' },
      candidate: null,
      alternates: [],
      nextTimes: [],
      reason: undefined,
    });
    atomicConfirmAndTransitionMock.mockResolvedValue(undefined);

    await autoAssignAndConfirmIfPossible(BOOKING_ID);

    // Fail-safe: the attempt still ran despite the re-check error.
    expect(quoteTablesForBookingMock).toHaveBeenCalledTimes(1);
  });
});
