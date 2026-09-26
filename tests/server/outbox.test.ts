import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const emitHoldConfirmedMock = vi.hoisted(() => vi.fn(async () => undefined));
const recordObservabilityEventMock = vi.hoisted(() => vi.fn(async () => undefined));
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const loggerMock = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/server/capacity/telemetry', () => ({
  emitHoldConfirmed: emitHoldConfirmedMock,
}));

vi.mock('@/server/observability', () => ({
  recordObservabilityEvent: recordObservabilityEventMock,
}));

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

vi.mock('@/lib/logger', () => ({ logger: loggerMock }));

import { enqueueOutboxEvent, processOutboxBatch } from '@/server/outbox';

const NOW = '2026-07-15T12:00:00.000Z';

type QueryCall = { method: string; args: unknown[] };
type RecordedQuery = { table: string; calls: QueryCall[] };
type Resolver = (query: RecordedQuery) => { data?: unknown; error?: unknown };
type RpcResolver = (name: string, args: unknown) => { data?: unknown; error?: unknown };

function createSupabaseStub(resolve: Resolver, resolveRpc?: RpcResolver) {
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
  const rpc = vi.fn(async (name: string, args: unknown) =>
    resolveRpc ? resolveRpc(name, args) : { data: null, error: null },
  );
  return { client: { from, rpc } as never, from, rpc, queries };
}

const firstMethod = (query: RecordedQuery) => query.calls[0]?.method;
const updatesOf = (queries: RecordedQuery[]) =>
  queries
    .filter((q) => firstMethod(q) === 'update')
    .map((q) => ({
      payload: q.calls[0]!.args[0] as Record<string, unknown>,
      id: q.calls.find((c) => c.method === 'eq' && c.args[0] === 'id')?.args[1],
      statusGuard: q.calls.find((c) => c.method === 'eq' && c.args[0] === 'status')?.args[1],
    }));

/** A row as returned by claim_capacity_outbox_batch: already leased, attempt counted. */
function claimedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt-1',
    event_type: 'capacity.hold.confirmed',
    status: 'processing',
    attempt_count: 1,
    next_attempt_at: '2026-07-15T12:05:00.000Z',
    restaurant_id: 'rest-1',
    booking_id: 'book-1',
    idempotency_key: null,
    dedupe_key: null,
    payload: { holdId: 'h1' },
    created_at: '2026-07-15T11:59:00.000Z',
    updated_at: NOW,
    ...overrides,
  };
}

function createProcessingClient(options: {
  rows?: unknown[] | null;
  claimError?: unknown;
  lostLeaseIds?: string[];
}) {
  return createSupabaseStub(
    (query) => {
      if (firstMethod(query) === 'update') {
        const id = query.calls.find((c) => c.method === 'eq' && c.args[0] === 'id')?.args[1];
        const lost = typeof id === 'string' && options.lostLeaseIds?.includes(id);
        return { data: lost ? [] : [{ id }], error: null };
      }
      return { error: null };
    },
    (name) => {
      if (name !== 'claim_capacity_outbox_batch') return { data: null, error: null };
      return { data: options.rows ?? [], error: options.claimError ?? null };
    },
  );
}

