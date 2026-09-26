import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateBookingRecordMock = vi.hoisted(() => vi.fn());
const modifyPendingBookingMock = vi.hoisted(() => vi.fn());
const quoteTablesForBookingMock = vi.hoisted(() => vi.fn());
const atomicConfirmAndTransitionMock = vi.hoisted(() => vi.fn());
const releaseTableHoldMock = vi.hoisted(() => vi.fn());
const sendBookingModificationPendingEmailMock = vi.hoisted(() => vi.fn());
const sendBookingModificationConfirmedEmailMock = vi.hoisted(() => vi.fn());
const recordObservabilityEventMock = vi.hoisted(() => vi.fn());
const autoAssignAndConfirmIfPossibleMock = vi.hoisted(() => vi.fn());
const ensureBookingEmailIntentMock = vi.hoisted(() => vi.fn());
const afterCallbacks = vi.hoisted(() => [] as Array<() => Promise<unknown> | unknown>);
const emailQueueEnabled = vi.hoisted(() => ({ value: true }));
const loggerMock = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/server/runtime-policy', () => ({
  getInlineAutoAssignTimeoutMs: vi.fn(() => 10),
  isEmailQueueEnabled: vi.fn(() => emailQueueEnabled.value),
}));

vi.mock('@/server/bookings', () => ({
  updateBookingRecord: updateBookingRecordMock,
  modifyPendingBookingAndClearAssignments: modifyPendingBookingMock,
}));

vi.mock('@/server/capacity/tables', () => ({
  quoteTablesForBooking: quoteTablesForBookingMock,
  atomicConfirmAndTransition: atomicConfirmAndTransitionMock,
}));

vi.mock('@/server/capacity/holds', () => ({ releaseTableHold: releaseTableHoldMock }));

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

vi.mock('@/server/jobs/booking-side-effect-intents', () => ({
  bookingEmailIntentKey: (type: string, bookingId: string, discriminator?: string) =>
    ['email', type, bookingId, discriminator].filter(Boolean).join('__'),
  ensureBookingEmailIntent: ensureBookingEmailIntentMock,
}));

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  after: (callback: () => Promise<unknown> | unknown) => {
    afterCallbacks.push(callback);
  },
}));

vi.mock('@/lib/logger', () => ({ logger: loggerMock, sanitizeLogText: (value: string) => value }));

import { BookingValidationError } from '@/server/booking/BookingValidationService';
import { mapValidationFailure } from '@/server/booking/http';
import {
  BookingModificationConflictError,
  beginBookingModificationFlow,
  bookingModificationConflictResponse,
} from '@/server/bookings/modification-flow';

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'booking-1',
    restaurant_id: 'rest-1',
    booking_date: '2026-07-01',
    start_time: '19:30',
    end_time: '21:00',
    start_at: '2026-07-01T18:30:00.000Z',
    end_at: '2026-07-01T20:00:00.000Z',
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

const PATCH = {
  booking_date: '2026-07-01',
  start_time: '19:45',
  end_time: '21:15',
  start_at: '2026-07-01T18:45:00.000Z',
  end_at: '2026-07-01T20:15:00.000Z',
  party_size: 5,
};

/** A minimal client: `from('bookings')` reads return the current row; `rpc` is the swap. */
function makeClient(options: { swap?: () => { data: unknown; error: unknown } } = {}) {
  const current = makeBooking();
  const from = vi.fn(() => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      maybeSingle: vi.fn(() => builder),
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve({ data: current, error: null }).then(resolve),
    };
    return builder;
  });
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    if (name !== 'modify_booking_with_table_swap')
      return { data: null, error: { code: 'PGRST202' } };
    if (options.swap) return options.swap();
    return {
      data: makeBooking({ ...PATCH, status: 'confirmed', auto_assign_last_result: args.p_patch }),
      error: null,
    };
  });
  return { client: { from, rpc } as never, from, rpc };
}

function neverResolvingQuote() {
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
}

