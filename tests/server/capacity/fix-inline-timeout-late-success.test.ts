import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// GAP #11 regression: inline-timeout telemetry overwritten by a late confirm
// success. handleInlineTimeout persists an INLINE_TIMEOUT result and sets the
// `inlineTimeoutPersisted` guard. The ERROR/abort paths honor that guard, but
// the SUCCESS path historically did NOT — so an atomicConfirmAndTransition that
// resolved JUST AFTER the timeout fired would run the success-persist block and
// overwrite the timeout record with success:true, corrupting retry telemetry and
// triggering redundant background jobs. The fix gates the success persist on the
// same flag and logs that a late success arrived (booking correctness unchanged).
//
// This drives attemptInlineAutoAssign (server/bookings/inline-auto-assign.ts),
// not the services-layer wrapper. Mocks mirror tests/server/inline-auto-assign.test.ts.
const updateBookingRecordMock = vi.hoisted(() => vi.fn());
const quoteTablesForBookingMock = vi.hoisted(() => vi.fn());
const atomicConfirmAndTransitionMock = vi.hoisted(() => vi.fn());
const recordPlannerQuoteTelemetryMock = vi.hoisted(() => vi.fn());
const recordObservabilityEventMock = vi.hoisted(() => vi.fn());
const releaseTableHoldMock = vi.hoisted(() => vi.fn());

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

vi.mock('@/server/capacity/holds', () => ({
  releaseTableHold: releaseTableHoldMock,
}));

// Force the inline timeout window to a tiny value so the timeout reliably fires
// before the (deliberately delayed) confirm resolves under fake timers.
vi.mock('@/server/runtime-policy', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getInlineAutoAssignTimeoutMs: () => 10,
  };
});

// Keep buildInlineLastResult REAL so we can assert on the persisted shape
// (success / reason). classifyPlannerReason is pure and also left real.
import { attemptInlineAutoAssign } from '@/server/bookings/inline-auto-assign';

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'booking-1',
    restaurant_id: 'rest-1',
    booking_date: '2026-07-01',
    start_time: '19:30',
    end_time: '21:00',
    party_size: 4,
    status: 'pending',
    auto_assign_idempotency_key: 'api-booking-1',
    auto_assign_last_result: null,
    ...overrides,
  };
}

// Minimal Supabase stub: the success path reloads via
// supabase.from('bookings').select('*').eq('id', ...).maybeSingle().
function makeSupabaseStub() {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: makeBooking({ status: 'confirmed' }), error: null }),
        }),
      }),
    }),
  } as never;
}

describe('attemptInlineAutoAssign late-success telemetry guard (regression #11)', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    updateBookingRecordMock.mockReset();
    quoteTablesForBookingMock.mockReset();
    atomicConfirmAndTransitionMock.mockReset();
    recordPlannerQuoteTelemetryMock.mockReset();
    recordObservabilityEventMock.mockReset();
    releaseTableHoldMock.mockReset();

    updateBookingRecordMock.mockImplementation(async (_client, _bookingId, payload) =>
      makeBooking(payload),
    );
    recordPlannerQuoteTelemetryMock.mockResolvedValue(undefined);
    recordObservabilityEventMock.mockResolvedValue(undefined);
    releaseTableHoldMock.mockResolvedValue(undefined);

    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does NOT overwrite the persisted INLINE_TIMEOUT record when the confirm resolves after the timeout', async () => {
    // Quote resolves immediately with a usable hold so the operation proceeds to
    // confirm BEFORE the 10ms timeout fires.
    quoteTablesForBookingMock.mockResolvedValue({
      hold: { id: 'hold-1' },
      reason: null,
      alternates: [],
      plannerStats: null,
    });

    // The confirm resolves LATE (at ~30ms), well after the 10ms timeout has
    // already persisted INLINE_TIMEOUT. This is the exact race the fix targets.
    atomicConfirmAndTransitionMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          setTimeout(resolve, 30);
        }),
    );

    const resultPromise = attemptInlineAutoAssign(makeSupabaseStub(), makeBooking(), 'rest-1');

    // Let the timeout (10ms) fire and the function settle to its AbortError path.
    await vi.advanceTimersByTimeAsync(15);
    const result = await resultPromise;
    expect(result).toBeDefined();

    // Now let the LATE confirm resolve and flush its continuation (success-persist
    // block) so a regression would have a chance to overwrite the record.
    await vi.advanceTimersByTimeAsync(40);
    await vi.runAllTimersAsync();

    const persistedResults = updateBookingRecordMock.mock.calls.map(
      (call) => call[2]?.auto_assign_last_result,
    );

    // The timeout record must have been persisted...
    expect(persistedResults).toContainEqual(
      expect.objectContaining({ reason: 'INLINE_TIMEOUT', success: false }),
    );
    // ...and the late confirm must NOT have overwritten it with success:true.
    expect(persistedResults).not.toContainEqual(expect.objectContaining({ success: true }));

    // The confirm DID run (it resolved late); the guard suppressed only the
    // telemetry overwrite, not booking correctness.
    expect(atomicConfirmAndTransitionMock).toHaveBeenCalledTimes(1);

    // And the late success was logged rather than silently dropped.
    expect(
      warnSpy.mock.calls.some(
        ([msg]) =>
          typeof msg === 'string' && msg.includes('late confirm success after inline timeout'),
      ),
    ).toBe(true);
  });

  it('still persists success normally when the confirm resolves BEFORE any timeout', async () => {
    // Control case: confirm resolves immediately, timeout never fires, so the
    // success persist must still happen (guard must not break the happy path).
    quoteTablesForBookingMock.mockResolvedValue({
      hold: { id: 'hold-1' },
      reason: null,
      alternates: [],
      plannerStats: null,
    });
    atomicConfirmAndTransitionMock.mockResolvedValue(undefined);

    const resultPromise = attemptInlineAutoAssign(makeSupabaseStub(), makeBooking(), 'rest-1');
    await vi.runAllTimersAsync();
    await resultPromise;

    const persistedResults = updateBookingRecordMock.mock.calls.map(
      (call) => call[2]?.auto_assign_last_result,
    );

    expect(persistedResults).toContainEqual(expect.objectContaining({ success: true }));
    expect(persistedResults).not.toContainEqual(
      expect.objectContaining({ reason: 'INLINE_TIMEOUT' }),
    );
  });
});
