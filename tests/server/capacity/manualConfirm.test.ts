import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.BASE_URL = 'http://localhost:3000';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  return {};
});

import * as holdsModule from "@/server/capacity/holds";
import { AssignTablesRpcError } from "@/server/capacity/holds";

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

let confirmHoldAssignment: typeof import("@/server/capacity/tables")["confirmHoldAssignment"];

beforeAll(async () => {
  ({ confirmHoldAssignment } = await import("@/server/capacity/tables"));
});

function createSupabaseClient() {
  const holdRow = {
    id: HOLD_ID,
    booking_id: BOOKING_ID,
    restaurant_id: "restaurant-1",
    zone_id: "zone-1",
    start_at: "2025-01-01T18:00:00.000Z",
    end_at: "2025-01-01T20:00:00.000Z",
    expires_at: "2025-01-01T18:05:00.000Z",
    table_hold_members: [{ table_id: TABLE_ID }],
  };

  const assignmentRows = [{ table_id: TABLE_ID, id: "assignment-1" }];

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
          };
        default:
          throw new Error(`Unexpected table ${table}`);
      }
    },
  } as unknown as any;
}

describe('confirmHoldAssignment', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns assignments for first confirmation and rejects subsequent attempts', async () => {
    const confirmSpy = vi
      .spyOn(holdsModule, 'confirmTableHold')
      .mockResolvedValueOnce([
        {
          tableId: TABLE_ID,
          assignmentId: 'assignment-1',
          startAt: '2025-01-01T18:00:00.000Z',
          endAt: '2025-01-01T20:00:00.000Z',
        },
      ])
      .mockImplementationOnce(() => {
        throw new AssignTablesRpcError({
          message: 'duplicate',
          code: '409',
          details: 'duplicate confirmation',
          hint: null,
        } as any);
      });

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
    expect(confirmSpy).toHaveBeenCalledTimes(1);

    await expect(
      confirmHoldAssignment({
        holdId: HOLD_ID,
        bookingId: BOOKING_ID,
        idempotencyKey: 'key-2',
        client,
      }),
    ).rejects.toBeInstanceOf(AssignTablesRpcError);
  });
});