describe('beginBookingModificationFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    afterCallbacks.length = 0;
    emailQueueEnabled.value = true;
    recordObservabilityEventMock.mockResolvedValue(undefined);
    releaseTableHoldMock.mockResolvedValue(undefined);
    ensureBookingEmailIntentMock.mockResolvedValue({
      ok: true,
      intentId: 'intent-1',
      created: true,
      status: 'pending',
    });
    modifyPendingBookingMock.mockImplementation(
      async (_client, _bookingId, payload) => makeBooking({ ...payload }),
    );
    quoteTablesForBookingMock.mockResolvedValue({
      hold: { id: 'hold-1', metadata: { requireAdjacency: true } },
      reason: null,
      alternates: [],
    });
  });

  it('keeps a confirmed booking and its tables when no table fits the change (409)', async () => {
    quoteTablesForBookingMock.mockResolvedValue({
      hold: null,
      reason: 'NO_CAPACITY',
      alternates: [],
    });
    const { client, rpc } = makeClient();

    const error = await beginBookingModificationFlow({
      client,
      bookingId: 'booking-1',
      existingBooking: makeBooking() as never,
      payload: PATCH,
      source: 'guest',
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(BookingModificationConflictError);
    expect(error).toBeInstanceOf(BookingValidationError);
    expect(error).toMatchObject({ status: 409, code: 'MODIFICATION_NO_TABLES', retryable: false });
    // Nothing was released or rewritten: no clear, no swap, no pending downgrade.
    expect(modifyPendingBookingMock).not.toHaveBeenCalled();
    expect(updateBookingRecordMock).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    expect(atomicConfirmAndTransitionMock).not.toHaveBeenCalled();
    expect(ensureBookingEmailIntentMock).not.toHaveBeenCalled();
    expect(sendBookingModificationPendingEmailMock).not.toHaveBeenCalled();
    expect(afterCallbacks).toHaveLength(0);
    // Routes that already map BookingValidationError answer 409.
    expect(mapValidationFailure((error as BookingModificationConflictError).response).status).toBe(
      409,
    );
  });

  it('keeps the booking unchanged and asks for a retry when table selection times out', async () => {
    neverResolvingQuote();
    const { client, rpc } = makeClient();

    await expect(
      beginBookingModificationFlow({
        client,
        bookingId: 'booking-1',
        existingBooking: makeBooking() as never,
        payload: PATCH,
        source: 'ops',
      }),
    ).rejects.toMatchObject({
      code: 'MODIFICATION_TABLES_UNCONFIRMED',
      retryable: true,
      status: 409,
    });

    expect(quoteTablesForBookingMock).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: 'booking-1', signal: expect.any(AbortSignal) }),
    );
    expect(modifyPendingBookingMock).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('plans against the proposed window, not the stored one', async () => {
    let plannedRow: Record<string, unknown> | null = null;
    quoteTablesForBookingMock.mockImplementation(
      async ({
        client,
      }: {
        client: { from: (table: string) => PromiseLike<{ data: unknown }> };
      }) => {
        const result = await client.from('bookings');
        plannedRow = result.data as Record<string, unknown>;
        return { hold: null, reason: 'NO_CAPACITY', alternates: [] };
      },
    );
    const { client } = makeClient();

    await beginBookingModificationFlow({
      client,
      bookingId: 'booking-1',
      existingBooking: makeBooking() as never,
      payload: PATCH,
      source: 'guest',
    }).catch(() => undefined);

    expect(plannedRow).toMatchObject({ id: 'booking-1', ...PATCH });
  });

  it('swaps to the new tables in one transactional RPC and queues the email', async () => {
    const { client, rpc } = makeClient();

    const result = await beginBookingModificationFlow({
      client,
      bookingId: 'booking-1',
      existingBooking: makeBooking() as never,
      payload: PATCH,
      source: 'ops',
    });

    expect(result).toMatchObject({ id: 'booking-1', status: 'confirmed', start_time: '19:45' });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('modify_booking_with_table_swap', {
      p_booking_id: 'booking-1',
      p_restaurant_id: 'rest-1',
      p_patch: expect.objectContaining({
        ...PATCH,
        auto_assign_last_result: expect.objectContaining({ success: true }),
      }),
      p_hold_id: 'hold-1',
      p_expected_status: 'confirmed',
      p_idempotency_key: 'auto-key-mod-hold-1',
      p_require_adjacency: true,
      p_history_reason: 'modification_table_swap',
      p_history_metadata: { source: 'ops', holdId: 'hold-1' },
    });
    // The old two-step path (clear first, then assign) is gone.
    expect(modifyPendingBookingMock).not.toHaveBeenCalled();
    expect(atomicConfirmAndTransitionMock).not.toHaveBeenCalled();
    expect(ensureBookingEmailIntentMock).toHaveBeenCalledWith(client, {
      bookingId: 'booking-1',
      restaurantId: 'rest-1',
      type: 'updated',
      dedupeKey: 'email__updated__booking-1__hold-1',
      // A newer modification withdraws an older one's unsent email.
      supersedeTypes: ['updated', 'request_received', 'modification_pending'],
    });
    expect(sendBookingModificationConfirmedEmailMock).not.toHaveBeenCalled();
    expect(releaseTableHoldMock).not.toHaveBeenCalled();
    expect(afterCallbacks).toHaveLength(0);
  });

  it('maps a concurrent status change to a 409 and releases the unused hold', async () => {
    const { client } = makeClient({
      swap: () => ({ data: null, error: { code: 'P0004', message: 'booking_state_conflict' } }),
    });

    await expect(
      beginBookingModificationFlow({
        client,
        bookingId: 'booking-1',
        existingBooking: makeBooking() as never,
        payload: PATCH,
        source: 'guest',
      }),
    ).rejects.toMatchObject({ code: 'BOOKING_STATE_CONFLICT', status: 409 });
    expect(releaseTableHoldMock).toHaveBeenCalledWith({ holdId: 'hold-1', client });
  });

  it('maps a lost hold race to a retryable 409 and rethrows unexpected database errors', async () => {
    const lost = makeClient({
      swap: () => ({ data: null, error: { code: '23P01', message: 'conflict' } }),
    });
    await expect(
      beginBookingModificationFlow({
        client: lost.client,
        bookingId: 'booking-1',
        existingBooking: makeBooking() as never,
        payload: PATCH,
        source: 'guest',
      }),
    ).rejects.toMatchObject({ code: 'MODIFICATION_TABLES_UNCONFIRMED', retryable: true });

    const broken = makeClient({
      swap: () => ({ data: null, error: { code: 'XX000', message: 'internal error' } }),
    });
    const error = await beginBookingModificationFlow({
      client: broken.client,
      bookingId: 'booking-1',
      existingBooking: makeBooking() as never,
      payload: PATCH,
      source: 'guest',
    }).catch((caught: unknown) => caught);
    expect(error).not.toBeInstanceOf(BookingModificationConflictError);
    expect(releaseTableHoldMock).toHaveBeenCalledTimes(2);
  });

  it.each(['PGRST202', '42883'])(
    'answers a non-retryable 409 (not a 500) when the swap RPC is not deployed yet (%s)',
    async (code) => {
      const missing = makeClient({
        swap: () => ({ data: null, error: { code, message: 'function not found' } }),
      });
      await expect(
        beginBookingModificationFlow({
          client: missing.client,
          bookingId: 'booking-1',
          existingBooking: makeBooking() as never,
          payload: PATCH,
          source: 'guest',
        }),
      ).rejects.toMatchObject({ code: 'MODIFICATION_UNAVAILABLE', status: 409, retryable: false });
      expect(releaseTableHoldMock).toHaveBeenCalledWith({
        holdId: 'hold-1',
        client: missing.client,
      });
      expect(loggerMock.error).toHaveBeenCalledWith(
        '[booking.modification] table swap RPC unavailable',
        expect.objectContaining({ bookingId: 'booking-1', sqlState: code }),
      );
    },
  );

  it('keys the pending-path email on the committed change, so a retry of the same commit does not add a second email', async () => {
    quoteTablesForBookingMock.mockResolvedValue({
      hold: null,
      reason: 'NO_CAPACITY',
      alternates: [],
    });
    const committed = makeBooking({
      status: 'pending',
      ...PATCH,
      updated_at: '2026-06-30T10:00:00.000Z',
    });
    modifyPendingBookingMock.mockResolvedValue(committed);
    const { client } = makeClient();
    const run = () =>
      beginBookingModificationFlow({
        client,
        bookingId: 'booking-1',
        existingBooking: makeBooking({ status: 'pending' }) as never,
        payload: PATCH,
        source: 'guest',
      });

    await run();
    await run();
    const keys = ensureBookingEmailIntentMock.mock.calls.map(
      (call) => (call[1] as { dedupeKey: string }).dedupeKey,
    );
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
    expect(ensureBookingEmailIntentMock).toHaveBeenLastCalledWith(
      client,
      expect.objectContaining({
        type: 'modification_pending',
        supersedeTypes: ['updated', 'request_received', 'modification_pending'],
      }),
    );

    // A different committed change gets its own key (and supersedes the old email).
    modifyPendingBookingMock.mockResolvedValue({
      ...committed,
      party_size: 6,
      updated_at: '2026-06-30T10:05:00.000Z',
    });
    await run();
    const third = (ensureBookingEmailIntentMock.mock.calls[2]![1] as { dedupeKey: string })
      .dedupeKey;
    expect(third).not.toBe(keys[0]);
  });

  it('updates a pending booking that has no table yet and queues follow-up work durably', async () => {
    quoteTablesForBookingMock.mockResolvedValue({
      hold: null,
      reason: 'NO_CAPACITY',
      alternates: [],
    });
    modifyPendingBookingMock.mockImplementation(
      async (_client, _bookingId, payload) => makeBooking({ status: 'pending', ...payload }),
    );
    const { client, rpc } = makeClient();

    const result = await beginBookingModificationFlow({
      client,
      bookingId: 'booking-1',
      existingBooking: makeBooking({ status: 'pending' }) as never,
      payload: PATCH,
      source: 'guest',
    });

    expect(result).toMatchObject({ status: 'pending', start_time: '19:45' });
    expect(rpc).not.toHaveBeenCalled();
    expect(modifyPendingBookingMock).toHaveBeenCalledWith(
      client,
      'booking-1',
      expect.objectContaining({
        ...PATCH,
        auto_assign_last_result: expect.objectContaining({ success: false, reason: 'NO_CAPACITY' }),
      }),
      { restaurantId: 'rest-1', expectedStatus: 'pending' },
    );
    const patch = modifyPendingBookingMock.mock.calls[0]![2] as Record<
      string,
      unknown
    >;
    expect(patch).not.toHaveProperty('status');
    expect(ensureBookingEmailIntentMock).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ type: 'modification_pending', bookingId: 'booking-1' }),
    );
    expect(sendBookingModificationPendingEmailMock).not.toHaveBeenCalled();
    // Auto-assign runs through next/server after(), not a dangling promise.
    expect(autoAssignAndConfirmIfPossibleMock).not.toHaveBeenCalled();
    expect(afterCallbacks).toHaveLength(1);
    await afterCallbacks[0]!();
    expect(autoAssignAndConfirmIfPossibleMock).toHaveBeenCalledWith('booking-1', {
      forceRun: true,
      reason: 'modification',
      emailVariant: 'modified',
    });
  });

  it('refuses the pending path with a 409 when the booking was confirmed while the planner ran', async () => {
    quoteTablesForBookingMock.mockResolvedValue({ hold: null, reason: 'NO_CAPACITY', alternates: [] });
    modifyPendingBookingMock.mockRejectedValue({ code: 'P0004', message: 'booking_state_conflict' });
    const { client } = makeClient();

    const error = await beginBookingModificationFlow({
      client,
      bookingId: 'booking-1',
      existingBooking: makeBooking({ status: 'pending_allocation' }) as never,
      payload: PATCH,
      source: 'ops',
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(BookingModificationConflictError);
    expect((error as BookingModificationConflictError).code).toBe('BOOKING_STATE_CONFLICT');
    expect(modifyPendingBookingMock).toHaveBeenCalledWith(
      client,
      'booking-1',
      expect.any(Object),
      { restaurantId: 'rest-1', expectedStatus: 'pending_allocation' },
    );
    expect(ensureBookingEmailIntentMock).not.toHaveBeenCalled();
    expect(afterCallbacks).toHaveLength(0);
  });

  it('refuses the pending path with 409 MODIFICATION_UNAVAILABLE when the guarded RPC is missing', async () => {
    quoteTablesForBookingMock.mockResolvedValue({ hold: null, reason: 'NO_CAPACITY', alternates: [] });
    modifyPendingBookingMock.mockRejectedValue({ code: 'PGRST202', message: 'not found' });
    const { client } = makeClient();

    await expect(
      beginBookingModificationFlow({
        client,
        bookingId: 'booking-1',
        existingBooking: makeBooking({ status: 'pending' }) as never,
        payload: PATCH,
        source: 'guest',
      }),
    ).rejects.toMatchObject({ code: 'MODIFICATION_UNAVAILABLE' });
  });

  it('sends the email inline only when the durable email queue is disabled', async () => {
    emailQueueEnabled.value = false;
    const { client } = makeClient();

    await beginBookingModificationFlow({
      client,
      bookingId: 'booking-1',
      existingBooking: makeBooking() as never,
      payload: PATCH,
      source: 'guest',
    });

    expect(ensureBookingEmailIntentMock).not.toHaveBeenCalled();
    expect(sendBookingModificationConfirmedEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'booking-1', status: 'confirmed' }),
    );
  });

  it('never fails a committed modification because the email could not be queued', async () => {
    ensureBookingEmailIntentMock.mockResolvedValue({ ok: false, errorCode: '08006' });
    const { client } = makeClient();

    await expect(
      beginBookingModificationFlow({
        client,
        bookingId: 'booking-1',
        existingBooking: makeBooking() as never,
        payload: PATCH,
        source: 'guest',
      }),
    ).resolves.toMatchObject({ status: 'confirmed' });
  });

  it('builds a C1 409 body for routes', async () => {
    const response = bookingModificationConflictResponse(
      new BookingModificationConflictError('MODIFICATION_NO_TABLES'),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'MODIFICATION_NO_TABLES',
      retryable: false,
      message: expect.stringContaining('has not been changed'),
    });
  });
});
