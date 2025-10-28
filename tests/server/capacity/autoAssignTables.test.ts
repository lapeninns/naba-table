import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import * as featureFlags from '@/server/feature-flags';

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
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await vi.importActual<typeof import('@/server/capacity/telemetry')>('@/server/capacity/telemetry');
  return {
    ...actual,
    emitSelectorDecision,
  };
});

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
let autoAssignTablesForDate: typeof import('@/server/capacity')['autoAssignTablesForDate'];

beforeAll(async () => {
  ({ autoAssignTablesForDate } = await import('@/server/capacity'));
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
let allocatorFlagSpy: vi.SpyInstance<boolean, []>;

beforeEach(() => {
  vi.restoreAllMocks();
  allocatorFlagSpy = vi.spyOn(featureFlags, 'isAllocatorV2Enabled').mockReturnValue(true);
  emitSelectorDecision.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
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
  timezone?: string;
  holds?: Array<{
    id: string;
    restaurantId: string;
    tableIds: string[];
    startAt: string;
    endAt: string;
    expiresAt: string;
    zoneId?: string | null;
    bookingId?: string | null;
  }>;
};

type AssignmentLogEntry = {
  bookingId: string;
  tableIds: string[];
  startAt: string | null;
  endAt: string | null;
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
  const holdsRows =
    options.holds?.map((hold) => ({
      id: hold.id,
      booking_id: hold.bookingId ?? null,
      restaurant_id: hold.restaurantId,
      zone_id: hold.zoneId ?? 'zone-main',
      start_at: hold.startAt,
      end_at: hold.endAt,
      expires_at: hold.expiresAt,
      created_by: null,
      metadata: null,
      table_hold_members: hold.tableIds.map((tableId) => ({ table_id: tableId })),
    })) ?? [];

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

      if (table === 'table_holds') {
        const builder = {
          select() {
            return builder;
          },
          eq() {
            return builder;
          },
          gt() {
            return builder;
          },
          lt() {
            return builder;
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          then(onFulfilled: any, onRejected?: any) {
            return Promise.resolve({ data: holdsRows, error: null }).then(onFulfilled, onRejected);
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          catch(onRejected: any) {
            return Promise.resolve({ data: holdsRows, error: null }).catch(onRejected);
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          finally(onFinally: any) {
            return Promise.resolve({ data: holdsRows, error: null }).finally(onFinally);
          },
        };
        return builder;
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
                    return Promise.resolve({
                      data: { timezone: options.timezone ?? 'Europe/London' },
                      error: null,
                    });
                  },
                };
              },
            };
          },
        };
      }

      if (table === 'booking_table_assignments') {
        return {
          select() {
            return {
              eq() {
                return {
                  in(_: string, tableIds: string[]) {
                    const active = assignments[assignments.length - 1];
                    const rows = tableIds.map((tableId) => ({
                      table_id: tableId,
                      id: `${active?.bookingId ?? 'booking'}-${tableId}`,
                    }));
                    return Promise.resolve({ data: rows, error: null });
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
      if (name === 'assign_tables_atomic_v2') {
        assignments.push({
          bookingId: args.p_booking_id as string,
          tableIds: Array.isArray(args.p_table_ids) ? [...(args.p_table_ids as string[])] : [],
          startAt: typeof args.p_start_at === 'string' ? args.p_start_at : null,
          endAt: typeof args.p_end_at === 'string' ? args.p_end_at : null,
        });
        const data = (Array.isArray(args.p_table_ids) ? args.p_table_ids : []).map((tableId: string) => ({
          table_id: tableId,
          start_at: '2025-01-01T18:00:00.000Z',
          end_at: '2025-01-01T20:00:00.000Z',
          merge_group_id: null,
        }));
        return Promise.resolve({ data, error: null });
      }

      if (name === 'unassign_tables_atomic') {
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
  it('uses the restaurant timezone when generating assignment window', async () => {
    const tables: TableRow[] = [
      {
        id: 'table-nyc-1',
        table_number: 'NYC-1',
        capacity: 2,
        min_party_size: 1,
        max_party_size: 2,
        section: 'Main',
        seating_type: 'standard',
        status: 'available',
        position: null,
      },
    ];

    const bookings: BookingRow[] = [
      {
        id: 'booking-nyc-1',
        party_size: 2,
        status: 'pending_allocation',
        start_time: '18:00',
        end_time: null,
        start_at: '2025-07-05T22:00:00+00:00',
        booking_date: '2025-07-05',
        seating_preference: 'window',
        booking_table_assignments: [],
      },
    ];

    const { client, assignments } = createMockSupabaseClient({
      tables,
      bookings,
      timezone: 'America/New_York',
    });

    await autoAssignTablesForDate({
      restaurantId: 'rest-nyc-1',
      date: '2025-07-05',
      client,
      assignedBy: 'user-nyc',
    });

    expect(assignments).toEqual([
      expect.objectContaining({
        bookingId: 'booking-nyc-1',
        tableIds: ['table-nyc-1'],
        startAt: '2025-07-05T22:00:00Z',
        endAt: '2025-07-05T23:05:00Z',
      }),
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
        featureFlags: expect.objectContaining({ selectorScoring: true }),
      }),
    );
  });

  it('emits skip telemetry with reason when no assignment is possible', async () => {
    const tables: TableRow[] = [
      {
        id: 'table-merge-a',
        table_number: 'M1',
        capacity: 4,
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
        party_size: 10,
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
    expect(skipReason).toMatch(/capacity/i);

    expect(emitSelectorDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 'booking-skip-1',
        selected: null,
        skipReason,
      }),
    );
  });

  it('assigns merged tables when combination planner flag is disabled', async () => {
    vi.spyOn(featureFlags, 'isCombinationPlannerEnabled').mockReturnValue(false);

    const tables: TableRow[] = [
      {
        id: 'table-merge-1',
        table_number: 'M1',
        capacity: 3,
        min_party_size: 1,
        max_party_size: null,
        section: 'Garden',
        seating_type: 'standard',
        status: 'available',
        position: null,
      },
      {
        id: 'table-merge-2',
        table_number: 'M2',
        capacity: 4,
        min_party_size: 1,
        max_party_size: null,
        section: 'Garden',
        seating_type: 'standard',
        status: 'available',
        position: null,
      },
    ];

    const bookings: BookingRow[] = [
      {
        id: 'booking-merge-required',
        party_size: 6,
        status: 'pending_allocation',
        start_time: '19:30',
        end_time: null,
        start_at: '2025-11-07T19:30:00+00:00',
        booking_date: '2025-11-07',
        seating_preference: 'any',
        booking_table_assignments: [],
      },
    ];

    const { client, assignments } = createMockSupabaseClient({ tables, bookings });

    const result = await autoAssignTablesForDate({
      restaurantId: 'rest-merge',
      date: '2025-11-07',
      client,
      assignedBy: 'ops-user',
    });

    expect(result.assigned).toEqual([
      {
        bookingId: 'booking-merge-required',
        tableIds: expect.arrayContaining(['table-merge-1', 'table-merge-2']),
      },
    ]);
    expect(result.skipped).toEqual([]);
    expect(assignments).toEqual([
      expect.objectContaining({
        bookingId: 'booking-merge-required',
        tableIds: expect.arrayContaining(['table-merge-1', 'table-merge-2']),
      }),
    ]);
  });

  it('skips bookings whose buffered window overruns the service boundary', async () => {
    const tables: TableRow[] = [
      {
        id: 'table-overrun-1',
        table_number: 'L1',
        capacity: 4,
        min_party_size: 2,
        max_party_size: 4,
        section: 'Main',
        seating_type: 'standard',
        status: 'available',
        position: null,
      },
    ];

    const bookings: BookingRow[] = [
      {
        id: 'booking-overrun',
        party_size: 4,
        status: 'pending_allocation',
        start_time: '14:00',
        end_time: null,
        start_at: '2025-11-07T14:00:00+00:00',
        booking_date: '2025-11-07',
        seating_preference: 'any',
        booking_table_assignments: [],
      },
    ];

    const { client } = createMockSupabaseClient({ tables, bookings });

    const result = await autoAssignTablesForDate({
      restaurantId: 'rest-overrun',
      date: '2025-11-07',
      client,
      assignedBy: 'auto',
    });

    expect(result.assigned).toEqual([]);
    expect(result.skipped).toEqual([
      {
        bookingId: 'booking-overrun',
        reason: expect.stringContaining('overrun'),
      },
    ]);

    expect(emitSelectorDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 'booking-overrun',
        selected: null,
        skipReason: expect.stringContaining('overrun'),
      }),
    );
  });

  it('avoids tables with conflicting assignments and selects an alternative plan', async () => {
    const tables: TableRow[] = [
      {
        id: 'table-conflict-1',
        table_number: 'C1',
        capacity: 2,
        min_party_size: 1,
        max_party_size: 2,
        section: 'Main',
        seating_type: 'standard',
        status: 'available',
        position: null,
      },
      {
        id: 'table-conflict-2',
        table_number: 'C2',
        capacity: 4,
        min_party_size: 2,
        max_party_size: 4,
        section: 'Main',
        seating_type: 'standard',
        status: 'available',
        position: null,
      },
    ];

    const bookings: BookingRow[] = [
      {
        id: 'booking-conflict-target',
        party_size: 2,
        status: 'pending_allocation',
        start_time: '18:00',
        end_time: null,
        start_at: '2025-11-07T18:00:00+00:00',
        booking_date: '2025-11-07',
        seating_preference: 'any',
        booking_table_assignments: [],
      },
      {
        id: 'booking-conflict-existing',
        party_size: 2,
        status: 'confirmed',
        start_time: '18:00',
        end_time: '19:30',
        start_at: '2025-11-07T18:00:00+00:00',
        booking_date: '2025-11-07',
        seating_preference: 'any',
        booking_table_assignments: [
          {
            table_id: 'table-conflict-1',
          },
        ],
      },
    ];

    const { client, assignments } = createMockSupabaseClient({
      tables,
      bookings,
    });

    const result = await autoAssignTablesForDate({
      restaurantId: 'rest-conflict',
      date: '2025-11-07',
      client,
      assignedBy: 'auto',
    });

    expect(result.assigned).toEqual([
      {
        bookingId: 'booking-conflict-target',
        tableIds: ['table-conflict-2'],
      },
    ]);
    expect(result.skipped).toEqual([]);
    expect(assignments).toEqual([
      expect.objectContaining({
        bookingId: 'booking-conflict-target',
        tableIds: ['table-conflict-2'],
      }),
    ]);
  });

  it('skips bookings when every plan conflicts with holds', async () => {
    const tables: TableRow[] = [
      {
        id: 'table-hold-1',
        table_number: 'H1',
        capacity: 4,
        min_party_size: 1,
        max_party_size: 4,
        section: 'Main',
        seating_type: 'standard',
        status: 'available',
        position: null,
      },
    ];

    const bookings: BookingRow[] = [
      {
        id: 'booking-hold-target',
        party_size: 4,
        status: 'pending_allocation',
        start_time: '19:00',
        end_time: null,
        start_at: '2025-11-08T19:00:00+00:00',
        booking_date: '2025-11-08',
        seating_preference: 'any',
        booking_table_assignments: [],
      },
    ];

    const holds = [
      {
        id: 'hold-1',
        restaurantId: 'rest-hold',
        tableIds: ['table-hold-1'],
        startAt: '2025-11-08T19:00:00Z',
        endAt: '2025-11-08T20:30:00Z',
        expiresAt: '2025-11-08T21:00:00Z',
      },
    ];

    const { client, assignments } = createMockSupabaseClient({
      tables,
      bookings,
      holds,
    });

    const result = await autoAssignTablesForDate({
      restaurantId: 'rest-hold',
      date: '2025-11-08',
      client,
      assignedBy: 'auto',
    });

    expect(result.assigned).toEqual([]);
    expect(result.skipped).toEqual([
      expect.objectContaining({
        bookingId: 'booking-hold-target',
        reason: expect.stringContaining('Conflicts with existing'),
      }),
    ]);
    expect(assignments).toEqual([]);
  });
});
