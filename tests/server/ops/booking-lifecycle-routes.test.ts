process.env.BASE_URL = "http://localhost:3000";
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "test-service-key";

import { beforeAll, beforeEach, describe, expect, it, vi, afterEach } from "vitest";

import { env } from "@/lib/env";
import type { Tables } from "@/types/supabase";

const mockGetRouteHandlerSupabaseClient = vi.fn();
const mockGetServiceSupabaseClient = vi.fn();
const mockListBookingHistory = vi.fn();

vi.mock("@/server/supabase", () => ({
  getRouteHandlerSupabaseClient: mockGetRouteHandlerSupabaseClient,
  getServiceSupabaseClient: mockGetServiceSupabaseClient,
}));

const mockRequireMembershipForRestaurant = vi.fn();
const mockFetchUserMemberships = vi.fn();
vi.mock("@/server/team/access", () => ({
  requireMembershipForRestaurant: mockRequireMembershipForRestaurant,
  fetchUserMemberships: mockFetchUserMemberships,
}));

vi.mock("@/server/ops/booking-lifecycle/history", () => ({
  listBookingHistory: mockListBookingHistory,
}));

const AUTH_USER = { id: "user-1" };
const RESTAURANT_ID = "2f66c610-03d5-4bb4-ae37-6152c7bea999";

const baseAuthClient = {
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: AUTH_USER }, error: null }),
  },
};

function createEmptyRequest(body?: Record<string, unknown>) {
  const headers = new Headers({ "Content-Type": "application/json" });
  return {
    headers,
    json: async () => body ?? {},
  } as unknown as Request;
}

type BookingRow =
  | ({
      id: string;
      restaurant_id: string;
      status: "confirmed" | "completed" | "cancelled" | "no_show" | "checked_in";
      checked_in_at: string | null;
      checked_out_at: string | null;
      booking_date?: string | null;
      start_time?: string | null;
    })
  | Tables<"bookings">;

