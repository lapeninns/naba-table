import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.BASE_URL = 'http://localhost:3000';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  process.env.FEATURE_ALLOCATOR_V2_ENABLED = 'true';
  return {};
});

import { AssignTablesRpcError } from "@/server/capacity/holds";
import { AssignmentConflictError, SupabaseAssignmentRepository } from "@/server/capacity/v2";

const emitHoldCreated = vi.fn();
const emitHoldConfirmed = vi.fn();
const emitRpcConflict = vi.fn();
const emitSelectorDecision = vi.fn();
const emitSelectorQuote = vi.fn();

vi.mock("@/server/capacity/telemetry", () => ({
  emitHoldCreated,
  emitHoldConfirmed,
  emitRpcConflict,
  emitSelectorDecision,
  emitSelectorQuote,
  summarizeCandidate: vi.fn(),
  emitHoldExpired: vi.fn(),
}));

const BOOKING_ID = "booking-1";
const HOLD_ID = "hold-1";
const TABLE_ID = "table-a";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
type TablesModule = typeof import("@/server/capacity/tables");
let confirmHoldAssignment: TablesModule["confirmHoldAssignment"];

beforeAll(async () => {
  ({ confirmHoldAssignment } = (await import("@/server/capacity/tables")) as TablesModule);
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

type SupabaseOverride = {
  hold?: Partial<{
    id: string;
    booking_id: string | null;
    restaurant_id: string;
    zone_id: string | null;
    start_at: string;
    end_at: string;
    expires_at: string;
    table_hold_members: Array<{ table_id: string }>;
  }>;
  booking?: Partial<{
    id: string;
    restaurant_id: string;
    booking_date: string;
    start_time: string;
    end_time: string;
    start_at: string | null;
    end_at: string | null;
    party_size: number;
    restaurants: Array<{ timezone: string }> | null;
  }>;
  assignments?: Array<{
    table_id: string;
    id: string;
    start_at: string | null;
    end_at: string | null;
    merge_group_id: string | null;
  }>;
  holdDelete?: (column: string, value: unknown) => Promise<{ data: null; error: null }>;
};

function createSupabaseClient(overrides?: SupabaseOverride) {
  const baseHoldRow = {
    id: HOLD_ID,
    booking_id: BOOKING_ID,
    restaurant_id: "restaurant-1",
    zone_id: "zone-1",
    start_at: "2025-01-01T18:00:00.000Z",
    end_at: "2025-01-01T20:00:00.000Z",
    expires_at: "2025-01-01T18:05:00.000Z",
    table_hold_members: [{ table_id: TABLE_ID }],
  };
  const holdRow = { ...baseHoldRow, ...(overrides?.hold ?? {}) };

  const assignmentRows =
    overrides?.assignments ??
    [
      {
        table_id: TABLE_ID,
        id: "assignment-1",
        start_at: "2025-01-01T18:00:00.000Z",
        end_at: "2025-01-01T20:00:00.000Z",
        merge_group_id: null,
      },
    ];

  const baseBookingRow = {
    id: BOOKING_ID,
    restaurant_id: "restaurant-1",
    booking_date: "2025-01-01",
    start_time: "18:00",
    end_time: "20:00",
    start_at: "2025-01-01T18:00:00.000Z",
    end_at: "2025-01-01T20:00:00.000Z",
    party_size: 4,
    restaurants: [{ timezone: "Europe/London" }],
  };
  const bookingRow = { ...baseBookingRow, ...(overrides?.booking ?? {}) };

  const deleteHandler =
    overrides?.holdDelete ??
    (() => Promise.resolve({ data: null, error: null }));

  const assignmentUpdateCalls: UpdateCall<{ start_at: string; end_at: string }>[] = [];
  const allocationUpdateCalls: UpdateCall<{ window: string }>[] = [];
  const ledgerUpdateCalls: UpdateCall<{ assignment_window: string; merge_group_allocation_id: string | null }>[] = [];
  const assignmentUpdateRecorder = createUpdateRecorder(assignmentUpdateCalls);
  const allocationUpdateRecorder = createUpdateRecorder(allocationUpdateCalls);
  const ledgerUpdateRecorder = createUpdateRecorder(ledgerUpdateCalls);

  return {
    from(table: string) {
      switch (table) {
        case "table_holds":
          return {
            select() {
              return {
                eq() {
                  return {
                    maybeSingle: async () => ({ data: holdRow, error: null }),
                  };
                },
              };
            },
            delete() {
              return {
                eq(column: string, value: unknown) {
                  return deleteHandler(column, value);
                },
              };
            },
          };
        case "booking_table_assignments":
          return {
            select() {
              return {
                eq() {
                  return Promise.resolve({ data: assignmentRows, error: null });
                },
              };
            },
            update: assignmentUpdateRecorder.update,
          };
        case "allocations":
          return allocationUpdateRecorder;
        case "booking_assignment_idempotency":
          return ledgerUpdateRecorder;
        case "bookings":
          return {
            select() {
              return {
                eq() {
                  return {
                    maybeSingle: async () => ({ data: bookingRow, error: null }),
                  };
                },
              };
            },
          };
        default:
          throw new Error(`Unexpected table ${table}`);
      }
    },
    rpc(name: string, payload: Record<string, unknown>) {
      if (name !== "assign_tables_atomic_v2") {
        throw new Error(`Unexpected RPC ${name}`);
      }
      return Promise.resolve({
        data: [
          {
            table_id: TABLE_ID,
            start_at: payload.p_start_at,
            end_at: payload.p_end_at,
            merge_group_id: null,
          },
        ],
        error: null,
      });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as unknown as any;
}

describe('confirmHoldAssignment', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns assignments for first confirmation and rejects subsequent attempts', async () => {
    const repoSpy = vi
      .spyOn(SupabaseAssignmentRepository.prototype, 'commitAssignment')
      .mockResolvedValueOnce({
        attemptId: 'attempt-1',
        assignments: [
          {
            tableId: TABLE_ID,
            startAt: '2025-01-01T18:00:00.000Z',
            endAt: '2025-01-01T20:00:00.000Z',
            mergeGroupId: null,
          },
        ],
        mergeGroupId: null,
        shadow: false,
      })
      .mockRejectedValueOnce(new AssignmentConflictError('duplicate', { tableIds: [TABLE_ID] }));

    emitHoldConfirmed.mockResolvedValue();
    emitRpcConflict.mockResolvedValue();

    const client = createSupabaseClient();

    const first = await confirmHoldAssignment({
      holdId: HOLD_ID,
      bookingId: BOOKING_ID,
      idempotencyKey: 'key-1',
      client,
    });

    expect(first).toHaveLength(1);
    expect(first[0]?.tableId).toBe(TABLE_ID);
    expect(repoSpy).toHaveBeenCalledTimes(1);

    await expect(
      confirmHoldAssignment({
        holdId: HOLD_ID,
        bookingId: BOOKING_ID,
        idempotencyKey: 'key-2',
        client,
      }),
    ).rejects.toBeInstanceOf(AssignTablesRpcError);
  });

  it('invokes the allocator repository when confirming', async () => {
    const repoSpy = vi
      .spyOn(SupabaseAssignmentRepository.prototype, 'commitAssignment')
      .mockResolvedValue({
        attemptId: 'rpc-plan',
        assignments: [
          {
            tableId: TABLE_ID,
            startAt: '2025-01-01T18:00:00.000Z',
            endAt: '2025-01-01T19:20:00.000Z',
            mergeGroupId: null,
          },
        ],
        mergeGroupId: null,
        shadow: false,
      });

    const client = createSupabaseClient();

    const result = await confirmHoldAssignment({
      holdId: HOLD_ID,
      bookingId: BOOKING_ID,
      idempotencyKey: 'key-allocator-v2',
      client,
    });

    expect(repoSpy).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result[0]?.tableId).toBe(TABLE_ID);
  });

  it('normalizes confirmed assignment windows when the booking duration is excessive', async () => {
    const repoSpy = vi
      .spyOn(SupabaseAssignmentRepository.prototype, 'commitAssignment')
      .mockResolvedValueOnce({
        attemptId: 'attempt-1',
        assignments: [
          {
            tableId: TABLE_ID,
            startAt: '2025-01-01T18:00:00.000Z',
            endAt: '2025-01-01T23:00:00.000Z',
            mergeGroupId: null,
          },
        ],
        mergeGroupId: null,
        shadow: false,
      });

    const holdRow = {
      id: HOLD_ID,
      booking_id: BOOKING_ID,
      restaurant_id: 'restaurant-1',
      zone_id: 'zone-1',
      start_at: '2025-01-01T18:00:00.000Z',
      end_at: '2025-01-01T23:00:00.000Z',
      expires_at: '2025-01-01T18:05:00.000Z',
      table_hold_members: [{ table_id: TABLE_ID }],
    };

    const bookingRow = {
      id: BOOKING_ID,
      restaurant_id: 'restaurant-1',
      booking_date: '2025-01-01',
      start_time: '18:00',
      end_time: '23:00',
      start_at: '2025-01-01T18:00:00.000Z',
      end_at: '2025-01-01T23:00:00.000Z',
      party_size: 4,
      restaurants: [{ timezone: 'Europe/London' }],
    };

    const assignmentRows = [{ table_id: TABLE_ID, id: 'assignment-1', start_at: '2025-01-01T18:00:00.000Z', end_at: '2025-01-01T23:00:00.000Z', merge_group_id: null }];

    const assignmentUpdateCalls: UpdateCall<{ start_at: string; end_at: string }>[] = [];
    const allocationUpdateCalls: UpdateCall<{ window: string }>[] = [];
    const ledgerUpdateCalls: UpdateCall<{ assignment_window: string; merge_group_allocation_id: string | null }>[] = [];

    const client = {
      from(table: string) {
        switch (table) {
          case 'table_holds':
            return {
              select() {
                return {
                  eq() {
                    return {
                      maybeSingle: async () => ({ data: holdRow, error: null }),
                    };
                  },
                };
              },
            };
          case 'booking_table_assignments':
            return {
              select() {
                return {
                  eq() {
                    return Promise.resolve({ data: assignmentRows, error: null });
                  },
                };
              },
              update: createUpdateRecorder(assignmentUpdateCalls).update,
            };
          case 'bookings':
            return {
              select() {
                return {
                  eq() {
                    return {
                      maybeSingle: async () => ({ data: bookingRow, error: null }),
                    };
                  },
                };
              },
            };
          case 'allocations':
            return createUpdateRecorder(allocationUpdateCalls);
          case 'booking_assignment_idempotency':
            return createUpdateRecorder(ledgerUpdateCalls);
          default:
            throw new Error(`Unexpected table ${table}`);
        }
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as unknown as any;

    emitHoldConfirmed.mockResolvedValue();

    const result = await confirmHoldAssignment({
      holdId: HOLD_ID,
      bookingId: BOOKING_ID,
      idempotencyKey: 'clamp-hold',
      client,
    });

    expect(repoSpy).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result[0]?.startAt).toBe('2025-01-01T18:00:00Z');
    expect(result[0]?.endAt).toBe('2025-01-01T19:20:00Z');
    expect(assignmentUpdateCalls).toHaveLength(1);
    expect(allocationUpdateCalls).toHaveLength(1);
    expect(allocationUpdateCalls[0]?.payload).toEqual({ window: '[2025-01-01T18:00:00Z,2025-01-01T19:20:00Z)' });
    expect(ledgerUpdateCalls).toHaveLength(1);
    expect(ledgerUpdateCalls[0]?.payload).toEqual({
      assignment_window: '[2025-01-01T18:00:00Z,2025-01-01T19:20:00Z)',
      merge_group_allocation_id: null,
    });
    const telemetryPayload = emitHoldConfirmed.mock.calls.at(-1)?.[0];
    expect(telemetryPayload).toBeDefined();
    expect(telemetryPayload).toMatchObject({
      holdId: HOLD_ID,
      startAt: '2025-01-01T18:00:00Z',
      endAt: '2025-01-01T19:20:00Z',
      zoneId: 'zone-1',
    });
    expect(telemetryPayload?.metadata ?? undefined).toBeUndefined();
  });

  it('flags telemetry metadata when hold zone is missing', async () => {
    const repoSpy = vi
      .spyOn(SupabaseAssignmentRepository.prototype, 'commitAssignment')
      .mockResolvedValue({
        attemptId: 'telemetry',
        assignments: [
          {
            tableId: TABLE_ID,
            startAt: '2025-01-01T18:00:00.000Z',
            endAt: '2025-01-01T19:20:00.000Z',
            mergeGroupId: null,
          },
        ],
        mergeGroupId: null,
        shadow: false,
      });

    const client = createSupabaseClient({ hold: { zone_id: null } });
    emitHoldConfirmed.mockResolvedValue();

    await confirmHoldAssignment({
      holdId: HOLD_ID,
      bookingId: BOOKING_ID,
      idempotencyKey: 'missing-zone',
      client,
    });

    expect(repoSpy).toHaveBeenCalledTimes(1);
    const telemetryPayload = emitHoldConfirmed.mock.calls.at(-1)?.[0];
    expect(telemetryPayload).toBeDefined();
    expect(telemetryPayload).toMatchObject({
      holdId: HOLD_ID,
      zoneId: '',
    });
    expect(telemetryPayload?.metadata).toEqual({ unknownZone: true });
  });

  it('emits conflict and rejects when hold booking mismatches', async () => {
    const repoSpy = vi.spyOn(SupabaseAssignmentRepository.prototype, 'commitAssignment');
    emitRpcConflict.mockResolvedValue();
    const holdDelete = vi.fn().mockResolvedValue({ data: null, error: null });
    const client = createSupabaseClient({
      hold: { booking_id: 'another-booking' },
      holdDelete: holdDelete,
    });

    await expect(
      confirmHoldAssignment({
        holdId: HOLD_ID,
        bookingId: BOOKING_ID,
        idempotencyKey: 'mismatch',
        client,
      }),
    ).rejects.toMatchObject({ code: 'HOLD_BOOKING_MISMATCH' });

    expect(repoSpy).not.toHaveBeenCalled();
    expect(emitHoldConfirmed).not.toHaveBeenCalled();
    expect(emitRpcConflict).toHaveBeenCalledTimes(1);
    const conflictPayload = emitRpcConflict.mock.calls[0]?.[0];
    expect(conflictPayload).toMatchObject({
      bookingId: BOOKING_ID,
      holdId: HOLD_ID,
      error: {
        code: 'HOLD_BOOKING_MISMATCH',
      },
    });
    expect(holdDelete).not.toHaveBeenCalled();
  });
});
