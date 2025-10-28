import { NextRequest } from "next/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

process.env.BASE_URL = "http://localhost:3000";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";

import type { ManualHoldResult, ManualValidationResult } from "@/server/capacity/tables";

const mockCreateManualHold = vi.fn<[], Promise<ManualHoldResult>>();
const mockEvaluateManualSelection = vi.fn<[], Promise<ManualValidationResult>>();
const mockConfirmHoldAssignment = vi.fn();
const mockReleaseTableHold = vi.fn();

const BOOKING_ID = "11111111-1111-4111-8111-111111111111";
const TABLE_ID = "22222222-2222-4222-8222-222222222222";
const TABLE_ID_B = "33333333-3333-4333-8333-333333333333";
const HOLD_ID = "44444444-4444-4444-8444-444444444444";

const routeClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
};

const serviceClient = {} as const;

const routeContext: {
  bookingRow: Record<string, any> | null;
  membershipRow: Record<string, any> | null;
  holdRow: Record<string, any> | null;
} = {
  bookingRow: null,
  membershipRow: null,
  holdRow: null,
};

vi.mock("@/server/supabase", () => ({
  getRouteHandlerSupabaseClient: vi.fn(async () => routeClient),
  getServiceSupabaseClient: vi.fn(() => serviceClient),
}));

vi.mock("@/server/capacity/tables", async () => {
  const actual = await vi.importActual<typeof import("@/server/capacity/tables")>("@/server/capacity/tables");
  return {
    ...actual,
    createManualHold: mockCreateManualHold,
    evaluateManualSelection: mockEvaluateManualSelection,
    confirmHoldAssignment: mockConfirmHoldAssignment,
  };
});

vi.mock("@/server/capacity/holds", async () => {
  const actual = await vi.importActual<typeof import("@/server/capacity/holds")>("@/server/capacity/holds");
  return {
    ...actual,
    releaseTableHold: mockReleaseTableHold,
  };
});

let holdPost: typeof import("@/app/api/staff/manual/hold/route").POST;
let holdDelete: typeof import("@/app/api/staff/manual/hold/route").DELETE;
let validatePost: typeof import("@/app/api/staff/manual/validate/route").POST;
let confirmPost: typeof import("@/app/api/staff/manual/confirm/route").POST;

beforeAll(async () => {
  ({ POST: holdPost, DELETE: holdDelete } = await import("@/app/api/staff/manual/hold/route"));
  ({ POST: validatePost } = await import("@/app/api/staff/manual/validate/route"));
  ({ POST: confirmPost } = await import("@/app/api/staff/manual/confirm/route"));
});

beforeEach(() => {
  routeClient.auth.getUser.mockResolvedValue({
    data: { user: { id: "user-1" } },
    error: null,
  });

  routeContext.bookingRow = { id: BOOKING_ID, restaurant_id: "restaurant-1" };
  routeContext.membershipRow = { role: "manager" };
  routeContext.holdRow = {
    id: HOLD_ID,
    restaurant_id: "restaurant-1",
    booking_id: BOOKING_ID,
    zone_id: "zone-1",
    start_at: "2025-01-01T18:00:00.000Z",
    end_at: "2025-01-01T20:00:00.000Z",
    expires_at: "2025-01-01T18:05:00.000Z",
    table_hold_members: [{ table_id: TABLE_ID }],
  };

  routeClient.from.mockImplementation((table: string) => {
    if (table === "bookings") {
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: routeContext.bookingRow, error: null }) }),
        }),
      };
    }
    if (table === "restaurant_memberships") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: routeContext.membershipRow, error: null }) }),
          }),
        }),
      };
    }
    if (table === "table_holds") {
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: routeContext.holdRow, error: null }) }),
        }),
      };
    }
    return {
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
    };
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/staff/manual/hold", () => {
  it("returns hold metadata and summary", async () => {
    mockCreateManualHold.mockResolvedValue({
      hold: {
        id: HOLD_ID,
        bookingId: BOOKING_ID,
        restaurantId: "restaurant-1",
        zoneId: "zone-1",
        startAt: "2025-01-01T18:00:00.000Z",
        endAt: "2025-01-01T20:00:00.000Z",
        expiresAt: "2025-01-01T18:05:00.000Z",
        tableIds: [TABLE_ID],
      },
      validation: {
        ok: true,
        summary: {
          tableCount: 1,
          totalCapacity: 4,
          slack: 1,
          zoneId: "zone-1",
          tableNumbers: ["T1"],
          partySize: 3,
        },
        checks: [],
      },
    });

    const request = new Request("http://localhost/api/staff/manual/hold", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId: BOOKING_ID, tableIds: [TABLE_ID] }),
    }) as unknown as NextRequest;

    const response = await holdPost(request);
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.hold.id).toBe(HOLD_ID);
    expect(payload.summary.tableCount).toBe(1);
    expect(payload.validation.summary.totalCapacity).toBe(4);
    expect(mockCreateManualHold).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: BOOKING_ID,
        createdBy: "user-1",
      }),
    );
  });
});

