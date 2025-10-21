import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Tables } from '@/types/supabase';

process.env.BASE_URL = 'http://localhost:3000';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
process.env.FEATURE_SELECTOR_SCORING = 'true';
process.env.FEATURE_OPS_METRICS = 'true';
process.env.RESEND_FROM = 'ops@example.com';
process.env.RESEND_API_KEY = 'test-resend-key';

const emitSelectorDecision = vi.fn();

vi.mock('@/server/capacity/telemetry', async () => {
  const actual = await vi.importActual<typeof import('@/server/capacity/telemetry')>('@/server/capacity/telemetry');
  return {
    ...actual,
    emitSelectorDecision,
  };
});

let autoAssignTablesForDate: typeof import('@/server/capacity')['autoAssignTablesForDate'];

beforeAll(async () => {
  ({ autoAssignTablesForDate } = await import('@/server/capacity'));
});

beforeEach(() => {
  emitSelectorDecision.mockClear();
});

type TableRow = {
  id: string;
  table_number: string;
  capacity: number;
  min_party_size: number;
  max_party_size: number | null;
  section: string | null;
  category?: 'bar' | 'dining' | 'lounge' | 'patio' | 'private';
  seating_type?: 'standard' | 'sofa' | 'booth' | 'high_top';
  mobility?: 'movable' | 'fixed';
  zone_id?: string;
  status: string;
  active?: boolean;
  position?: Record<string, unknown> | null;
};

type BookingRow = {
  id: string;
  party_size: number;
  status: Tables<'bookings'>['status'];
  start_time: string | null;
  end_time: string | null;
  start_at: string | null;
  booking_date: string | null;
  seating_preference: string | null;
  booking_table_assignments: { table_id: string | null }[] | null;
};

type MockClientOptions = {
  tables: TableRow[];
  bookings: BookingRow[];
  adjacency?: { table_a: string; table_b: string }[];
};

type AssignmentLogEntry = {
  bookingId: string;
  tableIds: string[];
  window: string;
};

