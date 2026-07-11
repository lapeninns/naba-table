import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const emitHoldConfirmedMock = vi.hoisted(() => vi.fn(async () => undefined));
const recordObservabilityEventMock = vi.hoisted(() => vi.fn(async () => undefined));
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/capacity/telemetry', () => ({
  emitHoldConfirmed: emitHoldConfirmedMock,
}));

vi.mock('@/server/observability', () => ({
  recordObservabilityEvent: recordObservabilityEventMock,
}));

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

import { enqueueOutboxEvent, processOutboxBatch } from '@/server/outbox';

const NOW = '2026-07-15T12:00:00.000Z';

type QueryCall = { method: string; args: unknown[] };
type RecordedQuery = { table: string; calls: QueryCall[] };
type Resolver = (query: RecordedQuery) => { data?: unknown; error?: unknown };

function createSupabaseStub(resolve: Resolver) {
  const queries: RecordedQuery[] = [];
  const from = vi.fn((table: string) => {
    const query: RecordedQuery = { table, calls: [] };
    queries.push(query);
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'insert', 'update', 'eq', 'in', 'or', 'order', 'limit']) {
      builder[method] = (...args: unknown[]) => {
        query.calls.push({ method, args });
        return builder;
      };
    }
    builder.then = (
      onFulfilled?: (value: unknown) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) =>
      Promise.resolve()
        .then(() => resolve(query))
        .then(onFulfilled, onRejected);
    return builder;
  });
  return { client: { from } as never, from, queries };
}

const firstMethod = (query: RecordedQuery) => query.calls[0]?.method;
const argsOf = (query: RecordedQuery, method: string) =>
  query.calls.find((call) => call.method === method)?.args;
const updatesOf = (queries: RecordedQuery[]) =>
  queries
    .filter((q) => firstMethod(q) === 'update')
    .map((q) => ({
      payload: q.calls[0]!.args[0] as Record<string, unknown>,
      id: q.calls.find((c) => c.method === 'eq' && c.args[0] === 'id')?.args[1],
      statusGuard: q.calls.find((c) => c.method === 'eq' && c.args[0] === 'status')?.args[1],
    }));

function outboxRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt-1',
    event_type: 'capacity.hold.confirmed',
    status: 'pending',
    attempt_count: 0,
    next_attempt_at: null,
    restaurant_id: 'rest-1',
    booking_id: 'book-1',
    idempotency_key: null,
    payload: { holdId: 'h1' },
    created_at: '2026-07-15T11:59:00.000Z',
    ...overrides,
  };
}

function createProcessingClient(options: {
  rows?: unknown[] | null;
  selectError?: unknown;
  failClaimForId?: string;
}) {
  return createSupabaseStub((query) => {
    if (firstMethod(query) === 'select') {
      return { data: options.rows ?? [], error: options.selectError ?? null };
    }
    if (firstMethod(query) === 'update') {
      const payload = query.calls[0]!.args[0] as { status?: string };
      const id = query.calls.find((c) => c.method === 'eq' && c.args[0] === 'id')?.args[1];
      if (payload.status === 'processing' && options.failClaimForId === id) {
        throw new Error('claim lost to a concurrent worker');
      }
      return { error: null };
    }
    return { error: null };
  });
}

