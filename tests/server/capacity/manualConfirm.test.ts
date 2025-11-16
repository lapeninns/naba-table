import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.BASE_URL = 'http://localhost:3000';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  process.env.FEATURE_ALLOCATOR_V2_ENABLED = 'true';
  return {};
});

import * as HoldsModule from "@/server/capacity/holds";
import { getVenuePolicy } from "@/server/capacity/policy";
import { computePayloadChecksum, hashPolicyVersion } from "@/server/capacity/v2";

const emitHoldCreated = vi.fn();
const emitHoldConfirmed = vi.fn();
const emitRpcConflict = vi.fn();
const emitSelectorDecision = vi.fn();
const emitSelectorQuote = vi.fn();
const enqueueOutboxEvent = vi.fn();

vi.mock("@/server/capacity/telemetry", () => ({
  emitHoldCreated,
  emitHoldConfirmed,
  emitRpcConflict,
  emitSelectorDecision,
  emitSelectorQuote,
  summarizeCandidate: vi.fn(),
  emitHoldExpired: vi.fn(),
}));

vi.mock("@/server/outbox", () => ({
  enqueueOutboxEvent,
}));

const BOOKING_ID = "booking-1";
const HOLD_ID = "hold-1";
const TABLE_ID = "table-a";

const DEFAULT_POLICY_HASH = hashPolicyVersion(getVenuePolicy({ timezone: "Europe/London" }));
const DEFAULT_SELECTION_SNAPSHOT = {
  zoneIds: ["zone-1"],
  adjacency: {
    undirected: true,
    edges: [] as string[],
    hash: computePayloadChecksum({ undirected: true, edges: [] as string[] }),
  },
};
const DEFAULT_HOLD_METADATA = {
  policyVersion: DEFAULT_POLICY_HASH,
  selection: {
    snapshot: DEFAULT_SELECTION_SNAPSHOT,
  },
};

