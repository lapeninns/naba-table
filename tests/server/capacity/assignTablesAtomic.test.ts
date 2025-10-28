import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.BASE_URL = 'http://localhost:3000';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
process.env.FEATURE_ALLOCATOR_V2_ENABLED = 'true';

import { AssignTablesRpcError } from '@/server/capacity/holds';
import * as featureFlags from '@/server/feature-flags';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
type AssignTableFn = typeof import('@/server/capacity/tables')['assignTableToBooking'];
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
type UnassignTableFn = typeof import('@/server/capacity/tables')['unassignTableFromBooking'];
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
type TablesInternal = typeof import('@/server/capacity/tables')['__internal'];

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
      };
      return builder;
    },
  };
}

let assignTableToBooking: AssignTableFn;
let unassignTableFromBooking: UnassignTableFn;
let tablesInternal: TablesInternal;
let allocatorFlagSpy: vi.SpyInstance<boolean, []>;

beforeAll(async () => {
  const tablesModule = await import('@/server/capacity/tables');
  ({ assignTableToBooking, unassignTableFromBooking } = tablesModule);
  tablesInternal = tablesModule.__internal;
});

describe('assignTableToBooking (allocator orchestrator)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    allocatorFlagSpy = vi.spyOn(featureFlags, 'isAllocatorV2Enabled').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function buildSupabaseClient(overrides?: Partial<Record<string, unknown>>) {
    const assignmentUpdateCalls: UpdateCall<{ start_at: string; end_at: string }>[] = [];
    const allocationUpdateCalls: UpdateCall<{ window: string }>[] = [];
    const ledgerUpdateCalls: UpdateCall<{ assignment_window: string; merge_group_allocation_id: string | null }>[] = [];
    const rpcCalls: Array<{ name: string; payload: Record<string, unknown> }> = [];

    const client = {
      from(table: string) {
        switch (table) {
          case 'bookings':
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: {
                      id: 'booking-1',
                      restaurant_id: 'restaurant-1',
                      booking_date: '2025-01-01',
                      start_time: '18:00',
                      end_time: '20:00',
                      start_at: '2025-01-01T18:00:00.000Z',
                      end_at: '2025-01-01T20:00:00.000Z',
                      party_size: 2,
                      restaurants: { timezone: 'UTC' },
                    },
                    error: null,
                  }),
                }),
              }),
            };
          case 'booking_table_assignments':
            return {
              select: () => ({
                eq: () => ({
                  in: () =>
                    Promise.resolve({
                      data: [
                        {
                          table_id: 'table-1',
                          id: 'assignment-1',
                          start_at: '2025-01-01T18:00:00.000Z',
                          end_at: '2025-01-01T20:00:00.000Z',
                          merge_group_id: null,
                        },
                      ],
                      error: null,
                    }),
                }),
              }),
              update: createUpdateRecorder(assignmentUpdateCalls).update,
            };
          case 'allocations':
            return createUpdateRecorder(allocationUpdateCalls);
          case 'booking_assignment_idempotency':
            return createUpdateRecorder(ledgerUpdateCalls);
          default:
            throw new Error(`Unexpected table ${table}`);
        }
      },
      rpc(name: string, payload: Record<string, unknown>) {
        rpcCalls.push({ name, payload });
        return Promise.resolve({
          data: [
            {
              table_id: 'table-1',
              start_at: payload.p_start_at,
              end_at: payload.p_end_at,
              merge_group_id: null,
            },
          ],
          error: null,
        });
      },
      ...(overrides ?? {}),
    } as unknown as Parameters<AssignTableFn>[3];

    return { client, assignmentUpdateCalls, allocationUpdateCalls, ledgerUpdateCalls, rpcCalls };
  }

  it('commits via allocator repository and syncs assignments', async () => {
    const { client, assignmentUpdateCalls, allocationUpdateCalls, ledgerUpdateCalls, rpcCalls } =
      buildSupabaseClient();

    const window = tablesInternal.computeBookingWindow({
      startISO: '2025-01-01T18:00:00.000Z',
      bookingDate: '2025-01-01',
      startTime: '18:00',
      partySize: 2,
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const expectedStart = window.block.start.toUTC().toISO({ suppressMilliseconds: true })!;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const expectedEnd = window.block.end.toUTC().toISO({ suppressMilliseconds: true })!;

    const result = await assignTableToBooking('booking-1', 'table-1', 'user-1', client, {
      idempotencyKey: 'manual-key',
    });

    expect(result).toBe('assignment-1');
    expect(rpcCalls[0]).toMatchObject({
      name: 'assign_tables_atomic_v2',
      payload: expect.objectContaining({
        p_booking_id: 'booking-1',
        p_table_ids: ['table-1'],
        p_idempotency_key: 'manual-key',
      }),
    });
    expect(assignmentUpdateCalls).toHaveLength(0);
    expect(allocationUpdateCalls).toHaveLength(0);
    expect(ledgerUpdateCalls).toHaveLength(0);
  });

  it('wraps repository errors into AssignTablesRpcError', async () => {
    const { client } = buildSupabaseClient({
      rpc: () =>
        Promise.resolve({
          data: null,
          error: { code: 'XX000', message: 'random failure', details: null, hint: null },
        }),
    });

    await expect(assignTableToBooking('booking-1', 'table-1', 'user-1', client)).rejects.toBeInstanceOf(
      AssignTablesRpcError,
    );
  });

  it('surfaces conflicts from repository as AssignTablesRpcError', async () => {
    const { client } = buildSupabaseClient({
      rpc: () =>
        Promise.resolve({
          data: null,
          error: { code: '23505', message: 'duplicate', details: null, hint: null },
        }),
    });

    await expect(assignTableToBooking('booking-1', 'table-1', 'user-1', client)).rejects.toBeInstanceOf(
      AssignTablesRpcError,
    );
  });

  it('requires allocator v2 flag', async () => {
    allocatorFlagSpy.mockReturnValue(false);
    const { client } = buildSupabaseClient();

    await expect(assignTableToBooking('booking-1', 'table-1', 'user-1', client)).rejects.toThrow(
      /Allocator v2 must be enabled to assign tables/,
    );
  });
});

describe('unassignTableFromBooking (legacy RPC)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('invokes unassign_tables_atomic', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ table_id: 'table-1' }], error: null });
    const client = {
      rpc,
    } as unknown as Parameters<UnassignTableFromBooking>[2];

    const result = await unassignTableFromBooking('booking-1', 'table-1', client);
    expect(result).toBe(true);
    expect(rpc).toHaveBeenCalledWith('unassign_tables_atomic', {
      p_booking_id: 'booking-1',
      p_table_ids: ['table-1'],
    });
  });
});