describe('enqueueOutboxEvent', () => {
  beforeEach(() => {
    getServiceSupabaseClientMock.mockReset();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('@contract enqueues a pending row with zeroed retry state and null defaults for optional ids', async () => {
    const stub = createSupabaseStub(() => ({ error: null }));

    await enqueueOutboxEvent({
      eventType: 'capacity.hold.confirmed',
      restaurantId: 'rest-1',
      bookingId: 'book-1',
      idempotencyKey: 'idem-1',
      dedupeKey: 'dedupe-1',
      payload: { holdId: 'h1' },
      client: stub.client,
    });
    await enqueueOutboxEvent({
      eventType: 'capacity.assignment.sync',
      payload: { a: 1 },
      client: stub.client,
    });

    expect(stub.from).toHaveBeenCalledWith('capacity_outbox');
    expect(stub.queries[0]!.calls[0]).toEqual({
      method: 'insert',
      args: [
        {
          event_type: 'capacity.hold.confirmed',
          restaurant_id: 'rest-1',
          booking_id: 'book-1',
          idempotency_key: 'idem-1',
          dedupe_key: 'dedupe-1',
          payload: { holdId: 'h1' },
          status: 'pending',
          attempt_count: 0,
          next_attempt_at: null,
        },
      ],
    });
    expect(stub.queries[1]!.calls[0]!.args[0]).toMatchObject({
      restaurant_id: null,
      booking_id: null,
      idempotency_key: null,
      dedupe_key: null,
    });
    expect(getServiceSupabaseClientMock).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('@contract a duplicate enqueue (unique violation 23505) is silently idempotent', async () => {
    const stub = createSupabaseStub(() => ({
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    }));

    await expect(
      enqueueOutboxEvent({ eventType: 'x', payload: {}, client: stub.client }),
    ).resolves.toBeUndefined();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('@contract enqueue is best-effort: unexpected failures log a warning instead of throwing', async () => {
    const insertError = createSupabaseStub(() => ({
      error: { code: '42501', message: 'permission denied' },
    }));
    await expect(
      enqueueOutboxEvent({ eventType: 'x', payload: {}, client: insertError.client }),
    ).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledTimes(1);

    const thrown = createSupabaseStub(() => {
      throw new Error('network down');
    });
    await expect(
      enqueueOutboxEvent({ eventType: 'x', payload: {}, client: thrown.client }),
    ).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledTimes(2);
  });

  it('@contract falls back to the service-role client when none is provided', async () => {
    const stub = createSupabaseStub(() => ({ error: null }));
    getServiceSupabaseClientMock.mockReturnValue(stub.client);

    await enqueueOutboxEvent({ eventType: 'x', payload: {} });

    expect(getServiceSupabaseClientMock).toHaveBeenCalledTimes(1);
    expect(stub.queries).toHaveLength(1);
  });
});

describe('processOutboxBatch', () => {
  beforeEach(() => {
    getServiceSupabaseClientMock.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
    vi.spyOn(Math, 'random').mockReturnValue(0); // deterministic backoff jitter
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('@worker @contract claims due events in order and completes hold confirmations', async () => {
    const stub = createProcessingClient({ rows: [outboxRow()] });

    const summary = await processOutboxBatch({ client: stub.client });

    const selectQuery = stub.queries.find((q) => firstMethod(q) === 'select')!;
    expect(argsOf(selectQuery, 'in')).toEqual(['status', ['pending', 'processing']]);
    expect(argsOf(selectQuery, 'or')).toEqual([
      `next_attempt_at.is.null,next_attempt_at.lte.${NOW}`,
    ]);
    expect(argsOf(selectQuery, 'limit')).toEqual([100]); // default batch size

    expect(emitHoldConfirmedMock).toHaveBeenCalledWith({ holdId: 'h1' });

    const updates = updatesOf(stub.queries);
    expect(updates).toEqual([
      { payload: { status: 'processing' }, id: 'evt-1', statusGuard: 'pending' },
      { payload: { status: 'done' }, id: 'evt-1', statusGuard: undefined },
    ]);

    expect(summary).toEqual({ processed: 1, failed: 0, dead: 0, pending: 0 });
    expect(recordObservabilityEventMock).toHaveBeenCalledWith({
      source: 'outbox',
      eventType: 'outbox.batch',
      severity: 'info',
      context: summary,
    });
  });

  it('@worker @contract @observability routes assignment sync events to observability with tenant ids', async () => {
    const stub = createProcessingClient({
      rows: [
        outboxRow({
          id: 'evt-2',
          event_type: 'capacity.assignment.sync',
          payload: { assignmentId: 'a1' },
        }),
      ],
    });

    const summary = await processOutboxBatch({ client: stub.client, limit: 7 });

    const selectQuery = stub.queries.find((q) => firstMethod(q) === 'select')!;
    expect(argsOf(selectQuery, 'limit')).toEqual([7]);

    expect(recordObservabilityEventMock).toHaveBeenCalledWith({
      source: 'capacity.sync',
      eventType: 'capacity.assignment.synchronized',
      severity: 'info',
      context: { assignmentId: 'a1' },
      restaurantId: 'rest-1',
      bookingId: 'book-1',
    });
    expect(summary).toEqual({ processed: 1, failed: 0, dead: 0, pending: 0 });
  });

  it('@worker @contract unknown event types are completed rather than retried (poison-pill guard)', async () => {
    const stub = createProcessingClient({
      rows: [outboxRow({ id: 'evt-3', event_type: 'mystery.event' })],
    });

    const summary = await processOutboxBatch({ client: stub.client });

    expect(console.warn).toHaveBeenCalledWith(
      '[outbox] unknown event type',
      expect.objectContaining({ type: 'mystery.event', id: 'evt-3' }),
    );
    expect(updatesOf(stub.queries).at(-1)).toMatchObject({
      payload: { status: 'done' },
      id: 'evt-3',
    });
    expect(summary.processed).toBe(1);
    expect(emitHoldConfirmedMock).not.toHaveBeenCalled();
  });

  it('@worker @contract a failing handler schedules a retry with exponential backoff and isolates healthy events', async () => {
    emitHoldConfirmedMock.mockImplementation(async (payload: { holdId?: string }) => {
      if (payload.holdId === 'bad') throw new Error('downstream unavailable');
    });
    const stub = createProcessingClient({
      rows: [
        outboxRow({ id: 'evt-ok', payload: { holdId: 'good' } }),
        outboxRow({ id: 'evt-bad', payload: { holdId: 'bad' }, attempt_count: 0 }),
      ],
    });

    const summary = await processOutboxBatch({ client: stub.client });

    expect(summary).toEqual({ processed: 1, failed: 1, dead: 0, pending: 1 });

    const retry = updatesOf(stub.queries).find((u) => u.id === 'evt-bad' && u.payload.status === 'pending')!;
    // attempts=1 -> 2^1 * 250ms = 500ms after the frozen clock (jitter pinned to 0).
    expect(retry.payload).toEqual({
      status: 'pending',
      attempt_count: 1,
      next_attempt_at: '2026-07-15T12:00:00.500Z',
    });

    expect(recordObservabilityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'outbox.batch', severity: 'warning' }),
    );
  });

  it('@worker @contract retry backoff caps at 30 seconds', async () => {
    emitHoldConfirmedMock.mockRejectedValue(new Error('still down'));
    const stub = createProcessingClient({
      rows: [outboxRow({ id: 'evt-8', attempt_count: 8 })],
    });

    await processOutboxBatch({ client: stub.client });

    const retry = updatesOf(stub.queries).find((u) => u.id === 'evt-8' && u.payload.status === 'pending')!;
    // attempts=9 -> exponent clamps at 8 -> 64s uncapped -> pinned to the 30s max.
    expect(retry.payload).toEqual({
      status: 'pending',
      attempt_count: 9,
      next_attempt_at: '2026-07-15T12:00:30.000Z',
    });
  });

  it('@worker @contract the tenth failure dead-letters the event', async () => {
    emitHoldConfirmedMock.mockRejectedValue(new Error('permanently broken'));
    const stub = createProcessingClient({
      rows: [outboxRow({ id: 'evt-dead', attempt_count: 9 })],
    });

    const summary = await processOutboxBatch({ client: stub.client });

    expect(summary).toEqual({ processed: 0, failed: 0, dead: 1, pending: 1 });
    expect(updatesOf(stub.queries).at(-1)).toMatchObject({
      payload: { status: 'dead', attempt_count: 10, next_attempt_at: null },
      id: 'evt-dead',
    });
  });

  it('@worker @contract losing the claim race to a concurrent worker does not stop processing', async () => {
    // Pinned semantics: the claim update is fire-and-forget — when another worker
    // steals the row (claim update throws), THIS worker still runs the handler.
    // The status guard (eq status) is what keeps the window small, not a hard lock.
    const stub = createProcessingClient({
      rows: [outboxRow({ id: 'evt-raced' }), outboxRow({ id: 'evt-second', payload: { holdId: 'h2' } })],
      failClaimForId: 'evt-raced',
    });

    const summary = await processOutboxBatch({ client: stub.client });

    expect(emitHoldConfirmedMock).toHaveBeenCalledTimes(2);
    expect(emitHoldConfirmedMock).toHaveBeenNthCalledWith(1, { holdId: 'h1' });
    expect(emitHoldConfirmedMock).toHaveBeenNthCalledWith(2, { holdId: 'h2' });
    expect(summary).toEqual({ processed: 2, failed: 0, dead: 0, pending: 0 });
  });

  it('@worker @contract select failures and an empty queue both return zeros without batch telemetry', async () => {
    const failing = createProcessingClient({ rows: null, selectError: { message: 'boom' } });
    await expect(processOutboxBatch({ client: failing.client })).resolves.toEqual({
      processed: 0,
      failed: 0,
      dead: 0,
      pending: 0,
    });

    const empty = createProcessingClient({ rows: [] });
    await expect(processOutboxBatch({ client: empty.client })).resolves.toEqual({
      processed: 0,
      failed: 0,
      dead: 0,
      pending: 0,
    });

    expect(recordObservabilityEventMock).not.toHaveBeenCalled();
  });

  it('@worker @contract batch telemetry failures never break the returned summary', async () => {
    recordObservabilityEventMock.mockRejectedValue(new Error('telemetry offline'));
    const stub = createProcessingClient({ rows: [outboxRow()] });

    await expect(processOutboxBatch({ client: stub.client })).resolves.toEqual({
      processed: 1,
      failed: 0,
      dead: 0,
      pending: 0,
    });
  });
});
