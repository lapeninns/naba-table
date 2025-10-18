import { beforeAll, describe, expect, it } from 'vitest';

import type { Tables } from '@/types/supabase';

process.env.BASE_URL = 'http://localhost:3000';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

let autoAssignTablesForDate: typeof import('@/server/capacity')['autoAssignTablesForDate'];

beforeAll(async () => {
  ({ autoAssignTablesForDate } = await import('@/server/capacity'));
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
  tableId: string;
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
      if (name === 'assign_table_to_booking') {
        assignments.push({
          bookingId: args.p_booking_id as string,
          tableId: args.p_table_id as string,
        });
        return Promise.resolve({ data: args.p_table_id, error: null });
      }

      if (name === 'unassign_table_from_booking') {
        const target = args.p_table_id as string;
        const bookingId = args.p_booking_id as string;
        const index = assignments.findIndex((entry) => entry.bookingId === bookingId && entry.tableId === target);
        if (index >= 0) {
          assignments.splice(index, 1);
        }
        return Promise.resolve({ data: true, error: null });
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
      { bookingId: 'booking-1', tableId: 'table-1' },
    ]);
  });

  it('skips combining tables when the available mix does not match allowed merges', async () => {
    const tables: TableRow[] = [
      {
        id: 'table-1',
        table_number: 'C1',
        capacity: 3,
        min_party_size: 1,
        max_party_size: null,
        section: null,
        seating_type: 'standard',
        status: 'available',
        position: null,
      },
      {
        id: 'table-2',
        table_number: 'C2',
        capacity: 4,
        min_party_size: 1,
        max_party_size: null,
        section: null,
        seating_type: 'standard',
        status: 'available',
        position: null,
      },
    ];

    const bookings: BookingRow[] = [
      {
        id: 'booking-10',
        party_size: 6,
        status: 'pending_allocation',
        start_time: '17:30',
        end_time: null,
        start_at: '2025-11-02T17:30:00+00:00',
        booking_date: '2025-11-02',
        seating_preference: 'any',
        booking_table_assignments: [],
      },
    ];

    const { client, assignments } = createMockSupabaseClient({ tables, bookings });

    const result = await autoAssignTablesForDate({
      restaurantId: 'rest-2',
      date: '2025-11-02',
      client,
      assignedBy: 'user-2',
    });

    expect(result.assigned).toEqual([]);
    expect(result.skipped).toEqual([
      {
        bookingId: 'booking-10',
        reason: expect.stringContaining('2+4'),
      },
    ]);
    expect(assignments).toHaveLength(0);
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
  it('merges a 2-top and 4-top for a party of six when no single table fits', async () => {
  const tables: TableRow[] = [
    {
      id: 'table-2-1',
      table_number: 'T2-1',
      capacity: 2,
      min_party_size: 1,
      max_party_size: 2,
      section: 'Main',
      seating_type: 'standard',
      status: 'available',
      position: null,
    },
    {
      id: 'table-4-1',
      table_number: 'T4-1',
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
      id: 'booking-merge-6',
      party_size: 6,
      status: 'pending_allocation',
      start_time: '12:30',
      end_time: null,
      start_at: '2025-11-01T12:30:00+00:00',
      booking_date: '2025-11-01',
      seating_preference: 'any',
      booking_table_assignments: [],
    },
  ];

  const { client, assignments } = createMockSupabaseClient({
    tables,
    bookings,
    adjacency: [
      { table_a: 'table-2-1', table_b: 'table-4-1' },
      { table_a: 'table-4-1', table_b: 'table-2-1' },
    ],
  });

  const result = await autoAssignTablesForDate({
    restaurantId: 'rest-merge',
    date: '2025-11-01',
    client,
    assignedBy: 'user-merge',
  });

  expect(result.assigned).toEqual([
    {
      bookingId: 'booking-merge-6',
      tableIds: ['table-2-1', 'table-4-1'],
    },
  ]);

  expect(assignments).toEqual([
    { bookingId: 'booking-merge-6', tableId: 'table-2-1' },
    { bookingId: 'booking-merge-6', tableId: 'table-4-1' },
  ]);
  });

  it('merges two 4-top tables for a party of eight when available', async () => {
  const tables: TableRow[] = [
    {
      id: 'table-4-1',
      table_number: 'T4-1',
      capacity: 4,
      min_party_size: 2,
      max_party_size: 4,
      section: 'Main',
      seating_type: 'standard',
      status: 'available',
      position: null,
    },
    {
      id: 'table-4-2',
      table_number: 'T4-2',
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
      id: 'booking-merge-8',
      party_size: 8,
      status: 'pending_allocation',
      start_time: '19:00',
      end_time: null,
      start_at: '2025-11-01T19:00:00+00:00',
      booking_date: '2025-11-01',
      seating_preference: 'any',
      booking_table_assignments: [],
    },
  ];

  const { client, assignments } = createMockSupabaseClient({
    tables,
    bookings,
    adjacency: [
      { table_a: 'table-4-1', table_b: 'table-4-2' },
      { table_a: 'table-4-2', table_b: 'table-4-1' },
    ],
  });

  const result = await autoAssignTablesForDate({
    restaurantId: 'rest-merge',
    date: '2025-11-01',
    client,
    assignedBy: 'user-merge',
  });

  expect(result.assigned).toEqual([
    {
      bookingId: 'booking-merge-8',
      tableIds: ['table-4-1', 'table-4-2'],
    },
  ]);

  expect(assignments).toEqual([
    { bookingId: 'booking-merge-8', tableId: 'table-4-1' },
    { bookingId: 'booking-merge-8', tableId: 'table-4-2' },
  ]);
  });

  it('skips assignment when merge requirements cannot be met', async () => {
  const tables: TableRow[] = [
    {
      id: 'table-4-1',
      table_number: 'T4-1',
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
      id: 'booking-merge-fail',
      party_size: 7,
      status: 'pending_allocation',
      start_time: '17:30',
      end_time: null,
      start_at: '2025-11-01T17:30:00+00:00',
      booking_date: '2025-11-01',
      seating_preference: 'any',
      booking_table_assignments: [],
    },
  ];

  const { client } = createMockSupabaseClient({ tables, bookings });

  const result = await autoAssignTablesForDate({
    restaurantId: 'rest-merge',
    date: '2025-11-01',
    client,
    assignedBy: 'user-merge',
  });

  expect(result.assigned).toEqual([]);
  expect(result.skipped).toHaveLength(1);
  expect(result.skipped[0]).toMatchObject({
    bookingId: 'booking-merge-fail',
  });
  expect(result.skipped[0]?.reason ?? '').toContain('4-top');
  });
});
