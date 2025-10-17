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
  seating_type: string;
  status: string;
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
};

type AssignmentLogEntry = {
  bookingId: string;
  tableId: string;
};

function createMockSupabaseClient(options: MockClientOptions) {
  const assignments: AssignmentLogEntry[] = [];

  const client = {
    from(table: string) {
      if (table === 'table_inventory') {
        return {
          select() {
            return {
              eq() {
                return {
                  order() {
                    return Promise.resolve({ data: options.tables, error: null });
                  },
                };
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
        seating_type: 'indoor',
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
        seating_type: 'indoor',
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

  it('combines tables when no single table can satisfy the party size', async () => {
    const tables: TableRow[] = [
      {
        id: 'table-1',
        table_number: 'C1',
        capacity: 3,
        min_party_size: 1,
        max_party_size: null,
        section: null,
        seating_type: 'indoor',
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
        seating_type: 'indoor',
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

    expect(result.assigned).toEqual([
      {
        bookingId: 'booking-10',
        tableIds: expect.arrayContaining(['table-1', 'table-2']),
      },
    ]);
    expect(assignments).toHaveLength(2);
    expect(assignments.map((entry) => entry.tableId).sort()).toEqual(['table-1', 'table-2']);
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
        seating_type: 'indoor',
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
});