function createMockSupabaseClient(options: MockClientOptions) {
  const assignments: AssignmentLogEntry[] = [];
  const adjacencyRows = options.adjacency ?? [];
  const tableRows = options.tables.map((table) => ({
    category: 'dining' as const,
    seating_type: 'standard' as const,
    mobility: 'movable' as const,
    zone_id: 'zone-main',
    active: true,
    ...table,
  }));

  const client = {
    from(table: string) {
      if (table === 'table_inventory') {
        return {
          select() {
            return {
              eq() {
                return {
                  order() {
                    return Promise.resolve({ data: tableRows, error: null });
                  },
                };
              },
            };
          },
        };
      }

      if (table === 'table_adjacencies') {
        return {
          select() {
            return {
              in(column: string, ids: string[]) {
                if (column !== 'table_a') {
                  return Promise.resolve({ data: [], error: null });
                }
                const data = adjacencyRows.filter((row) => ids.includes(row.table_a));
                return Promise.resolve({ data, error: null });
              },
            };
          },
        };
      }

      if (table === 'bookings') {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      order() {
                        return Promise.resolve({ data: options.bookings, error: null });
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }

      if (table === 'restaurants') {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle() {
                    return Promise.resolve({ data: { timezone: 'Europe/London' }, error: null });
                  },
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
    rpc(name: string, args: Record<string, unknown>) {
      if (name === 'assign_tables_atomic') {
        assignments.push({
          bookingId: args.p_booking_id as string,
          tableIds: Array.isArray(args.p_table_ids) ? [...(args.p_table_ids as string[])] : [],
          window: args.p_window as string,
        });
        const data = (Array.isArray(args.p_table_ids) ? args.p_table_ids : []).map((tableId: string) => ({
          table_id: tableId,
          assignment_id: `${args.p_booking_id}-${tableId}`,
        }));
        return Promise.resolve({ data, error: null });
      }

      if (name === 'unassign_table_from_booking' || name === 'unassign_tables_atomic') {
        const bookingId = args.p_booking_id as string;
        const tableIdsParam = Array.isArray(args.p_table_ids)
          ? (args.p_table_ids as string[])
          : args.p_table_id
            ? [args.p_table_id as string]
            : [];

        tableIdsParam.forEach((target) => {
          assignments.forEach((entry) => {
            if (entry.bookingId === bookingId) {
              entry.tableIds = entry.tableIds.filter((tableId) => tableId !== target);
            }
          });
        });

        const data = tableIdsParam.map((tableId) => ({ table_id: tableId }));
        return Promise.resolve({ data, error: null });
      }

      return Promise.resolve({ data: null, error: null });
    },
  } as const;

  return { client, assignments };
}

describe('autoAssignTablesForDate', () => {
  it('assigns the smallest suitable table for a booking', async () => {
    const tables: TableRow[] = [
      {
        id: 'table-1',
        table_number: 'A1',
        capacity: 2,
        min_party_size: 1,
        max_party_size: 2,
        section: 'Window',
        seating_type: 'standard',
        status: 'available',
        position: null,
      },
      {
        id: 'table-2',
        table_number: 'B4',
        capacity: 4,
        min_party_size: 2,
        max_party_size: null,
        section: 'Main',
        seating_type: 'standard',
        status: 'available',
        position: null,
      },
    ];

    const bookings: BookingRow[] = [
      {
        id: 'booking-1',
        party_size: 2,
        status: 'pending_allocation',
        start_time: '18:00',
        end_time: null,
        start_at: '2025-11-01T18:00:00+00:00',
        booking_date: '2025-11-01',
        seating_preference: 'any',
        booking_table_assignments: [],
      },
      {
        id: 'booking-2',
        party_size: 4,
        status: 'confirmed',
        start_time: '19:00',
        end_time: '20:30',
        start_at: '2025-11-01T19:00:00+00:00',
        booking_date: '2025-11-01',
        seating_preference: 'any',
        booking_table_assignments: [
          {
            table_id: 'table-2',
          },
        ],
      },
    ];

    const { client, assignments } = createMockSupabaseClient({ tables, bookings });

    const result = await autoAssignTablesForDate({
      restaurantId: 'rest-1',
      date: '2025-11-01',
      client,
      assignedBy: 'user-1',
    });

    expect(result.assigned).toEqual([
      {
        bookingId: 'booking-1',
        tableIds: ['table-1'],
      },
    ]);
    expect(result.skipped).toEqual([]);
    expect(assignments).toEqual([
      expect.objectContaining({
        bookingId: 'booking-1',
        tableIds: ['table-1'],
      }),
    ]);
  });

  it('returns skipped entry when no tables are available', async () => {
    const tables: TableRow[] = [
      {
        id: 'table-1',
        table_number: 'D1',
        capacity: 2,
        min_party_size: 1,
        max_party_size: null,
        section: null,
        seating_type: 'standard',
        status: 'out_of_service',
        position: null,
      },
    ];

    const bookings: BookingRow[] = [
      {
        id: 'booking-20',
        party_size: 2,
        status: 'pending_allocation',
        start_time: '12:00',
        end_time: null,
        start_at: '2025-11-03T12:00:00+00:00',
        booking_date: '2025-11-03',
        seating_preference: 'any',
        booking_table_assignments: [],
      },
    ];

    const { client } = createMockSupabaseClient({ tables, bookings });

    const result = await autoAssignTablesForDate({
      restaurantId: 'rest-3',
      date: '2025-11-03',
      client,
      assignedBy: 'user-3',
    });

    expect(result.assigned).toEqual([]);
    expect(result.skipped).toEqual([
      {
        bookingId: 'booking-20',
        reason: expect.stringContaining('No suitable tables'),
      },
    ]);
  });
  it('prefers the best scoring single table and emits telemetry details', async () => {
    const tables: TableRow[] = [
      {
        id: 'table-2',
        table_number: 'T2',
        capacity: 2,
        min_party_size: 1,
        max_party_size: 2,
        section: 'Main',
        seating_type: 'standard',
        status: 'available',
        position: null,
      },
      {
        id: 'table-4',
        table_number: 'T4',
        capacity: 4,
        min_party_size: 2,
        max_party_size: 4,
        section: 'Main',
        seating_type: 'standard',
        status: 'available',
        position: null,
      },
      {
        id: 'table-6',
        table_number: 'T6',
        capacity: 6,
        min_party_size: 2,
        max_party_size: null,
        section: 'Main',
        seating_type: 'standard',
        status: 'available',
        position: null,
      },
      {
        id: 'table-merge-a',
        table_number: 'M1',
        capacity: 2,
        min_party_size: 1,
        max_party_size: null,
        section: 'Main',
        seating_type: 'standard',
        status: 'available',
        position: null,
        category: 'dining',
      },
      {
        id: 'table-merge-b',
        table_number: 'M2',
        capacity: 2,
        min_party_size: 1,
        max_party_size: null,
        section: 'Main',
        seating_type: 'standard',
        status: 'available',
        position: null,
        category: 'dining',
      },
    ];

    const bookings: BookingRow[] = [
      {
        id: 'booking-score-1',
        party_size: 4,
        status: 'pending_allocation',
        start_time: '19:00',
        end_time: null,
        start_at: '2025-11-05T19:00:00+00:00',
        booking_date: '2025-11-05',
        seating_preference: 'any',
        booking_table_assignments: [],
      },
    ];

    const { client, assignments } = createMockSupabaseClient({
      tables,
      bookings,
      adjacency: [
        { table_a: 'table-merge-a', table_b: 'table-merge-b' },
        { table_a: 'table-merge-b', table_b: 'table-merge-a' },
      ],
    });

    const result = await autoAssignTablesForDate({
      restaurantId: 'rest-score',
      date: '2025-11-05',
      client,
      assignedBy: 'user-score',
    });

    expect(result.assigned).toEqual([
      {
        bookingId: 'booking-score-1',
        tableIds: ['table-4'],
      },
    ]);
    expect(assignments).toEqual([
      expect.objectContaining({ bookingId: 'booking-score-1', tableIds: ['table-4'] }),
    ]);

    expect(emitSelectorDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 'booking-score-1',
        selected: expect.objectContaining({ tableIds: ['table-4'] }),
        candidates: expect.arrayContaining([
          expect.objectContaining({ tableIds: ['table-4'] }),
        ]),
        featureFlags: expect.objectContaining({ selectorScoring: true, opsMetrics: true }),
      }),
    );
  });

  it('emits skip telemetry with reason when no assignment is possible', async () => {
    const tables: TableRow[] = [
      {
        id: 'table-merge-a',
        table_number: 'M1',
        capacity: 3,
        min_party_size: 1,
        max_party_size: null,
        section: 'Main',
        seating_type: 'standard',
        status: 'available',
        position: null,
        category: 'dining',
      },
      {
        id: 'table-merge-b',
        table_number: 'M2',
        capacity: 3,
        min_party_size: 1,
        max_party_size: null,
        section: 'Main',
        seating_type: 'standard',
        status: 'available',
        position: null,
        category: 'dining',
      },
    ];

    const bookings: BookingRow[] = [
      {
        id: 'booking-skip-1',
        party_size: 6,
        status: 'pending_allocation',
        start_time: '20:00',
        end_time: null,
        start_at: '2025-11-06T20:00:00+00:00',
        booking_date: '2025-11-06',
        seating_preference: 'any',
        booking_table_assignments: [],
      },
    ];

    const { client } = createMockSupabaseClient({ tables, bookings });

    const result = await autoAssignTablesForDate({
      restaurantId: 'rest-skip',
      date: '2025-11-06',
      client,
      assignedBy: 'user-skip',
    });

    expect(result.assigned).toEqual([]);
    expect(result.skipped).toHaveLength(1);
    const skipReason = result.skipped[0]?.reason ?? '';
    expect(skipReason).toContain('capacity');

    expect(emitSelectorDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 'booking-skip-1',
        selected: null,
        skipReason,
      }),
    );
  });
});