describe("booking lifecycle routes", () => {
  let postCheckIn: typeof import("@/app/api/ops/bookings/[id]/check-in/route").POST;
  let postCheckOut: typeof import("@/app/api/ops/bookings/[id]/check-out/route").POST;
  let getStatusSummary: typeof import("@/app/api/ops/bookings/status-summary/route").GET;
  let postNoShow: typeof import("@/app/api/ops/bookings/[id]/no-show/route").POST;
  let postUndoNoShow: typeof import("@/app/api/ops/bookings/[id]/undo-no-show/route").POST;
  let getBookingHistory: typeof import("@/app/api/ops/bookings/[id]/history/route").GET;
  let featureFlagsSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeAll(async () => {
    ({ POST: postCheckIn } = await import("@/app/api/ops/bookings/[id]/check-in/route"));
    ({ POST: postCheckOut } = await import("@/app/api/ops/bookings/[id]/check-out/route"));
    ({ GET: getStatusSummary } = await import("@/app/api/ops/bookings/status-summary/route"));
    ({ POST: postNoShow } = await import("@/app/api/ops/bookings/[id]/no-show/route"));
    ({ POST: postUndoNoShow } = await import("@/app/api/ops/bookings/[id]/undo-no-show/route"));
    ({ GET: getBookingHistory } = await import("@/app/api/ops/bookings/[id]/history/route"));
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-10-16T22:30:00Z"));

    mockGetRouteHandlerSupabaseClient.mockResolvedValue(baseAuthClient);
    mockRequireMembershipForRestaurant.mockResolvedValue({
      restaurant_id: RESTAURANT_ID,
      user_id: AUTH_USER.id,
    });
    mockFetchUserMemberships.mockResolvedValue([
      {
        restaurant_id: RESTAURANT_ID,
      },
    ]);

    const flags = {
      ...env.featureFlags,
      bookingLifecycleV2: true,
    };
    featureFlagsSpy = vi.spyOn(env, "featureFlags", "get").mockReturnValue(flags);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    featureFlagsSpy?.mockRestore();
  });

  function buildBookingSelectChain(row: BookingRow) {
    const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    return { select, eq, maybeSingle };
  }

  function buildHistorySelectChain(row: Tables<"booking_state_history">["Row"] | null) {
    const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
    const limit = vi.fn().mockReturnValue({ maybeSingle });
    const order = vi.fn().mockReturnValue({ limit });
    const secondEq = vi.fn().mockReturnValue({ order });
    const firstEq = vi.fn().mockReturnValue({ eq: secondEq });
    const select = vi.fn().mockReturnValue({ eq: firstEq });
    return { select, firstEq, secondEq, order, limit, maybeSingle };
  }

function buildServiceClient(options: {
    booking: BookingRow;
    historyRow?: Tables<"booking_state_history">["Row"] | null;
    rpcResult?: {
      status: BookingRow["status"];
      checked_in_at: string | null;
      checked_out_at: string | null;
      updated_at: string;
    };
    restaurantTimezone?: string;
  }) {
    const bookingChain = buildBookingSelectChain(options.booking);
    const historyChain = buildHistorySelectChain(options.historyRow ?? null);
    const restaurantChain = (() => {
      const maybeSingle = vi.fn().mockResolvedValue({
        data: { timezone: options.restaurantTimezone ?? "UTC" },
        error: null,
      });
      const eq = vi.fn().mockReturnValue({ maybeSingle });
      const select = vi.fn().mockReturnValue({ eq });
      return { select };
    })();

    const rpcResult = options.rpcResult ?? {
      status: options.booking.status,
      checked_in_at: options.booking.checked_in_at,
      checked_out_at: options.booking.checked_out_at,
      updated_at: new Date().toISOString(),
    };

    const rpc = vi.fn().mockResolvedValue({ data: [rpcResult], error: null });

    const from = vi.fn((table: string) => {
      if (table === "bookings") {
        return {
          select: bookingChain.select,
        };
      }
      if (table === "booking_state_history") {
        return {
          select: historyChain.select,
        };
      }
      if (table === "restaurants") {
        return {
          select: restaurantChain.select,
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    mockGetServiceSupabaseClient.mockReturnValue({ from, rpc });

    return { from, rpc, bookingChain, historyChain, restaurantChain };
  }

  it("checks in a booking and marks it checked_in when lifecycle v2 enabled", async () => {
    const booking: BookingRow = {
      id: "booking-1",
      restaurant_id: RESTAURANT_ID,
      status: "confirmed",
      checked_in_at: null,
      checked_out_at: null,
      booking_date: "2025-10-16",
      start_time: "18:00",
    };

    const rpcRow = {
      status: "checked_in" as const,
      checked_in_at: new Date().toISOString(),
      checked_out_at: null,
      updated_at: new Date().toISOString(),
    };

    const mocks = buildServiceClient({ booking, rpcResult: rpcRow });

    const response = await postCheckIn(createEmptyRequest(), {
      params: Promise.resolve({ id: booking.id }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe("checked_in");
    expect(data.checkedInAt).toMatch(/2025-10-16T22:30:00.000Z/);
    expect(data.checkedOutAt).toBeNull();

    expect(mocks.rpc).toHaveBeenCalledWith(
      "apply_booking_state_transition",
      expect.objectContaining({
        p_status: "checked_in",
        p_booking_id: booking.id,
      }),
    );
  });

  it("checks in a booking even when the lifecycle flag is disabled", async () => {
    featureFlagsSpy?.mockRestore();
    featureFlagsSpy = vi.spyOn(env, "featureFlags", "get").mockReturnValue({
      ...env.featureFlags,
      bookingLifecycleV2: false,
    });

    const booking: BookingRow = {
      id: "booking-legacy-1",
      restaurant_id: RESTAURANT_ID,
      status: "confirmed",
      checked_in_at: null,
      checked_out_at: null,
      booking_date: "2025-10-16",
      start_time: "18:30",
    };

    const rpcRow = {
      status: "checked_in" as const,
      checked_in_at: new Date().toISOString(),
      checked_out_at: null,
      updated_at: new Date().toISOString(),
    };

    const mocks = buildServiceClient({ booking, rpcResult: rpcRow });

    const response = await postCheckIn(createEmptyRequest(), {
      params: Promise.resolve({ id: booking.id }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe("checked_in");
    expect(data.checkedInAt).toMatch(/2025-10-16T22:30:00.000Z/);
    expect(data.checkedOutAt).toBeNull();

    expect(mocks.rpc).toHaveBeenCalledWith(
      "apply_booking_state_transition",
      expect.objectContaining({
        p_status: "checked_in",
        p_booking_id: booking.id,
        p_checked_out_at: null,
      }),
    );
  });

  it("allows a booking to check out after an intermediate check-in", async () => {
    featureFlagsSpy?.mockRestore();
    featureFlagsSpy = vi.spyOn(env, "featureFlags", "get").mockReturnValue({
      ...env.featureFlags,
      bookingLifecycleV2: false,
    });

    const nowIso = new Date().toISOString();
    const booking: BookingRow = {
      id: "booking-legacy-2",
      restaurant_id: RESTAURANT_ID,
      status: "confirmed",
      checked_in_at: null,
      checked_out_at: null,
      booking_date: "2025-10-16",
      start_time: "19:15",
    };

    const checkInMocks = buildServiceClient({
      booking,
      rpcResult: {
        status: "checked_in",
        checked_in_at: nowIso,
        checked_out_at: null,
        updated_at: nowIso,
      },
    });

    const checkInResponse = await postCheckIn(createEmptyRequest(), {
      params: Promise.resolve({ id: booking.id }),
    });

    expect(checkInResponse.status).toBe(200);
    const checkInPayload = await checkInResponse.json();
    expect(checkInPayload.status).toBe("checked_in");
    expect(checkInPayload.checkedInAt).toMatch(/2025-10-16T22:30:00.000Z/);
    expect(checkInPayload.checkedOutAt).toBeNull();
    expect(checkInMocks.rpc).toHaveBeenCalledWith(
      "apply_booking_state_transition",
      expect.objectContaining({
        p_booking_id: booking.id,
        p_status: "checked_in",
        p_checked_out_at: null,
      }),
    );

    const checkedInBooking: BookingRow = {
      ...booking,
      status: "checked_in",
      checked_in_at: checkInPayload.checkedInAt,
      checked_out_at: null,
    };

    mockGetServiceSupabaseClient.mockReset();

    const checkOutRpc = vi.fn().mockResolvedValue({
      data: [
        {
          status: "completed" as const,
          checked_in_at: checkedInBooking.checked_in_at,
          checked_out_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      error: null,
    });

    const checkOutBookingChain = (() => {
      const maybeSingle = vi.fn().mockResolvedValue({ data: checkedInBooking, error: null });
      const eq = vi.fn().mockReturnValue({ maybeSingle });
      const select = vi.fn().mockReturnValue({ eq });
      return { select };
    })();

    const restaurantMaybeSingle = vi.fn().mockResolvedValue({ data: { timezone: "UTC" }, error: null });
    const restaurantEq = vi.fn().mockReturnValue({ maybeSingle: restaurantMaybeSingle });
    const restaurantSelect = vi.fn().mockReturnValue({ eq: restaurantEq });

    mockGetServiceSupabaseClient.mockReturnValue({
      from: (table: string) => {
        if (table === "bookings") {
          return {
            select: checkOutBookingChain.select,
          };
        }
        if (table === "booking_state_history") {
          return {
            select: vi.fn(),
          };
        }
        if (table === "restaurants") {
          return {
            select: restaurantSelect,
          };
        }
        throw new Error(`Unexpected table ${table}`);
      },
      rpc: checkOutRpc,
    });

    const checkOutResponse = await postCheckOut(createEmptyRequest(), {
      params: Promise.resolve({ id: booking.id }),
    });

    expect(checkOutResponse.status).toBe(200);
    const checkOutPayload = await checkOutResponse.json();
    expect(checkOutPayload.status).toBe("completed");
    expect(checkOutPayload.checkedOutAt).toMatch(/2025-10-16T22:30:00.000Z/);
    expect(checkOutRpc).toHaveBeenCalledWith(
      "apply_booking_state_transition",
      expect.objectContaining({
        p_booking_id: booking.id,
        p_status: "completed",
      }),
    );
  });

  it("rejects check-in when the booking is not on today's date", async () => {
    const booking: BookingRow = {
      id: "booking-out-of-range",
      restaurant_id: RESTAURANT_ID,
      status: "confirmed",
      checked_in_at: null,
      checked_out_at: null,
      booking_date: "2025-10-17",
      start_time: "18:00",
    };

    const mocks = buildServiceClient({ booking, restaurantTimezone: "UTC" });

    const response = await postCheckIn(createEmptyRequest(), {
      params: Promise.resolve({ id: booking.id }),
    });

    expect(response.status).toBe(409);
    const payload = await response.json();
    expect(payload.error).toContain("Lifecycle actions are only available on the reservation date");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects check-in for cancelled bookings", async () => {
    const booking: BookingRow = {
      id: "booking-2",
      restaurant_id: RESTAURANT_ID,
      status: "cancelled",
      checked_in_at: null,
      checked_out_at: null,
      booking_date: "2025-10-16",
      start_time: "19:00",
    };

    buildServiceClient({ booking });

    const response = await postCheckIn(createEmptyRequest(), {
      params: Promise.resolve({ id: booking.id }),
    });

    expect(response.status).toBe(409);
    const payload = await response.json();
    expect(payload.error).toMatch(/Transition from cancelled to checked_in/);
  });

  it("requires a prior check-in before check-out", async () => {
    const booking: BookingRow = {
      id: "booking-3",
      restaurant_id: RESTAURANT_ID,
      status: "confirmed",
      checked_in_at: null,
      checked_out_at: null,
      booking_date: "2025-10-16",
      start_time: "20:00",
    };

    buildServiceClient({ booking });

    const response = await postCheckOut(createEmptyRequest(), {
      params: Promise.resolve({ id: booking.id }),
    });

    expect(response.status).toBe(409);
    const payload = await response.json();
    expect(payload.error).toMatch(/must be checked in/);
  });

  it("checks out a previously checked-in booking", async () => {
    const booking: BookingRow = {
      id: "booking-4",
      restaurant_id: RESTAURANT_ID,
      status: "checked_in",
      checked_in_at: "2025-10-16T22:00:00.000Z",
      checked_out_at: null,
      booking_date: "2025-10-16",
      start_time: "17:30",
    };

    const rpcRow = {
      status: "completed" as const,
      checked_in_at: booking.checked_in_at,
      checked_out_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const mocks = buildServiceClient({ booking, rpcResult: rpcRow });

    const response = await postCheckOut(createEmptyRequest(), {
      params: Promise.resolve({ id: booking.id }),
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.status).toBe("completed");
    expect(payload.checkedOutAt).toMatch(/2025-10-16T22:30:00.000Z/);
    expect(payload.checkedInAt).toBe(booking.checked_in_at);

    expect(mocks.rpc).toHaveBeenCalledWith(
      "apply_booking_state_transition",
      expect.objectContaining({
        p_status: "completed",
        p_booking_id: booking.id,
      }),
    );
  });

  it("marks a booking as no-show and clears timestamps", async () => {
    const booking: BookingRow = {
      id: "booking-5",
      restaurant_id: RESTAURANT_ID,
      status: "confirmed",
      checked_in_at: null,
      checked_out_at: null,
      booking_date: "2025-10-16",
      start_time: "21:00",
    };

    const rpcRow = {
      status: "no_show" as const,
      checked_in_at: null,
      checked_out_at: null,
      updated_at: new Date().toISOString(),
    };

    const mocks = buildServiceClient({ booking, rpcResult: rpcRow });

    const response = await postNoShow(createEmptyRequest({ reason: "Guest cancelled" }), {
      params: Promise.resolve({ id: booking.id }),
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.status).toBe("no_show");
    expect(payload.checkedInAt).toBeNull();
    expect(payload.checkedOutAt).toBeNull();

    expect(mocks.rpc).toHaveBeenCalledWith(
      "apply_booking_state_transition",
      expect.objectContaining({
        p_status: "no_show",
      }),
    );
  });

  it("rejects marking a no-show when the booking is not on today's date", async () => {
    const booking: BookingRow = {
      id: "booking-no-show-out-of-range",
      restaurant_id: RESTAURANT_ID,
      status: "confirmed",
      checked_in_at: null,
      checked_out_at: null,
      booking_date: "2025-10-17",
      start_time: "21:00",
    };

    const mocks = buildServiceClient({ booking, restaurantTimezone: "UTC" });

    const response = await postNoShow(createEmptyRequest({ reason: "Guest no-show" }), {
      params: Promise.resolve({ id: booking.id }),
    });

    expect(response.status).toBe(409);
    const payload = await response.json();
    expect(payload.error).toContain("Lifecycle actions are only available on the reservation date");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("restores a no-show booking back to confirmed using last history entry", async () => {
    const booking: BookingRow = {
      id: "booking-6",
      restaurant_id: RESTAURANT_ID,
      status: "no_show",
      checked_in_at: null,
      checked_out_at: null,
      booking_date: "2025-10-16",
      start_time: "21:30",
    };

    const historyRow: Tables<"booking_state_history">["Row"] = {
      id: 42,
      booking_id: booking.id,
      from_status: "confirmed",
      to_status: "no_show",
      changed_by: AUTH_USER.id,
      changed_at: new Date("2025-10-16T22:10:00Z").toISOString(),
      reason: "Auto no-show",
      metadata: {
        previousStatus: "confirmed",
        previousCheckedInAt: null,
        previousCheckedOutAt: null,
      },
    };

    const rpcRow = {
      status: "confirmed" as const,
      checked_in_at: null,
      checked_out_at: null,
      updated_at: new Date().toISOString(),
    };

    const mocks = buildServiceClient({ booking, historyRow, rpcResult: rpcRow });

    const response = await postUndoNoShow(createEmptyRequest({ reason: "Guest arrived" }), {
      params: Promise.resolve({ id: booking.id }),
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.status).toBe("confirmed");
    expect(payload.checkedInAt).toBeNull();
    expect(payload.checkedOutAt).toBeNull();

    expect(mocks.rpc).toHaveBeenCalledWith(
      "apply_booking_state_transition",
      expect.objectContaining({
        p_status: "confirmed",
        p_history_metadata: expect.objectContaining({
          action: "undo-no-show",
          sourceHistoryId: historyRow.id,
        }),
      }),
    );
  });

  it("returns booking status summary counts", async () => {
    const summaryData = [
      { status: "confirmed" },
      { status: "checked_in" },
      { status: "checked_in" },
      { status: "no_show" },
    ];

    const lte = vi.fn().mockResolvedValue({ data: summaryData, error: null });
    const from = vi.fn((table: string) => {
      if (table !== "bookings") {
        throw new Error(`Unexpected table ${table}`);
      }
      return {
        select: () => ({
          eq: (column: string, value: string) => {
            if (column !== "restaurant_id") {
              throw new Error(`Unexpected column ${column}`);
            }
            return {
              gte: (_column: string, _value: string) => ({
                lte: (_column: string, _value: string) => lte(),
              }),
            };
          },
        }),
      };
    });

    mockGetServiceSupabaseClient.mockReturnValueOnce({
      from,
    });

    const request = {
      nextUrl: new URL(
        `http://localhost/api/ops/bookings/status-summary?restaurantId=${RESTAURANT_ID}&from=2025-10-16&to=2025-10-16`,
      ),
    } as unknown as import("next/server").NextRequest;

    const response = await getStatusSummary(request);
    const payload = await response.json();
    if (response.status !== 200) {
      throw new Error(`status-summary failed ${response.status}: ${JSON.stringify(payload)}`);
    }
    expect(payload.range).toEqual({ from: "2025-10-16", to: "2025-10-16" });
    expect(payload.totals.confirmed).toBe(1);
    expect(payload.totals.checked_in).toBe(2);
    expect(payload.totals.no_show).toBe(1);
  });

  it("returns booking lifecycle history entries", async () => {
    const booking: BookingRow = {
      id: "booking-history-1",
      restaurant_id: RESTAURANT_ID,
      status: "confirmed",
      checked_in_at: null,
      checked_out_at: null,
    };

    const bookingChain = buildBookingSelectChain(booking);

    const from = vi.fn((table: string) => {
      if (table === "bookings") {
        return {
          select: bookingChain.select,
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    mockGetServiceSupabaseClient.mockReturnValueOnce({ from });
    mockListBookingHistory.mockResolvedValue([
      {
        id: 1,
        bookingId: booking.id,
        fromStatus: "confirmed",
        toStatus: "checked_in",
        changedAt: "2025-10-16T22:00:00.000Z",
        changedBy: AUTH_USER.id,
        reason: "Guest arrived",
        metadata: { action: "check-in", performedAt: "2025-10-16T22:00:00.000Z" },
        actor: {
          id: AUTH_USER.id,
          name: "Ops User",
          email: "ops@example.com",
        },
      },
      {
        id: 2,
        bookingId: booking.id,
        fromStatus: "checked_in",
        toStatus: "completed",
        changedAt: "2025-10-16T23:15:00.000Z",
        changedBy: AUTH_USER.id,
        reason: null,
        metadata: { action: "check-out", performedAt: "2025-10-16T23:15:00.000Z" },
        actor: {
          id: AUTH_USER.id,
          name: "Ops User",
          email: "ops@example.com",
        },
      },
    ]);

    const request = {
      nextUrl: new URL(`http://localhost/api/ops/bookings/${booking.id}/history`),
    } as unknown as import("next/server").NextRequest;

    const response = await getBookingHistory(request, {
      params: Promise.resolve({ id: booking.id }),
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.bookingId).toBe(booking.id);
    expect(payload.entries).toHaveLength(2);
    expect(payload.entries[0]?.actor?.name).toBe("Ops User");
    expect(mockListBookingHistory).toHaveBeenCalledWith(booking.id);
  });
});
