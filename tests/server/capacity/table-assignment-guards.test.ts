import { DateTime } from 'luxon';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/runtime-policy', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getHoldMinTtlSeconds: () => 5,
    isHoldStrictConflictsEnabled: () => true,
  };
});

vi.mock('@/server/capacity/telemetry', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    emitHoldCreated: vi.fn(),
  };
});

import { createTableHold, findHoldConflicts, HoldPersistenceError } from '@/server/capacity/holds';
import { synchronizeAssignments } from '@/server/capacity/table-assignment/assignment-sync';
import {
  clampQuoteHoldTtlSeconds,
  computeQuoteHoldExpiresAt,
} from '@/server/capacity/table-assignment/quote';
import {
  findMissingHoldMetadataFields,
  loadContextBookings,
} from '@/server/capacity/table-assignment/supabase';

import type { BookingRow, DbClient } from '@/server/capacity/table-assignment/supabase';

type QueryResult = {
  data?: unknown;
  error?: { code?: string; message: string } | null;
};

class StaticQuery {
  constructor(private readonly result: QueryResult) {}

  abortSignal() {
    return this;
  }

  delete() {
    return this;
  }

  eq() {
    return this;
  }

  gt() {
    return this;
  }

  filter() {
    return this;
  }

  in() {
    return this;
  }

  insert() {
    return this;
  }

  lt() {
    return this;
  }

  order() {
    return this;
  }

  select() {
    return this;
  }

  update() {
    return this;
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.result).then(onfulfilled, onrejected);
  }
}

class InsertHoldQuery {
  public payload: Record<string, unknown> | null = null;

  insert(payload: Record<string, unknown>) {
    this.payload = payload;
    return this;
  }

  select() {
    return this;
  }

  single() {
    const payload = this.payload ?? {};
    const members = payload.table_hold_members as
      | { data?: Array<{ table_id: string }> }
      | undefined;
    return Promise.resolve({
      data: {
        id: 'hold-1',
        booking_id: payload.booking_id ?? null,
        restaurant_id: payload.restaurant_id,
        zone_id: payload.zone_id,
        start_at: payload.start_at,
        end_at: payload.end_at,
        expires_at: payload.expires_at,
        created_by: payload.created_by ?? null,
        metadata: payload.metadata ?? null,
        table_hold_members: members?.data ?? [],
      },
      error: null,
    });
  }
}

type AssignmentClientOptions = {
  assignmentReloadRows?: unknown[];
  assignmentUpdateError?: { message: string };
  rpcError?: { code?: string; message: string };
};

function createAssignmentClient(options: AssignmentClientOptions = {}) {
  const updateCalls: Array<{ table: string; payload: unknown }> = [];
  const assignmentRows = [
    {
      id: 'assignment-1',
      table_id: 'table-1',
      start_at: '2026-05-16T10:00:00Z',
      end_at: '2026-05-16T11:00:00Z',
      merge_group_id: null,
    },
  ];

  class AssignmentQuery extends StaticQuery {
    private operation: 'select' | 'update' | 'delete' = 'select';
    private payload: unknown = null;

    constructor(private readonly table: string) {
      super({ data: [], error: null });
    }

    delete() {
      this.operation = 'delete';
      return this;
    }

    select() {
      this.operation = 'select';
      return this;
    }

    update(payload: unknown) {
      this.operation = 'update';
      this.payload = payload;
      updateCalls.push({ table: this.table, payload });
      return this;
    }

    then<TResult1 = QueryResult, TResult2 = never>(
      onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) {
      let result: QueryResult = { data: [], error: null };
      if (this.table === 'allocations' && this.operation === 'select') {
        result = { data: [], error: null };
      } else if (this.table === 'booking_table_assignments' && this.operation === 'select') {
        result = { data: options.assignmentReloadRows ?? assignmentRows, error: null };
      } else if (this.table === 'booking_table_assignments' && this.operation === 'update') {
        result = { data: null, error: options.assignmentUpdateError ?? null };
      } else if (this.operation === 'update' || this.operation === 'delete') {
        result = { data: null, error: null };
      }
      return Promise.resolve(result).then(onfulfilled, onrejected);
    }
  }

  return {
    client: {
      from: (table: string) => new AssignmentQuery(table),
      rpc: vi.fn().mockResolvedValue({ data: null, error: options.rpcError ?? null }),
    } as unknown as DbClient,
    updateCalls,
  };
}

