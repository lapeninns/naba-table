import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const clearScarcityCacheMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/capacity/scarcity', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/capacity/scarcity')>();
  // Keep the real pure math (deriveTableType/computeScarcityScore) and only spy on
  // the cache invalidation side effect.
  return { ...actual, clearScarcityCache: clearScarcityCacheMock };
});

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

import { recomputeTableScarcityMetrics } from '@/server/jobs/table-scarcity';

const NOW_ISO = '2026-07-15T11:00:00.000Z';

type QueryCall = { method: string; args: unknown[] };
type RecordedQuery = { table: string; calls: QueryCall[] };

type Resolver = (query: RecordedQuery) => { data?: unknown; error?: unknown };

function createSupabaseStub(resolve: Resolver) {
  const queries: RecordedQuery[] = [];
  const from = vi.fn((table: string) => {
    const query: RecordedQuery = { table, calls: [] };
    queries.push(query);
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'in', 'upsert', 'delete']) {
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
  return { client: { from } as never, queries };
}

const firstMethod = (query: RecordedQuery) => query.calls[0]?.method;
const argsOf = (query: RecordedQuery, method: string) =>
  query.calls.find((call) => call.method === method)?.args;

function inventoryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'table-1',
    restaurant_id: 'rest-a',
    capacity: 2,
    category: 'booth',
    seating_type: 'standard',
    status: 'available',
    active: true,
    zone_id: 'zone-1',
    ...overrides,
  };
}

type StubOptions = {
  inventory?: unknown[];
  inventoryError?: unknown;
  upsertError?: (records: Array<Record<string, unknown>>) => unknown;
  existingByRestaurant?: Record<string, unknown[]>;
  existingError?: unknown;
  deleteError?: unknown;
};

function installClient(options: StubOptions) {
  return createSupabaseStub((query) => {
    if (query.table === 'table_inventory') {
      return { data: options.inventory ?? [], error: options.inventoryError ?? null };
    }
    if (query.table === 'table_scarcity_metrics') {
      const method = firstMethod(query);
      if (method === 'upsert') {
        const records = query.calls[0]!.args[0] as Array<Record<string, unknown>>;
        return { error: options.upsertError?.(records) ?? null };
      }
      if (method === 'select') {
        if (options.existingError) return { data: null, error: options.existingError };
        const restaurantId = argsOf(query, 'eq')?.[1] as string;
        return { data: options.existingByRestaurant?.[restaurantId] ?? [], error: null };
      }
      if (method === 'delete') {
        return { error: options.deleteError ?? null };
      }
    }
    throw new Error(`Unexpected query on ${query.table}`);
  });
}

