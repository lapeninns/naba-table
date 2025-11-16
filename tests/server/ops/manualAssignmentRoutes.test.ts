import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { ManualHoldResult, ManualValidationResult } from "@/server/capacity/tables";
import type { NextRequest } from "next/server";

process.env.BASE_URL = "http://localhost:3000";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";

const mockCreateManualHold = vi.fn<[], Promise<ManualHoldResult>>();
const mockEvaluateManualSelection = vi.fn<[], Promise<ManualValidationResult>>();
const mockConfirmHoldAssignment = vi.fn();
const mockGetManualAssignmentContext = vi.fn();
const mockReleaseTableHold = vi.fn();
const mockSendBookingConfirmationEmail = vi.fn();

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

const serviceClient = {
  from: vi.fn(),
};

const serviceContext: {
  bookingRow: Record<string, unknown> | null;
} = {
  bookingRow: null,
};

const clone = <T>(value: T): T =>
  value === null || value === undefined ? value : JSON.parse(JSON.stringify(value));

const routeContext: {
  bookingRow: Record<string, unknown> | null;
  membershipRow: Record<string, unknown> | null;
  holdRow: Record<string, unknown> | null;
} = {
  bookingRow: null,
  membershipRow: null,
  holdRow: null,
};

vi.mock("@/server/supabase", () => ({
  getRouteHandlerSupabaseClient: vi.fn(async () => routeClient),
  getServiceSupabaseClient: vi.fn(() => serviceClient),
  getTenantServiceSupabaseClient: vi.fn(() => serviceClient),
}));

vi.mock("@/server/emails/bookings", () => ({
  sendBookingConfirmationEmail: mockSendBookingConfirmationEmail,
}));

vi.mock("@/server/capacity/tables", async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    createManualHold: mockCreateManualHold,
    evaluateManualSelection: mockEvaluateManualSelection,
    confirmHoldAssignment: mockConfirmHoldAssignment,
    getManualAssignmentContext: mockGetManualAssignmentContext,
  };
});

vi.mock("@/server/capacity/holds", async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    releaseTableHold: mockReleaseTableHold,
  };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let holdPost: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let holdDelete: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let validatePost: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let confirmPost: any;

beforeAll(async () => {
  ({ POST: holdPost, DELETE: holdDelete } = await import("@/app/api/staff/manual/hold/route"));
  ({ POST: validatePost } = await import("@/app/api/staff/manual/validate/route"));
  ({ POST: confirmPost } = await import("@/app/api/staff/manual/confirm/route"));
});

