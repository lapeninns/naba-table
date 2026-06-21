import { describe, expect, it, vi } from 'vitest';

import { clearBookingTableAssignments } from '@/server/bookings';

type QueryResult = { data?: unknown; error: unknown };

class QueryBuilder {
  constructor(private readonly resolve: () => QueryResult) {}

  select() {
    return this;
  }

  update() {
    return this;
  }

  delete() {
    return this;
  }

  eq() {
    return this;
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.resolve()).then(onfulfilled, onrejected);
  }
}

function makeClient(
  results: Record<string, QueryResult | QueryResult[]>,
  rpcError: unknown = null,
) {
  const queues = new Map(
    Object.entries(results).map(([table, configured]) => [
      table,
      Array.isArray(configured) ? [...configured] : [configured],
    ]),
  );

  return {
    from: vi.fn((table: string) => {
      const queue = queues.get(table) ?? [{ data: null, error: null }];
      return new QueryBuilder(() => queue.shift() ?? { data: null, error: null });
    }),
    rpc: vi.fn(async () => ({ data: null, error: rpcError })),
  };
}

describe('clearBookingTableAssignments', () => {
  it('throws when zone cleanup fails after table release', async () => {
    const client = makeClient({
      booking_table_assignments: { data: [{ table_id: 'table-1' }], error: null },
      bookings: { data: null, error: new Error('zone update failed') },
      booking_assignment_idempotency: { data: null, error: null },
    });

    await expect(clearBookingTableAssignments(client as never, 'booking-1')).rejects.toThrow(
      /zone update failed/,
    );
    expect(client.rpc).toHaveBeenCalledWith('unassign_tables_atomic', {
      p_booking_id: 'booking-1',
      p_table_ids: ['table-1'],
    });
  });

  it('throws when the atomic release and fallback delete both fail', async () => {
    const client = makeClient(
      {
        booking_table_assignments: [
          { data: [{ table_id: 'table-1' }], error: null },
          { data: null, error: new Error('fallback delete failed') },
        ],
        bookings: { data: null, error: null },
        booking_assignment_idempotency: { data: null, error: null },
      },
      new Error('rpc failed'),
    );

    await expect(clearBookingTableAssignments(client as never, 'booking-1')).rejects.toThrow(
      /fallback delete failed/,
    );
  });
});