describe("POST /api/staff/manual/validate", () => {
  it("returns validation checks with summary", async () => {
    mockEvaluateManualSelection.mockResolvedValue({
      ok: false,
      summary: {
        tableCount: 2,
        totalCapacity: 8,
        slack: 0,
        zoneId: "zone-2",
        tableNumbers: ["A1", "A2"],
        partySize: 8,
      },
      checks: [
        {
          id: "capacity",
          status: "ok",
          message: "Capacity satisfied",
        },
      ],
    });

    const request = new Request("http://localhost/api/staff/manual/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId: BOOKING_ID, tableIds: [TABLE_ID, TABLE_ID_B] }),
    }) as unknown as NextRequest;

    const response = await validatePost(request);
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.summary.tableCount).toBe(2);
    expect(payload.checks[0]?.id).toBe("capacity");
  });
});

describe("POST /api/staff/manual/confirm", () => {
  it("returns assignments on success", async () => {
    mockConfirmHoldAssignment.mockResolvedValue([
      {
        tableId: TABLE_ID,
        assignmentId: "assign-1",
        startAt: "2025-01-01T18:00:00.000Z",
        endAt: "2025-01-01T20:00:00.000Z",
      },
    ]);

    const request = new Request("http://localhost/api/staff/manual/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId: BOOKING_ID, holdId: HOLD_ID, idempotencyKey: "key-1" }),
    }) as unknown as NextRequest;

    const response = await confirmPost(request);
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.assignments[0]?.tableId).toBe(TABLE_ID);
  });

  it("propagates RPC conflicts with structured payload", async () => {
    const { AssignTablesRpcError } = await import("@/server/capacity/holds");
    mockConfirmHoldAssignment.mockRejectedValueOnce(
      new AssignTablesRpcError({
        code: "409",
        message: "duplicate",
        details: "conflict",
        hint: null,
      } as any),
    );

    const request = new Request("http://localhost/api/staff/manual/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId: BOOKING_ID, holdId: HOLD_ID, idempotencyKey: "key-2" }),
    }) as unknown as NextRequest;

    const response = await confirmPost(request);
    expect(response.status).toBe(409);
    const payload = await response.json();
    expect(payload.code).toBe("409");
    expect(payload.error).toBe("duplicate");
  });

  it("returns 422 for allocator validation errors", async () => {
    const { AssignTablesRpcError } = await import("@/server/capacity/holds");
    mockConfirmHoldAssignment.mockRejectedValueOnce(
      new AssignTablesRpcError({
        code: "ASSIGNMENT_VALIDATION",
        message: "Tables must be adjacent",
        details: JSON.stringify({ tableIds: [TABLE_ID, TABLE_ID_B] }),
        hint: "Select adjacent tables",
      } as any),
    );

    const request = new Request("http://localhost/api/staff/manual/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId: BOOKING_ID, holdId: HOLD_ID, idempotencyKey: "key-3" }),
    }) as unknown as NextRequest;

    const response = await confirmPost(request);
    expect(response.status).toBe(422);
    const payload = await response.json();
    expect(payload.code).toBe("ASSIGNMENT_VALIDATION");
    expect(payload.error).toBe("Tables must be adjacent");
  });
});

describe("DELETE /api/staff/manual/hold", () => {
  it("releases hold for booking", async () => {
    mockReleaseTableHold.mockResolvedValue(undefined);

    const request = new Request("http://localhost/api/staff/manual/hold", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ holdId: HOLD_ID, bookingId: BOOKING_ID }),
    }) as unknown as NextRequest;

    const response = await holdDelete(request);
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.released).toBe(true);
    expect(mockReleaseTableHold).toHaveBeenCalledWith({ holdId: HOLD_ID, client: serviceClient });
  });
});