describe('enqueueOutboxEvent', () => {
  beforeEach(() => {
    getServiceSupabaseClientMock.mockReset();
    Object.values(loggerMock).forEach((fn) => fn.mockReset());
  });

  it('@contract enqueues a pending row with zeroed retry state and reports it', async () => {
    const stub = createSupabaseStub(() => ({ error: null }));

    const first = await enqueueOutboxEvent({
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

    expect(first).toEqual({ status: 'enqueued' });
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
    expect(loggerMock.warn).not.toHaveBeenCalled();
  });

  it('@contract a duplicate enqueue (unique violation 23505) is idempotent and says so', async () => {
    const stub = createSupabaseStub(() => ({
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    }));

    await expect(
      enqueueOutboxEvent({ eventType: 'x', payload: {}, client: stub.client }),
    ).resolves.toEqual({ status: 'duplicate' });
    expect(loggerMock.warn).not.toHaveBeenCalled();
  });

  it('@contract failures are logged without raw provider text and returned, never thrown', async () => {
    const insertError = createSupabaseStub(() => ({
      error: { code: '42501', message: 'permission denied for guest@example.com' },
    }));
    await expect(
      enqueueOutboxEvent({
        eventType: 'x',
        bookingId: 'book-1',
        payload: {},
        client: insertError.client,
      }),
    ).resolves.toEqual({ status: 'failed', errorCode: '42501' });
    expect(loggerMock.warn).toHaveBeenCalledWith('[outbox] enqueue failed', {
      eventType: 'x',
      bookingId: 'book-1',
      restaurantId: null,
      errorCode: '42501',
    });

    const thrown = createSupabaseStub(() => {
      throw new Error('network down');
    });
    await expect(
      enqueueOutboxEvent({ eventType: 'x', payload: {}, client: thrown.client }),
    ).resolves.toEqual({ status: 'failed', errorCode: 'UNKNOWN' });
    expect(loggerMock.warn).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(loggerMock.warn.mock.calls)).not.toContain('guest@example.com');
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
    emitHoldConfirmedMock.mockReset();
    emitHoldConfirmedMock.mockResolvedValue(undefined);
    recordObservabilityEventMock.mockReset();
    recordObservabilityEventMock.mockResolvedValue(undefined);
    Object.values(loggerMock).forEach((fn) => fn.mockReset());
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
    vi.spyOn(Math, 'random').mockReturnValue(0); // deterministic backoff jitter
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('@worker @contract claims atomically through the leased claim RPC and settles with a status guard', async () => {
    const stub = createProcessingClient({ rows: [claimedRow()] });

    const summary = await processOutboxBatch({ client: stub.client });

    expect(stub.rpc).toHaveBeenCalledTimes(1);
    expect(stub.rpc).toHaveBeenCalledWith('claim_capacity_outbox_batch', {
      p_limit: 100,
      p_lease_seconds: 300,
    });
    // No app-side SELECT-then-UPDATE claim any more.
    expect(stub.queries.some((q) => firstMethod(q) === 'select')).toBe(false);
    expect(updatesOf(stub.queries).some((u) => u.payload.status === 'processing')).toBe(false);

    expect(emitHoldConfirmedMock).toHaveBeenCalledWith({ holdId: 'h1' });
    expect(updatesOf(stub.queries)).toEqual([
      {
        payload: { status: 'done', next_attempt_at: null, updated_at: NOW },
        id: 'evt-1',
        statusGuard: 'processing',
      },
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
        claimedRow({
          id: 'evt-2',
          event_type: 'capacity.assignment.sync',
          payload: { assignmentId: 'a1' },
        }),
      ],
    });

    const summary = await processOutboxBatch({ client: stub.client, limit: 7, leaseSeconds: 60 });

    expect(stub.rpc).toHaveBeenCalledWith('claim_capacity_outbox_batch', {
      p_limit: 7,
      p_lease_seconds: 60,
    });
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
      rows: [claimedRow({ id: 'evt-3', event_type: 'mystery.event' })],
    });

    const summary = await processOutboxBatch({ client: stub.client });

    expect(loggerMock.warn).toHaveBeenCalledWith(
      '[outbox] unknown event type',
      expect.objectContaining({ eventType: 'mystery.event', outboxId: 'evt-3' }),
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
        claimedRow({ id: 'evt-ok', payload: { holdId: 'good' } }),
        claimedRow({ id: 'evt-bad', payload: { holdId: 'bad' }, attempt_count: 1 }),
      ],
    });

    const summary = await processOutboxBatch({ client: stub.client });

    expect(summary).toEqual({ processed: 1, failed: 1, dead: 0, pending: 1 });
    const retry = updatesOf(stub.queries).find(
      (u) => u.id === 'evt-bad' && u.payload.status === 'pending',
    )!;
    // The claim counted attempt 1 -> 2^1 * 250ms = 500ms after the frozen clock.
    expect(retry).toEqual({
      payload: {
        status: 'pending',
        next_attempt_at: '2026-07-15T12:00:00.500Z',
        updated_at: NOW,
      },
      id: 'evt-bad',
      statusGuard: 'processing',
    });
    expect(recordObservabilityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'outbox.batch', severity: 'warning' }),
    );
  });

  it('@worker @contract retry backoff caps at 30 seconds', async () => {
    emitHoldConfirmedMock.mockRejectedValue(new Error('still down'));
    const stub = createProcessingClient({ rows: [claimedRow({ id: 'evt-8', attempt_count: 9 })] });

    await processOutboxBatch({ client: stub.client });

    const retry = updatesOf(stub.queries).find(
      (u) => u.id === 'evt-8' && u.payload.status === 'pending',
    )!;
    expect(retry.payload.next_attempt_at).toBe('2026-07-15T12:00:30.000Z');
  });

  it('@worker @contract the tenth attempt dead-letters the event', async () => {
    emitHoldConfirmedMock.mockRejectedValue(new Error('permanently broken'));
    const stub = createProcessingClient({
      rows: [claimedRow({ id: 'evt-dead', attempt_count: 10 })],
    });

    const summary = await processOutboxBatch({ client: stub.client });

    expect(summary).toEqual({ processed: 0, failed: 0, dead: 1, pending: 1 });
    expect(updatesOf(stub.queries).at(-1)).toMatchObject({
      payload: { status: 'dead', next_attempt_at: null },
      id: 'evt-dead',
      statusGuard: 'processing',
    });
  });

  it('@worker @contract a settle that matches no row (lease lost) is reported, not counted as processed', async () => {
    const stub = createProcessingClient({
      rows: [
        claimedRow({ id: 'evt-lost' }),
        claimedRow({ id: 'evt-kept', payload: { holdId: 'h2' } }),
      ],
      lostLeaseIds: ['evt-lost'],
    });

    const summary = await processOutboxBatch({ client: stub.client });

    expect(summary).toEqual({ processed: 1, failed: 0, dead: 0, pending: 1 });
    expect(loggerMock.warn).toHaveBeenCalledWith(
      '[outbox] lease lost before settle',
      expect.objectContaining({ outboxId: 'evt-lost' }),
    );
  });

  it('@worker @contract a claim failure is logged and reported, an empty queue returns zeros', async () => {
    const failing = createProcessingClient({ rows: null, claimError: { code: '57014' } });
    await expect(processOutboxBatch({ client: failing.client })).resolves.toEqual({
      processed: 0,
      failed: 0,
      dead: 0,
      pending: 0,
      error: 'CLAIM_FAILED',
    });
    expect(loggerMock.error).toHaveBeenCalledWith('[outbox] claim failed', { errorCode: '57014' });

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
    const stub = createProcessingClient({ rows: [claimedRow()] });

    await expect(processOutboxBatch({ client: stub.client })).resolves.toEqual({
      processed: 1,
      failed: 0,
      dead: 0,
      pending: 0,
    });
  });
});
