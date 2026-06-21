import { beforeEach, describe, expect, it, vi } from 'vitest';

// Regression for bug #7: on the inline auto-assign timeout/abort the 120s hold
// was never released (the abort hook only logged), so a fast 180s retry job
// created a second overlapping hold for the same booking. The inline path must
// best-effort release its hold on timeout (logged, never thrown) before bailing.

const quoteTablesForBookingMock = vi.hoisted(() => vi.fn());
const atomicConfirmAndTransitionMock = vi.hoisted(() => vi.fn());
const releaseTableHoldMock = vi.hoisted(() => vi.fn());
const updateBookingRecordMock = vi.hoisted(() => vi.fn());
const recordObservabilityEventMock = vi.hoisted(() => vi.fn());
const recordPlannerQuoteTelemetryMock = vi.hoisted(() => vi.fn());
const getInlineAutoAssignTimeoutMsMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/capacity/tables', () => ({
  quoteTablesForBooking: quoteTablesForBookingMock,
  atomicConfirmAndTransition: atomicConfirmAndTransitionMock,
}));

vi.mock('@/server/capacity/holds', () => ({
  releaseTableHold: releaseTableHoldMock,
}));

vi.mock('@/server/bookings', () => ({
  updateBookingRecord: updateBookingRecordMock,
}));

vi.mock('@/server/observability', () => ({
  recordObservabilityEvent: recordObservabilityEventMock,
}));

vi.mock('@/server/capacity/planner-telemetry', () => ({
  recordPlannerQuoteTelemetry: recordPlannerQuoteTelemetryMock,
}));

vi.mock('@/server/runtime-policy', () => ({
  getInlineAutoAssignTimeoutMs: getInlineAutoAssignTimeoutMsMock,
}));

// auto-assign-last-result is pure; let it run for realistic payload shaping.
import { attemptInlineAutoAssign } from '@/server/bookings/inline-auto-assign';

const baseBooking = {
  id: 'booking-inline-1',
  restaurant_id: 'rest-1',
  status: 'pending',
  auto_assign_idempotency_key: null,
  auto_assign_last_result: null,
} as const;

const HOLD_ID = 'hold-inline-123';

function makeSupabaseStub() {
  // Minimal chainable stub for the post-confirm reload (`.from().select().eq().maybeSingle()`)
  // and any incidental reads. Returns no row so finalBooking stays the input booking.
  const maybeSingle = vi.fn(async () => ({ data: null, error: null }));
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { from } as never;
}

describe('inline auto-assign timeout releases the hold (#7)', () => {
  beforeEach(() => {
    quoteTablesForBookingMock.mockReset();
    atomicConfirmAndTransitionMock.mockReset();
    releaseTableHoldMock.mockReset();
    updateBookingRecordMock.mockReset();
    recordObservabilityEventMock.mockReset();
    recordPlannerQuoteTelemetryMock.mockReset();
    getInlineAutoAssignTimeoutMsMock.mockReset();

    // Very short inline timeout so the race resolves deterministically/fast.
    getInlineAutoAssignTimeoutMsMock.mockReturnValue(20);
    recordObservabilityEventMock.mockResolvedValue(undefined);
    recordPlannerQuoteTelemetryMock.mockResolvedValue(undefined);
    updateBookingRecordMock.mockImplementation(async (_client, _id, _patch) => baseBooking);
    releaseTableHoldMock.mockResolvedValue(undefined);
  });

  it('releases the acquired hold when confirm exceeds the inline timeout', async () => {
    // Quote returns a hold quickly...
    quoteTablesForBookingMock.mockResolvedValue({
      hold: { id: HOLD_ID },
      candidate: null,
      alternates: [],
      nextTimes: [],
      reason: undefined,
    });
    // ...but confirm hangs well past the 20ms timeout, so the timeout fires
    // while the hold is still held.
    atomicConfirmAndTransitionMock.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 500)),
    );

    const supabase = makeSupabaseStub();

    const result = await attemptInlineAutoAssign(
      supabase,
      baseBooking as never,
      baseBooking.restaurant_id,
    );

    // The hold acquired before the timeout must be released, exactly once.
    expect(releaseTableHoldMock).toHaveBeenCalledTimes(1);
    expect(releaseTableHoldMock).toHaveBeenCalledWith(
      expect.objectContaining({ holdId: HOLD_ID }),
    );
    // The function still returns a booking (best-effort, swallows the abort).
    expect(result).toBeDefined();
  });

  it('does not release the hold when no hold was ever acquired (no-hold quote)', async () => {
    // Quote returns no hold and resolves immediately; the operation completes
    // before any timeout, so there is nothing to release.
    quoteTablesForBookingMock.mockResolvedValue({
      hold: null,
      candidate: null,
      alternates: [],
      nextTimes: [],
      reason: 'Insufficient filtered capacity',
    });

    const supabase = makeSupabaseStub();

    await attemptInlineAutoAssign(supabase, baseBooking as never, baseBooking.restaurant_id);

    expect(atomicConfirmAndTransitionMock).not.toHaveBeenCalled();
    expect(releaseTableHoldMock).not.toHaveBeenCalled();
  });

  it('does not release the hold on a successful confirm (hold consumed)', async () => {
    quoteTablesForBookingMock.mockResolvedValue({
      hold: { id: HOLD_ID },
      candidate: null,
      alternates: [],
      nextTimes: [],
      reason: undefined,
    });
    // Confirm succeeds quickly, before the timeout.
    atomicConfirmAndTransitionMock.mockResolvedValue(undefined);

    const supabase = makeSupabaseStub();

    await attemptInlineAutoAssign(supabase, baseBooking as never, baseBooking.restaurant_id);

    expect(atomicConfirmAndTransitionMock).toHaveBeenCalledTimes(1);
    // A successfully confirmed hold must never be released.
    expect(releaseTableHoldMock).not.toHaveBeenCalled();
  });
});