const booking: BookingRow = {
  id: 'booking-1',
  restaurant_id: 'restaurant-1',
  booking_date: '2026-05-16',
  start_time: '12:00',
  end_time: '13:00',
  start_at: '2026-05-16T12:00:00Z',
  end_at: '2026-05-16T13:00:00Z',
  party_size: 2,
  status: 'pending',
  seating_preference: null,
  booking_type: null,
};

describe('table-assignment guardrails', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('computes temporary quote hold expiry from now and clamps excessive TTLs', () => {
    const now = DateTime.fromISO('2026-05-16T10:00:00.000Z', { zone: 'utc' });

    expect(computeQuoteHoldExpiresAt(180, now).toISO()).toBe('2026-05-16T10:03:00.000Z');
    expect(clampQuoteHoldTtlSeconds(9999)).toBe(600);
    expect(computeQuoteHoldExpiresAt(9999, now).toISO()).toBe('2026-05-16T10:10:00.000Z');
  });

  it('does not extend table-hold expiry to the future booking window end', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-16T10:00:00.000Z'));
    const insertQuery = new InsertHoldQuery();
    const client = {
      from: vi.fn((table: string) => {
        expect(table).toBe('table_holds');
        return insertQuery;
      }),
      rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
    };

    const hold = await createTableHold({
      bookingId: 'booking-1',
      restaurantId: 'restaurant-1',
      zoneId: 'zone-1',
      tableIds: ['table-1'],
      startAt: '2026-06-01T12:00:00.000Z',
      endAt: '2026-06-01T13:00:00.000Z',
      expiresAt: '2026-05-16T10:03:00.000Z',
      client: client as unknown as Parameters<typeof createTableHold>[0]['client'],
    });

    expect(hold.expiresAt).toBe('2026-05-16T10:03:00.000Z');
    expect(insertQuery.payload?.expires_at).toBe('2026-05-16T10:03:00.000Z');
  });

  it('does not report structural hold insert failures as table conflicts', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-16T10:00:00.000Z'));
    const client = {
      from: vi.fn(() => ({
        insert: () => ({
          select: () => ({
            single: () =>
              Promise.resolve({
                data: null,
                error: {
                  code: '23514',
                  message:
                    'new row for relation "table_holds" violates check constraint "th_times_consistent"',
                },
              }),
          }),
        }),
      })),
      rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
    };

    await expect(
      createTableHold({
        bookingId: 'booking-1',
        restaurantId: 'restaurant-1',
        zoneId: 'zone-1',
        tableIds: ['table-1'],
        startAt: '2026-06-01T12:00:00.000Z',
        endAt: '2026-06-01T13:00:00.000Z',
        expiresAt: '2026-05-16T10:03:00.000Z',
        client: client as unknown as Parameters<typeof createTableHold>[0]['client'],
      }),
    ).rejects.toBeInstanceOf(HoldPersistenceError);
  });

  it('fails closed when strict hold conflict session verification fails', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-16T10:00:00.000Z'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const insertQuery = new InsertHoldQuery();
    const client = {
      from: vi.fn(() => insertQuery),
      rpc: vi
        .fn()
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: false, error: null }),
    };

    await expect(
      createTableHold({
        bookingId: 'booking-1',
        restaurantId: 'restaurant-1',
        zoneId: 'zone-1',
        tableIds: ['table-1'],
        startAt: '2026-06-01T12:00:00.000Z',
        endAt: '2026-06-01T13:00:00.000Z',
        expiresAt: '2026-05-16T10:03:00.000Z',
        client: client as unknown as Parameters<typeof createTableHold>[0]['client'],
      }),
    ).rejects.toThrow(/Strict hold conflict enforcement not honored/);

    expect(client.from).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('fails closed when hold conflict evaluation cannot query strict windows', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const client = {
      from: vi.fn(
        () =>
          new StaticQuery({
            data: null,
            error: { code: 'PGRST200', message: 'table_hold_windows unavailable' },
          }),
      ),
      rpc: vi
        .fn()
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: true, error: null }),
    };

    await expect(
      findHoldConflicts({
        restaurantId: 'restaurant-1',
        tableIds: ['table-1'],
        startAt: '2026-06-01T12:00:00.000Z',
        endAt: '2026-06-01T13:00:00.000Z',
        client: client as unknown as Parameters<typeof findHoldConflicts>[0]['client'],
      }),
    ).rejects.toMatchObject({ code: 'PGRST200' });

    expect(client.from).toHaveBeenCalledWith('table_hold_windows');
    consoleError.mockRestore();
  });

  it('fails closed when context booking lookup errors', async () => {
    const client = {
      from: () => new StaticQuery({ data: null, error: { message: 'database timeout' } }),
    };

    await expect(
      loadContextBookings('restaurant-1', '2026-05-16', client as unknown as DbClient, undefined),
    ).rejects.toMatchObject({
      code: 'CONTEXT_BOOKINGS_LOOKUP_FAILED',
      status: 503,
    });
  });

  it('does not fallback after unexpected assignment sync RPC failures', async () => {
    const { client, updateCalls } = createAssignmentClient({
      rpcError: { code: 'XX000', message: 'database timeout' },
    });

    await expect(
      synchronizeAssignments({
        supabase: client,
        booking,
        tableIds: ['table-1'],
        idempotencyKey: null,
        assignments: [{ tableId: 'table-1', startAt: '2026-05-16T10:00:00Z' }],
        startIso: '2026-05-16T12:00:00',
        endIso: '2026-05-16T13:00:00',
      }),
    ).rejects.toThrow(/Failed to synchronize assignment windows via RPC/);

    expect(updateCalls).toHaveLength(0);
  });

  it('fails closed when assignment fallback writes error or reload stale windows', async () => {
    const missingRpc = {
      code: 'PGRST202',
      message: 'Could not find the function public.sync_confirmed_assignment_windows',
    };
    const failingFallback = createAssignmentClient({
      rpcError: missingRpc,
      assignmentUpdateError: { message: 'write failed' },
    });

    await expect(
      synchronizeAssignments({
        supabase: failingFallback.client,
        booking,
        tableIds: ['table-1'],
        idempotencyKey: null,
        assignments: [{ tableId: 'table-1', startAt: '2026-05-16T10:00:00Z' }],
        startIso: '2026-05-16T12:00:00',
        endIso: '2026-05-16T13:00:00',
      }),
    ).rejects.toThrow(/Failed to update assignment windows/);

    const staleReload = createAssignmentClient({ rpcError: missingRpc });
    await expect(
      synchronizeAssignments({
        supabase: staleReload.client,
        booking,
        tableIds: ['table-1'],
        idempotencyKey: null,
        assignments: [{ tableId: 'table-1', startAt: '2026-05-16T10:00:00Z' }],
        startIso: '2026-05-16T12:00:00',
        endIso: '2026-05-16T13:00:00',
      }),
    ).rejects.toThrow(/stale windows/);
  });

  it('allows non-adjacent manual hold metadata without an adjacency snapshot', () => {
    expect(
      findMissingHoldMetadataFields({
        metadata: {
          policyVersion: 'policy-1',
          requireAdjacency: false,
          selection: {
            tableIds: ['table-1'],
            summary: { tableCount: 1 },
            snapshot: null,
          },
        },
        table_hold_members: [{ table_id: 'table-1' }],
      } as never),
    ).toEqual([]);
  });

  it('still requires adjacency snapshots when adjacency was required', () => {
    expect(
      findMissingHoldMetadataFields({
        metadata: {
          policyVersion: 'policy-1',
          requireAdjacency: true,
          selection: {
            tableIds: ['table-1', 'table-2'],
            summary: { tableCount: 2 },
            snapshot: null,
          },
        },
        table_hold_members: [{ table_id: 'table-1' }, { table_id: 'table-2' }],
      } as never),
    ).toEqual(['metadata.selection.snapshot']);
  });
});
