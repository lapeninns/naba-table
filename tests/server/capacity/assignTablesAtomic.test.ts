import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.BASE_URL = 'http://localhost:3000';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

type AssignTableFn = typeof import('@/server/capacity/tables')['assignTableToBooking'];
type UnassignTableFn = typeof import('@/server/capacity/tables')['unassignTableFromBooking'];

let assignTableToBooking: AssignTableFn;
let unassignTableFromBooking: UnassignTableFn;

beforeAll(async () => {
  ({ assignTableToBooking, unassignTableFromBooking } = await import('@/server/capacity/tables'));
});

describe('assignTableToBooking (atomic wrapper)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('invokes assign_tables_atomic_v2 for requested table', async () => {
    const bookingRow = {
      id: 'booking-1',
      restaurant_id: 'restaurant-1',
      booking_date: '2025-01-01',
      start_time: '18:00',
      end_time: '20:00',
      start_at: '2025-01-01T18:00:00.000Z',
      end_at: '2025-01-01T20:00:00.000Z',
      restaurants: { timezone: 'UTC' },
    };

    const maybeSingle = vi.fn().mockResolvedValue({ data: bookingRow, error: null });

    const assignmentsResult = {
      data: [
        {
          table_id: 'table-1',
          id: 'assignment-1',
        },
      ],
      error: null,
    };

    const inFn = vi.fn().mockResolvedValue(assignmentsResult);
    const eqAssignments = vi.fn().mockReturnValue({ in: inFn });
    const selectAssignments = vi.fn().mockReturnValue({ eq: eqAssignments });

    const selectBookings = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) });

    const from = vi.fn((table: string) => {
      if (table === 'bookings') {
        return { select: selectBookings };
      }
      if (table === 'booking_table_assignments') {
        return { select: selectAssignments };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          table_id: 'table-1',
          start_at: '2025-01-01T18:00:00.000Z',
          end_at: '2025-01-01T20:00:00.000Z',
          merge_group_id: null,
        },
      ],
      error: null,
    });

    const client = {
      from,
      rpc,
    } as unknown as Parameters<AssignTableFn>[3];

    const result = await assignTableToBooking('booking-1', 'table-1', 'user-1', client, {
      idempotencyKey: 'test-key',
    });

    expect(from).toHaveBeenCalledWith('booking_table_assignments');
    expect(rpc).toHaveBeenCalledWith('assign_tables_atomic_v2', {
      p_booking_id: 'booking-1',
      p_table_ids: ['table-1'],
      p_idempotency_key: 'test-key',
      p_require_adjacency: false,
      p_assigned_by: 'user-1',
    });
    expect(result).toBe('assignment-1');
    expect(selectAssignments).toHaveBeenCalledWith('table_id, id');
    expect(eqAssignments).toHaveBeenCalledWith('booking_id', 'booking-1');
    expect(inFn).toHaveBeenCalledWith('table_id', ['table-1']);
  });

  it('surface helpful error when assign_tables_atomic_v2 RPC is missing', async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: '42883',
          message: 'function assign_tables_atomic_v2(uuid, uuid[]) does not exist',
          details: null,
          hint: null,
        },
      }),
      from: vi.fn(),
    } as unknown as Parameters<AssignTableFn>[3];

    await expect(
      assignTableToBooking('booking-1', 'table-1', 'user-1', client),
    ).rejects.toThrow(/assign_tables_atomic_v2 RPC is not available/);
  });
});

describe('unassignTableFromBooking (atomic wrapper)', () => {
  it('invokes unassign_tables_atomic', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          table_id: 'table-1',
        },
      ],
      error: null,
    });

    const client = {
      rpc,
    } as unknown as Parameters<UnassignTableFn>[2];

    const result = await unassignTableFromBooking('booking-1', 'table-1', client);

    expect(rpc).toHaveBeenCalledWith('unassign_tables_atomic', {
      p_booking_id: 'booking-1',
      p_table_ids: ['table-1'],
    });
    expect(result).toBe(true);
  });
});