function cloneDefaultHoldMetadata(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(DEFAULT_HOLD_METADATA));
}

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
    metadata: Record<string, unknown>;
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
  rpcAssignments?: Array<{
    assignment_id: string;
    table_id: string;
    start_at: string;
    end_at: string;
    merge_group_id: string | null;
  }>;
  rpcError?: {
    message?: string;
    code?: string;
    details?: unknown;
    hint?: string | null;
  };
  confirmationResult?: {
    idempotency_key: string;
    table_ids?: string[];
  } | null;
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
    metadata: cloneDefaultHoldMetadata(),
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
  const confirmationRow = overrides?.confirmationResult ?? null;

  const deleteHandler =
    overrides?.holdDelete ??
    (() => Promise.resolve({ data: null, error: null }));

  const assignmentUpdateCalls: UpdateCall<{ start_at: string; end_at: string }>[] = [];
  const allocationUpdateCalls: UpdateCall<{ window: string }>[] = [];
  const ledgerUpdateCalls: UpdateCall<{ assignment_window: string; merge_group_allocation_id: string | null }>[] = [];
  const assignmentUpdateRecorder = createUpdateRecorder(assignmentUpdateCalls);
  const allocationUpdateRecorder = createUpdateRecorder(allocationUpdateCalls);
  const ledgerUpdateRecorder = createUpdateRecorder(ledgerUpdateCalls);
  const rpcAssignments =
    overrides?.rpcAssignments ??
    [
      {
        assignment_id: assignmentRows[0]?.id ?? "assignment-1",
        table_id: TABLE_ID,
        start_at: holdRow.start_at,
        end_at: holdRow.end_at,
        merge_group_id: null,
      },
    ];
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];

  return {
    __rpcCalls: rpcCalls,
    from(table: string) {
      const normalizedTable = table.trim();
      switch (normalizedTable) {
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
        case "table_inventory":
          return {
            select() {
              return {
                eq(eqColumn: string, eqValue: unknown) {
                  if (eqColumn !== "restaurant_id" || eqValue !== holdRow.restaurant_id) {
                    return {
                      in() {
                        return Promise.resolve({ data: [], error: null });
                      },
                    };
                  }
                  return {
                    in(_: string, ids: unknown) {
                      const idList = Array.isArray(ids) ? ids : [];
                      const rows = idList.map((id) => ({
                        id,
                        table_number: "T1",
                        capacity: 4,
                        min_party_size: null,
                        max_party_size: null,
                        section: null,
                        category: null,
                        seating_type: null,
                        mobility: null,
                        zone_id: holdRow.zone_id ?? "zone-1",
                        status: "available",
                        active: true,
                        position: null,
                      }));
                      return Promise.resolve({ data: rows, error: null });
                    },
                  };
                },
              };
            },
          };
        case "table_adjacencies":
          return {
            select() {
              const builder = {
                eq() {
                  return builder;
                },
                in() {
                  return Promise.resolve({ data: [], error: null });
                },
              };
              return builder;
            },
          };
        case "table_hold_members":
          return {
            delete() {
              return {
                eq() {
                  return Promise.resolve({ data: null, error: null });
                },
              };
            },
          };
        case "booking_table_assignments":
          return {
            select() {
              const builder = {
                eq() {
                  return builder;
                },
                match() {
                  return builder;
                },
                abortSignal() {
                  return builder;
                },
                then(
                  resolve: (value: { data: typeof assignmentRows; error: null }) => void,
                  reject?: (reason: unknown) => void,
                ) {
                  return Promise.resolve({ data: assignmentRows, error: null }).then(resolve, reject);
                },
              };
              return builder;
            },
            update: assignmentUpdateRecorder.update,
          };
        case "allocations":
          return allocationUpdateRecorder;
        case "booking_assignment_idempotency":
          return {
            select() {
              const builder = {
                eq() {
                  return builder;
                },
                maybeSingle: async () => ({ data: null, error: null }),
              };
              return builder;
            },
            update: ledgerUpdateRecorder.update,
          };
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
        case "booking_confirmation_results":
          return {
            select() {
              const builder = {
                eq() {
                  return builder;
                },
                match() {
                  return builder;
                },
                limit() {
                  return builder;
                },
                abortSignal() {
                  return builder;
                },
                maybeSingle: async () => ({ data: confirmationRow, error: null }),
              };
              return builder;
            },
          };
        default:
          throw new Error(`Unexpected table ${table}`);
      }
    },
    rpc(name: string, payload: Record<string, unknown>) {
      rpcCalls.push({ name, args: payload });
      if (name === "confirm_hold_assignment_tx") {
        if (overrides?.rpcError) {
          return Promise.resolve({
            data: null,
            error: overrides.rpcError,
          });
        }
        return Promise.resolve({
          data: rpcAssignments,
          error: null,
        });
      }
      if (name === "assign_tables_atomic_v2") {
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
      }
      if (name === "set_hold_conflict_enforcement") {
        return Promise.resolve({ data: true, error: null });
      }
      if (name === "is_holds_strict_conflicts_enabled") {
        return Promise.resolve({ data: true, error: null });
      }
      throw new Error(`Unexpected RPC ${name}`);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as unknown as any;
}

describe('confirmHoldAssignment', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    emitHoldCreated.mockReset();
    emitHoldConfirmed.mockReset();
    emitRpcConflict.mockReset();
    emitSelectorDecision.mockReset();
    emitSelectorQuote.mockReset();
    enqueueOutboxEvent.mockReset();
    vi.spyOn(HoldsModule, 'releaseTableHold').mockResolvedValue();
  });

  it('invokes confirm_hold_assignment_tx and returns assignments', async () => {
    const client = createSupabaseClient();
    const result = await confirmHoldAssignment({
      holdId: HOLD_ID,
      bookingId: BOOKING_ID,
      idempotencyKey: 'rpc-success',
      client,
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.tableId).toBe(TABLE_ID);
    expect(result[0]?.assignmentId).toBe('assignment-1');
    const rpcCall = client.__rpcCalls.find((call: { name: string }) => call.name === 'confirm_hold_assignment_tx');
    expect(rpcCall).toBeTruthy();
    expect(rpcCall?.args.p_hold_id).toBe(HOLD_ID);
  });

  it('returns cached confirmation without invoking RPC', async () => {
    const client = createSupabaseClient({
      confirmationResult: { idempotency_key: 'cached-key', table_ids: [TABLE_ID] },
    });
    const result = await confirmHoldAssignment({
      holdId: HOLD_ID,
      bookingId: BOOKING_ID,
      idempotencyKey: 'cached-key',
      client,
    });
    expect(result).toHaveLength(1);
    expect(client.__rpcCalls.find((call: { name: string }) => call.name === 'confirm_hold_assignment_tx')).toBeUndefined();
  });

  it('propagates RPC errors', async () => {
    const client = createSupabaseClient({
      rpcError: { message: 'rpc failed', code: 'RPC_FAIL' },
    });
    await expect(
      confirmHoldAssignment({
        holdId: HOLD_ID,
        bookingId: BOOKING_ID,
        idempotencyKey: 'rpc-error',
        client,
      }),
    ).rejects.toMatchObject({ code: 'RPC_FAIL' });
  });

  it('rejects holds without snapshot metadata', async () => {
    const client = createSupabaseClient({
      hold: {
        metadata: {
          policyVersion: 'policy-1',
          selection: {},
        },
      },
    });
    await expect(
      confirmHoldAssignment({
        holdId: HOLD_ID,
        bookingId: BOOKING_ID,
        idempotencyKey: 'missing-metadata',
        client,
      }),
    ).rejects.toMatchObject({ code: 'HOLD_METADATA_INCOMPLETE' });
  });

  it('rejects when policy version drifts', async () => {
    const metadata = cloneDefaultHoldMetadata();
    metadata.policyVersion = 'stale';
    const client = createSupabaseClient({ hold: { metadata } });
    await expect(
      confirmHoldAssignment({
        holdId: HOLD_ID,
        bookingId: BOOKING_ID,
        idempotencyKey: 'policy-drift',
        client,
      }),
    ).rejects.toMatchObject({ code: 'POLICY_DRIFT' });
  });

  it('rejects when adjacency snapshot hash changes', async () => {
    const metadata = cloneDefaultHoldMetadata();
    metadata.selection.snapshot = {
      zoneIds: ['zone-other'],
      adjacency: DEFAULT_SELECTION_SNAPSHOT.adjacency,
    };
    const client = createSupabaseClient({ hold: { metadata } });
    await expect(
      confirmHoldAssignment({
        holdId: HOLD_ID,
        bookingId: BOOKING_ID,
        idempotencyKey: 'adjacency-drift',
        client,
      }),
    ).rejects.toMatchObject({ code: 'POLICY_DRIFT' });
  });
});