describe('recomputeTableScarcityMetrics', () => {
  beforeEach(() => {
    getServiceSupabaseClientMock.mockReset();
    clearScarcityCacheMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('@worker @contract groups active tables per restaurant/type and upserts scores with the given timestamp', async () => {
    const stub = installClient({
      inventory: [
        inventoryRow({ id: 't1', capacity: 2, category: 'Booth', seating_type: 'Standard' }),
        inventoryRow({ id: 't2', capacity: 2, category: 'booth', seating_type: 'standard' }),
        inventoryRow({ id: 't3', capacity: 4, category: null, seating_type: null }),
        inventoryRow({ id: 't4', restaurant_id: 'rest-b', capacity: 6, category: 'patio', seating_type: 'outdoor' }),
      ],
    });

    const result = await recomputeTableScarcityMetrics({ client: stub.client, now: NOW_ISO });

    expect(result).toEqual({ restaurantsProcessed: 2, upserted: 3, deleted: 0 });

    const upserts = stub.queries.filter((q) => firstMethod(q) === 'upsert');
    expect(upserts).toHaveLength(2);
    // Category/seating are normalised case-insensitively, so t1+t2 share one type.
    expect(upserts[0]!.calls[0]!.args[0]).toEqual([
      {
        restaurant_id: 'rest-a',
        table_type: 'capacity:2|category:booth|seating:standard',
        scarcity_score: 0.5,
        computed_at: NOW_ISO,
      },
      {
        restaurant_id: 'rest-a',
        table_type: 'capacity:4|category:uncategorized|seating:standard',
        scarcity_score: 1,
        computed_at: NOW_ISO,
      },
    ]);
    expect(upserts[0]!.calls[0]!.args[1]).toEqual({ onConflict: 'restaurant_id,table_type' });
    expect(upserts[1]!.calls[0]!.args[0]).toEqual([
      {
        restaurant_id: 'rest-b',
        table_type: 'capacity:6|category:patio|seating:outdoor',
        scarcity_score: 1,
        computed_at: NOW_ISO,
      },
    ]);
    expect(clearScarcityCacheMock).toHaveBeenCalledTimes(1);
  });

  it('@worker @security scopes the inventory query to the requested restaurant only when asked', async () => {
    const scoped = installClient({ inventory: [] });
    await recomputeTableScarcityMetrics({ client: scoped.client, restaurantId: 'rest-a' });
    expect(argsOf(scoped.queries[0]!, 'eq')).toEqual(['restaurant_id', 'rest-a']);

    const sweep = installClient({ inventory: [] });
    await recomputeTableScarcityMetrics({ client: sweep.client });
    expect(argsOf(sweep.queries[0]!, 'eq')).toBeUndefined();
  });

  it('@worker @contract skips inactive, out-of-service and orphaned rows; an all-skipped sweep writes nothing', async () => {
    const stub = installClient({
      inventory: [
        inventoryRow({ id: 't1', active: false }),
        inventoryRow({ id: 't2', status: 'out_of_service' }),
        inventoryRow({ id: 't3', status: 'OUT_OF_SERVICE' }), // case-insensitive
        inventoryRow({ id: 't4', restaurant_id: null }),
      ],
    });

    const result = await recomputeTableScarcityMetrics({ client: stub.client });

    expect(result).toEqual({ restaurantsProcessed: 0, upserted: 0, deleted: 0 });
    expect(stub.queries).toHaveLength(1); // only the inventory read
    // Early return: the shared scarcity cache is NOT cleared on an empty sweep.
    expect(clearScarcityCacheMock).not.toHaveBeenCalled();
  });

  it('@worker @contract a null status counts as available and null capacity still yields a capacity:0 type', async () => {
    const stub = installClient({
      inventory: [inventoryRow({ id: 't1', status: null, capacity: null })],
    });

    const result = await recomputeTableScarcityMetrics({ client: stub.client, now: NOW_ISO });

    expect(result).toEqual({ restaurantsProcessed: 1, upserted: 1, deleted: 0 });
    const upsert = stub.queries.find((q) => firstMethod(q) === 'upsert')!;
    expect(upsert.calls[0]!.args[0]).toEqual([
      {
        restaurant_id: 'rest-a',
        table_type: 'capacity:0|category:booth|seating:standard',
        scarcity_score: 1,
        computed_at: NOW_ISO,
      },
    ]);
  });

  it('@worker @contract deletes stale table types that no longer exist in the inventory', async () => {
    const stub = installClient({
      inventory: [inventoryRow({ id: 't1' })],
      existingByRestaurant: {
        'rest-a': [
          { table_type: 'capacity:9|category:ghost|seating:standard' },
          { table_type: 'capacity:2|category:booth|seating:standard' },
        ],
      },
    });

    const result = await recomputeTableScarcityMetrics({ client: stub.client, now: NOW_ISO });

    expect(result).toEqual({ restaurantsProcessed: 1, upserted: 1, deleted: 1 });
    const deleteQuery = stub.queries.find((q) => firstMethod(q) === 'delete')!;
    expect(argsOf(deleteQuery, 'eq')).toEqual(['restaurant_id', 'rest-a']);
    expect(argsOf(deleteQuery, 'in')).toEqual([
      'table_type',
      ['capacity:9|category:ghost|seating:standard'],
    ]);
  });

  it('@worker @contract tolerates a missing metrics table on upsert (PGRST205/42P01) and skips that venue cleanup', async () => {
    const stub = installClient({
      inventory: [inventoryRow({ id: 't1' })],
      upsertError: () => ({ code: 'PGRST205', message: 'table not in schema cache' }),
    });

    const result = await recomputeTableScarcityMetrics({ client: stub.client });

    expect(result).toEqual({ restaurantsProcessed: 1, upserted: 0, deleted: 0 });
    // continue skips the stale-type cleanup for this restaurant entirely.
    expect(stub.queries.filter((q) => q.table === 'table_scarcity_metrics')).toHaveLength(1);
    expect(clearScarcityCacheMock).toHaveBeenCalledTimes(1);
  });

  it('@worker @contract tolerates a missing metrics table when listing existing types', async () => {
    const stub = installClient({
      inventory: [inventoryRow({ id: 't1' })],
      existingError: { code: '42P01', message: 'relation does not exist' },
    });

    const result = await recomputeTableScarcityMetrics({ client: stub.client });

    expect(result).toEqual({ restaurantsProcessed: 1, upserted: 1, deleted: 0 });
    expect(stub.queries.some((q) => firstMethod(q) === 'delete')).toBe(false);
  });

  it('@worker @contract propagates inventory load failures', async () => {
    const stub = installClient({ inventoryError: { message: 'boom' } });

    await expect(recomputeTableScarcityMetrics({ client: stub.client })).rejects.toThrow(
      '[table-scarcity] failed to load table inventory: boom',
    );
  });

  it('@worker @contract propagates real upsert failures with the restaurant id', async () => {
    const stub = installClient({
      inventory: [inventoryRow({ id: 't1' })],
      upsertError: () => ({ code: '23505', message: 'duplicate key' }),
    });

    await expect(recomputeTableScarcityMetrics({ client: stub.client })).rejects.toThrow(
      '[table-scarcity] upsert failed for restaurant rest-a: duplicate key',
    );
  });

  it('@worker @contract tolerates missing-table delete errors but throws on real delete failures', async () => {
    const tolerated = installClient({
      inventory: [inventoryRow({ id: 't1' })],
      existingByRestaurant: { 'rest-a': [{ table_type: 'stale-type' }] },
      deleteError: { code: 'PGRST205', message: 'gone' },
    });
    await expect(
      recomputeTableScarcityMetrics({ client: tolerated.client }),
    ).resolves.toEqual({ restaurantsProcessed: 1, upserted: 1, deleted: 0 });

    const failing = installClient({
      inventory: [inventoryRow({ id: 't1' })],
      existingByRestaurant: { 'rest-a': [{ table_type: 'stale-type' }] },
      deleteError: { code: 'XX000', message: 'permission denied' },
    });
    await expect(recomputeTableScarcityMetrics({ client: failing.client })).rejects.toThrow(
      '[table-scarcity] delete failed for restaurant rest-a: permission denied',
    );
  });

  it('@worker @contract falls back to the service client and the frozen clock when no params are given', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T12:00:00Z'));
    const stub = installClient({ inventory: [inventoryRow({ id: 't1' })] });
    getServiceSupabaseClientMock.mockReturnValue(stub.client);

    const result = await recomputeTableScarcityMetrics();

    expect(getServiceSupabaseClientMock).toHaveBeenCalledTimes(1);
    expect(result.upserted).toBe(1);
    const upsert = stub.queries.find((q) => firstMethod(q) === 'upsert')!;
    const records = upsert.calls[0]!.args[0] as Array<{ computed_at: string }>;
    expect(records[0]!.computed_at).toBe('2026-07-15T12:00:00.000Z');
  });
});
