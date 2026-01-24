import { describe, expect, it, vi, beforeEach } from "vitest";

import { createBookingWithCapacityCheck } from "@/server/capacity/transaction";
import { CapacityError } from "@/server/capacity/types";

vi.mock("@/server/supabase", () => ({
  getServiceSupabaseClient: () => ({
    rpc: (...args: unknown[]) => mockRpc(...args),
  }),
}));

vi.mock("@/server/observability", () => ({
  recordObservabilityEvent: vi.fn(),
}));

let mockRpc: (...args: unknown[]) => Promise<unknown>;

const baseParams = {
  restaurantId: "rest-1",
  customerId: "cust-1",
  bookingDate: "2025-10-10",
  startTime: "19:00",
  endTime: "21:00",
  partySize: 2,
  bookingType: "dinner",
  customerName: "Guest",
  customerEmail: "guest@example.com",
  customerPhone: "1234567890",
  seatingPreference: "any",
  notes: null,
  marketingOptIn: false,
  source: "api",
  authUserId: null,
  clientRequestId: "req-1",
  details: {},
  loyaltyPointsAwarded: 0,
};

describe("createBookingWithCapacityCheck", () => {
  beforeEach(() => {
    mockRpc = vi.fn();
    vi.clearAllMocks();
  });

  it("throws when capacity RPC is missing", async () => {
    mockRpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "42883", message: "function missing" },
    });

    await expect(createBookingWithCapacityCheck(baseParams)).rejects.toMatchObject({
      code: "CAPACITY_UNAVAILABLE",
    });
  });

  it("throws when RPC succeeds but no booking is returned", async () => {
    mockRpc = vi.fn().mockResolvedValue({
      data: { success: true, duplicate: false, booking: null },
      error: null,
    });

    await expect(createBookingWithCapacityCheck(baseParams)).rejects.toBeInstanceOf(CapacityError);
  });

  it("returns duplicate result when idempotency key already exists", async () => {
    const booking = { id: "b-1", restaurant_id: "rest-1" };
    mockRpc = vi.fn().mockResolvedValue({
      data: { success: true, duplicate: true, booking },
      error: null,
    });

    const result = await createBookingWithCapacityCheck(baseParams);
    expect(result.success).toBe(true);
    expect(result.duplicate).toBe(true);
    expect(result.booking).toEqual(booking);
  });

  it("returns operating-hours error details from the RPC", async () => {
    mockRpc = vi.fn().mockResolvedValue({
      data: {
        success: false,
        error: "BOOKING_OUTSIDE_OPERATING_HOURS",
        message: "The requested time is outside configured operating hours.",
        details: { timezone: "Europe/London" },
        retryable: false,
      },
      error: null,
    });

    const result = await createBookingWithCapacityCheck(baseParams);
    expect(result.success).toBe(false);
    expect(result.error).toBe("BOOKING_OUTSIDE_OPERATING_HOURS");
    expect(result.details).toEqual({ timezone: "Europe/London" });
  });
});