beforeEach(() => {
  mockGetManualAssignmentContext.mockResolvedValue({
    booking: { id: BOOKING_ID },
    tables: [],
    bookingAssignments: [],
    holds: [],
    activeHold: null,
    conflicts: [],
    window: { startAt: null, endAt: null },
    flags: { adjacencyRequired: true, holdsStrictConflicts: false, adjacencyUndirected: true },
    contextVersion: "ctx-1",
    serverNow: new Date().toISOString(),
  });
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
  serviceContext.bookingRow = {
    id: BOOKING_ID,
    restaurant_id: "restaurant-1",
    status: "pending",
    booking_date: "2025-01-01",
    start_time: "18:00:00",
    end_time: "20:00:00",
    start_at: "2025-01-01T18:00:00.000Z",
    end_at: "2025-01-01T20:00:00.000Z",
    party_size: 3,
    booking_type: "standard",
    seating_preference: "standard",
    customer_name: "Guest Example",
    customer_email: "guest@example.com",
    reference: "REF123",
    created_at: "2025-01-01T17:00:00.000Z",
    updated_at: "2025-01-01T17:00:00.000Z",
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

  serviceClient.from.mockImplementation((table: string) => {
    if (table === "bookings") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: vi.fn(async () => ({
              data: clone(serviceContext.bookingRow),
              error: null,
            })),
          }),
        }),
      };
    }
    return {
      select: () => ({
        eq: () => ({
          maybeSingle: vi.fn(async () => ({ data: null, error: null })),
        }),
      }),
    };
  });

  mockConfirmHoldAssignment.mockImplementation(async () => {
    serviceContext.bookingRow = serviceContext.bookingRow
      ? { ...serviceContext.bookingRow, status: "confirmed" }
      : serviceContext.bookingRow;
    return [
      {
        tableId: TABLE_ID,
        assignmentId: "assign-1",
        startAt: "2025-01-01T18:00:00.000Z",
        endAt: "2025-01-01T20:00:00.000Z",
      },
    ];
  });
});

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.SUPPRESS_EMAILS;
  delete process.env.LOAD_TEST_DISABLE_EMAILS;
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
      body: JSON.stringify({ bookingId: BOOKING_ID, tableIds: [TABLE_ID], contextVersion: "ctx-1" }),
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

  it("returns 422 when manual validation fails", async () => {
    mockCreateManualHold.mockResolvedValue({
      hold: null,
      validation: {
        ok: false,
        summary: {
          tableCount: 1,
          totalCapacity: 6,
          slack: 3,
          zoneId: "zone-1",
          tableNumbers: ["T1"],
          partySize: 3,
        },
        checks: [
          {
            id: "slack",
            status: "error",
            message: "Selection exceeds slack budget",
          },
        ],
        policyVersion: "v1",
      },
    });

    const request = new Request("http://localhost/api/staff/manual/hold", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId: BOOKING_ID, tableIds: [TABLE_ID], contextVersion: "ctx-1" }),
    }) as unknown as NextRequest;

    const response = await holdPost(request);
    const payload = await response.json();
    expect(response.status).toBe(422);
    expect(payload.code).toBe("SLACK_BUDGET_EXCEEDED");
    expect(payload.validation.checks[0]?.id).toBe("slack");
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
      body: JSON.stringify({ bookingId: BOOKING_ID, tableIds: [TABLE_ID, TABLE_ID_B], contextVersion: "ctx-1" }),
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
    const request = new Request("http://localhost/api/staff/manual/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId: BOOKING_ID, holdId: HOLD_ID, idempotencyKey: "key-1", contextVersion: "ctx-1" }),
    }) as unknown as NextRequest;

    const response = await confirmPost(request);
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.assignments[0]?.tableId).toBe(TABLE_ID);
    expect(mockConfirmHoldAssignment).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: BOOKING_ID,
        transition: expect.objectContaining({
          targetStatus: "confirmed",
          historyReason: "manual_assign",
        }),
      }),
    );
    expect(mockSendBookingConfirmationEmail).toHaveBeenCalledTimes(1);
    expect(mockSendBookingConfirmationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        id: BOOKING_ID,
        status: "confirmed",
        customer_email: "guest@example.com",
      }),
    );
  });

  it("propagates RPC conflicts with structured payload", async () => {
    const { AssignTablesRpcError } = await import("@/server/capacity/holds");
    mockConfirmHoldAssignment.mockRejectedValueOnce(
      new AssignTablesRpcError({
        code: "409",
        message: "duplicate",
        details: "conflict",
        hint: null,
      } as unknown),
    );

    const request = new Request("http://localhost/api/staff/manual/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId: BOOKING_ID, holdId: HOLD_ID, idempotencyKey: "key-2", contextVersion: "ctx-1" }),
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
      } as unknown),
    );

    const request = new Request("http://localhost/api/staff/manual/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId: BOOKING_ID, holdId: HOLD_ID, idempotencyKey: "key-3", contextVersion: "ctx-1" }),
    }) as unknown as NextRequest;

    const response = await confirmPost(request);
    expect(response.status).toBe(422);
    const payload = await response.json();
    expect(payload.code).toBe("ASSIGNMENT_VALIDATION");
    expect(payload.error).toBe("Tables must be adjacent");
  });

  it("skips email when booking is already confirmed", async () => {
    serviceContext.bookingRow = serviceContext.bookingRow
      ? { ...serviceContext.bookingRow, status: "confirmed" }
      : serviceContext.bookingRow;

    const request = new Request("http://localhost/api/staff/manual/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId: BOOKING_ID, holdId: HOLD_ID, idempotencyKey: "key-4", contextVersion: "ctx-1" }),
    }) as unknown as NextRequest;

    const response = await confirmPost(request);
    expect(response.status).toBe(200);
    expect(mockSendBookingConfirmationEmail).not.toHaveBeenCalled();
  });

  it("honors global email suppression flag", async () => {
    process.env.SUPPRESS_EMAILS = "true";
    try {
      const request = new Request("http://localhost/api/staff/manual/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: BOOKING_ID,
          holdId: HOLD_ID,
          idempotencyKey: "key-5",
          contextVersion: "ctx-1",
        }),
      }) as unknown as NextRequest;

      const response = await confirmPost(request);
      expect(response.status).toBe(200);
      expect(mockSendBookingConfirmationEmail).not.toHaveBeenCalled();
    } finally {
      delete process.env.SUPPRESS_EMAILS;
    }
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
