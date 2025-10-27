import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.BASE_URL = 'http://localhost:3000';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

type AssignTableFn = typeof import('@/server/capacity/tables')['assignTableToBooking'];
type UnassignTableFn = typeof import('@/server/capacity/tables')['unassignTableFromBooking'];
type TablesInternal = typeof import('@/server/capacity/tables')['__internal'];

let assignTableToBooking: AssignTableFn;
let unassignTableFromBooking: UnassignTableFn;
let tablesInternal: TablesInternal;

beforeAll(async () => {
  const tablesModule = await import('@/server/capacity/tables');
  ({ assignTableToBooking, unassignTableFromBooking } = tablesModule);
  tablesInternal = tablesModule.__internal;
});

type UpdateCall<TPayload> = {
  payload: TPayload;
  filters: Array<{ column: string; value: unknown }>;
};

function createUpdateRecorder<TPayload>(target: UpdateCall<TPayload>[]) {
  return {
    update(payload: TPayload) {
      const call: UpdateCall<TPayload> = { payload, filters: [] };
      target.push(call);
      const builder = {
        eq(column: string, value: unknown) {
          call.filters.push({ column, value });
          return builder;
        },
        in(column: string, value: unknown) {
          call.filters.push({ column, value });
          return Promise.resolve({ data: null, error: null });
        },
        then(resolve: (value: { data: null; error: null }) => void) {
          resolve({ data: null, error: null });
        },
      };
      return builder;
    },
  };
}

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
      party_size: 2,
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
    const assignmentUpdateCalls: UpdateCall<{ start_at: string; end_at: string }>[] = [];
    const assignmentUpdateRecorder = createUpdateRecorder(assignmentUpdateCalls);

    const selectBookings = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) });

    const from = vi.fn((table: string) => {
      if (table === 'bookings') {
        return { select: selectBookings };
      }
      if (table === 'booking_table_assignments') {
        return {
          select: selectAssignments,
          update: assignmentUpdateRecorder.update,
        };
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

    const expectedWindow = tablesInternal.computeBookingWindow({
      startISO: bookingRow.start_at,
      bookingDate: bookingRow.booking_date,
      startTime: bookingRow.start_time,
      partySize: bookingRow.party_size,
    });
    const expectedStart = expectedWindow.block.start.toUTC().toISO({ suppressMilliseconds: true });
    const expectedEnd = expectedWindow.block.end.toUTC().toISO({ suppressMilliseconds: true });

    expect(from).toHaveBeenCalledWith('booking_table_assignments');
    expect(rpc).toHaveBeenCalledWith('assign_tables_atomic_v2', {
      p_booking_id: 'booking-1',
      p_table_ids: ['table-1'],
      p_idempotency_key: 'test-key',
      p_require_adjacency: false,
      p_assigned_by: 'user-1',
      p_start_at: expectedStart,
      p_end_at: expectedEnd,
    });
    expect(result).toBe('assignment-1');
    expect(assignmentUpdateCalls).toHaveLength(1);
    expect(assignmentUpdateCalls[0]?.payload).toEqual({ start_at: expectedStart, end_at: expectedEnd });
    expect(selectAssignments).toHaveBeenCalledWith('table_id, id');
    expect(eqAssignments).toHaveBeenCalledWith('booking_id', 'booking-1');
    expect(inFn).toHaveBeenCalledWith('table_id', ['table-1']);
  });

  it('surface helpful error when assign_tables_atomic_v2 RPC is missing', async () => {
    const bookingRow = {
      id: 'booking-1',
      restaurant_id: 'restaurant-1',
      booking_date: '2025-01-01',
      start_time: '18:00',
      end_time: '20:00',
      start_at: '2025-01-01T18:00:00.000Z',
      end_at: '2025-01-01T20:00:00.000Z',
      party_size: 2,
      restaurants: { timezone: 'UTC' },
    };

    const maybeSingle = vi.fn().mockResolvedValue({ data: bookingRow, error: null });
    const selectBookings = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) });

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
      from: vi.fn((table: string) => {
        if (table === 'bookings') {
          return { select: selectBookings };
        }
        return { select: vi.fn() } as any;
      }),
    } as unknown as Parameters<AssignTableFn>[3];

    await expect(
      assignTableToBooking('booking-1', 'table-1', 'user-1', client),
    ).rejects.toThrow(/assign_tables_atomic_v2 RPC is not available/);
  });

  it('clamps allocation windows when booking duration is excessive', async () => {
    const bookingRow = {
      id: 'booking-1',
      restaurant_id: 'restaurant-1',
      booking_date: '2025-01-01',
      start_time: '18:00',
      end_time: '23:00',
      start_at: '2025-01-01T18:00:00.000Z',
      end_at: '2025-01-01T23:00:00.000Z',
      party_size: 4,
      restaurants: { timezone: 'Europe/London' },
    };

    const maybeSingle = vi.fn().mockResolvedValue({ data: bookingRow, error: null });
    const selectBookings = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) });

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

    const allocationUpdateCalls: UpdateCall<{ window: string }>[] = [];
    const ledgerUpdateCalls: UpdateCall<{ assignment_window: string; merge_group_allocation_id: string | null }>[] = [];
    const assignmentUpdateCalls: UpdateCall<{ start_at: string; end_at: string }>[] = [];
    const assignmentUpdateRecorder = createUpdateRecorder(assignmentUpdateCalls);
    const assignmentUpdateCalls: UpdateCall<{ start_at: string; end_at: string }>[] = [];
    const assignmentUpdateRecorder = createUpdateRecorder(assignmentUpdateCalls);

    const from = vi.fn((table: string) => {
      if (table === 'bookings') {
        return { select: selectBookings };
      }
      if (table === 'booking_table_assignments') {
        return {
          select: selectAssignments,
          update: assignmentUpdateRecorder.update,
        };
      }
      if (table === 'allocations') {
        return createUpdateRecorder(allocationUpdateCalls);
      }
      if (table === 'booking_assignment_idempotency') {
        return createUpdateRecorder(ledgerUpdateCalls);
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          table_id: 'table-1',
          start_at: '2025-01-01T18:00:00.000Z',
          end_at: '2025-01-01T23:00:00.000Z',
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
      idempotencyKey: 'clamp-key',
    });

    expect(result).toBe('assignment-1');
    const clampWindow = tablesInternal.computeBookingWindow({
      startISO: bookingRow.start_at,
      bookingDate: bookingRow.booking_date,
      startTime: bookingRow.start_time,
      partySize: bookingRow.party_size,
    });
    const clampStart = clampWindow.block.start.toUTC().toISO({ suppressMilliseconds: true });
    const clampEnd = clampWindow.block.end.toUTC().toISO({ suppressMilliseconds: true });
    expect(assignmentUpdateCalls).toHaveLength(1);
    expect(assignmentUpdateCalls[0]?.payload).toEqual({ start_at: clampStart, end_at: clampEnd });
    expect(allocationUpdateCalls).toHaveLength(1);
    expect(allocationUpdateCalls[0]?.payload).toEqual({ window: '[2025-01-01T18:00:00Z,2025-01-01T19:20:00Z)' });
    expect(ledgerUpdateCalls).toHaveLength(1);
    expect(ledgerUpdateCalls[0]?.payload).toEqual({
      assignment_window: '[2025-01-01T18:00:00Z,2025-01-01T19:20:00Z)',
      merge_group_allocation_id: null,
    });
  });

  it('allows reassignment of the same table outside the earlier booking window', async () => {
    const bookings = new Map([
      [
        'booking-early',
        {
          id: 'booking-early',
          restaurant_id: 'restaurant-1',
          booking_date: '2025-01-01',
          start_time: '18:00',
          end_time: '23:00',
          start_at: '2025-01-01T18:00:00.000Z',
          end_at: '2025-01-01T23:00:00.000Z',
          party_size: 4,
          restaurants: { timezone: 'Europe/London' },
        },
      ],
      [
        'booking-late',
        {
          id: 'booking-late',
          restaurant_id: 'restaurant-1',
          booking_date: '2025-01-01',
          start_time: '20:00',
          end_time: '22:00',
          start_at: '2025-01-01T20:00:00.000Z',
          end_at: '2025-01-01T22:00:00.000Z',
          party_size: 2,
          restaurants: { timezone: 'Europe/London' },
        },
      ],
    ]);

    const assignmentsByBooking = new Map<string, Array<{ table_id: string; id: string }>>([
      ['booking-early', [{ table_id: 'table-1', id: 'assignment-early' }]],
      ['booking-late', [{ table_id: 'table-1', id: 'assignment-late' }]],
    ]);

    const allocationUpdateCalls: UpdateCall<{ window: string }>[] = [];
    const ledgerUpdateCalls: UpdateCall<{ assignment_window: string; merge_group_allocation_id: string | null }>[] = [];

    const client = {
      from(table: string) {
        switch (table) {
          case 'bookings':
            return {
              select() {
                return {
                  eq(_: string, bookingId: string) {
                    return {
                      maybeSingle: async () => ({ data: bookings.get(bookingId) ?? null, error: null }),
                    };
                  },
                };
              },
            };
          case 'booking_table_assignments':
            return {
              select() {
                return {
                  eq(column: string, bookingId: string) {
                    if (column !== 'booking_id') {
                      throw new Error(`Unexpected column ${column}`);
                    }
                    return {
                      in(inColumn: string, tableIds: string[]) {
                        if (inColumn !== 'table_id') {
                          throw new Error(`Unexpected in column ${inColumn}`);
                        }
                        expect(tableIds).toEqual(['table-1']);
                        return Promise.resolve({ data: assignmentsByBooking.get(bookingId) ?? [], error: null });
                      },
                    };
                  },
                };
              },
              update: assignmentUpdateRecorder.update,
            };
          case 'allocations':
            return createUpdateRecorder(allocationUpdateCalls);
          case 'booking_assignment_idempotency':
            return createUpdateRecorder(ledgerUpdateCalls);
          default:
            throw new Error(`Unexpected table ${table}`);
        }
      },
      rpc: vi.fn((name: string, params: any) => {
        if (name !== 'assign_tables_atomic_v2') {
          throw new Error(`Unexpected RPC ${name}`);
        }
        if (params.p_booking_id === 'booking-early') {
          return Promise.resolve({
            data: [
              {
                table_id: 'table-1',
                start_at: '2025-01-01T18:00:00.000Z',
                end_at: '2025-01-01T23:00:00.000Z',
                merge_group_id: null,
              },
            ],
            error: null,
          });
        }
        if (params.p_booking_id === 'booking-late') {
          return Promise.resolve({
            data: [
              {
                table_id: 'table-1',
                start_at: '2025-01-01T20:00:00.000Z',
                end_at: '2025-01-01T22:00:00.000Z',
                merge_group_id: null,
              },
            ],
            error: null,
          });
        }
        throw new Error(`Unexpected booking id ${params.p_booking_id}`);
      }),
    } as unknown as Parameters<AssignTableFn>[3];

    const firstResult = await assignTableToBooking('booking-early', 'table-1', 'user-1', client, {
      idempotencyKey: 'key-early',
    });

    expect(firstResult).toBe('assignment-early');

    expect(allocationUpdateCalls).toHaveLength(1);
    expect(allocationUpdateCalls[0]?.filters).toEqual(
      expect.arrayContaining([
        { column: 'booking_id', value: 'booking-early' },
        { column: 'resource_type', value: 'table' },
      ]),
    );

    const secondResult = await assignTableToBooking('booking-late', 'table-1', 'user-2', client, {
      idempotencyKey: 'key-late',
    });

    expect(secondResult).toBe('assignment-late');
    expect(allocationUpdateCalls).toHaveLength(1);
    expect(ledgerUpdateCalls).toHaveLength(1);
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
