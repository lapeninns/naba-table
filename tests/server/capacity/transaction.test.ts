process.env.BASE_URL ??= "http://localhost:3000";

import { beforeEach, describe, expect, it, vi } from "vitest";

const insertBookingRecordMock = vi.fn();
const generateUniqueBookingReferenceMock = vi.fn();
const recordObservabilityEventMock = vi.fn();

vi.mock("@/server/bookings", () => ({
  insertBookingRecord: (...args: unknown[]) => insertBookingRecordMock(...args),
  generateUniqueBookingReference: (...args: unknown[]) => generateUniqueBookingReferenceMock(...args),
}));

vi.mock("@/server/observability", () => ({
  recordObservabilityEvent: (...args: unknown[]) => recordObservabilityEventMock(...args),
}));

vi.mock("@/server/supabase", () => ({
  getServiceSupabaseClient: vi.fn(() => ({
    rpc: vi.fn(),
    from: vi.fn(),
  })),
}));

import { createBookingWithCapacityCheck } from "@/server/capacity/transaction";
import type { BookingRecord } from "@/server/capacity/types";

type SupabaseLike = {
  rpc: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
};

const baseBooking: BookingRecord = {
  id: "booking-1",
  restaurant_id: "restaurant-1",
  customer_id: "customer-1",
  booking_date: "2025-10-21",
  start_time: "19:00",
  end_time: "21:00",
  start_at: "2025-10-21T19:00:00Z",
  end_at: "2025-10-21T21:00:00Z",
  party_size: 2,
  booking_type: "dinner",
  seating_preference: "any",
  status: "confirmed",
  reference: "REF123456",
  customer_name: "Ada Lovelace",
  customer_email: "ada@example.com",
  customer_phone: "0123456789",
  notes: null,
  marketing_opt_in: false,
  loyalty_points_awarded: 0,
  source: "api",
  auth_user_id: null,
  idempotency_key: "idem-1",
  details: null,
  created_at: "2025-10-21T18:30:00Z",
  updated_at: "2025-10-21T18:30:00Z",
};

function createSupabaseStub(options: { existing?: BookingRecord | null }): SupabaseLike {
  const query: any = {
    select: vi.fn().mockImplementation(() => query),
    eq: vi.fn().mockImplementation(() => query),
    maybeSingle: vi.fn().mockResolvedValue({ data: options.existing ?? null, error: null }),
  };

  return {
    rpc: vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "PGRST202",
        message: "no matches were found in the schema cache",
      },
    }),
    from: vi.fn().mockImplementation((table: string) => {
      if (table !== "bookings") {
        throw new Error(`Unexpected table lookup: ${table}`);
      }
      return query;
    }),
  };
}

const params = {
  restaurantId: "restaurant-1",
  customerId: "customer-1",
  bookingDate: "2025-10-21",
  startTime: "19:00",
  endTime: "21:00",
  partySize: 2,
  bookingType: "dinner",
  customerName: "Ada Lovelace",
  customerEmail: "ada@example.com",
  customerPhone: "0123456789",
  seatingPreference: "any" as any,
  notes: null,
  marketingOptIn: false,
  idempotencyKey: "idem-1",
  source: "api",
  authUserId: null,
  clientRequestId: "client-req-1",
  details: null,
};

describe("createBookingWithCapacityCheck (fallback)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("falls back to direct insertion when the legacy RPC is missing", async () => {
    const supabase = createSupabaseStub({ existing: null });
    generateUniqueBookingReferenceMock.mockResolvedValueOnce("REF999999");
    insertBookingRecordMock.mockResolvedValueOnce(baseBooking);

    const result = await createBookingWithCapacityCheck(params, supabase as unknown as any);

    expect(supabase.rpc).toHaveBeenCalledWith(
      "create_booking_with_capacity_check",
      expect.objectContaining({ p_restaurant_id: params.restaurantId }),
    );
    expect(generateUniqueBookingReferenceMock).toHaveBeenCalledTimes(1);
    expect(insertBookingRecordMock).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        restaurant_id: params.restaurantId,
        customer_id: params.customerId,
        idempotency_key: params.idempotencyKey,
        details: expect.objectContaining({
          channel: "api.capacity_removed",
          fallback: "missing_capacity_rpc",
        }),
      }),
    );
    expect(result.success).toBe(true);
    expect(result.duplicate).toBe(false);
    expect(result.booking).toEqual(baseBooking);
  });

  it("reuses an existing booking when the idempotency key already exists", async () => {
    const supabase = createSupabaseStub({ existing: baseBooking });
    generateUniqueBookingReferenceMock.mockResolvedValueOnce("REF999999");
    insertBookingRecordMock.mockResolvedValueOnce(baseBooking);

    const result = await createBookingWithCapacityCheck(params, supabase as unknown as any);

    expect(result.success).toBe(true);
    expect(result.duplicate).toBe(true);
    expect(result.booking).toEqual(baseBooking);
    expect(insertBookingRecordMock).not.toHaveBeenCalled();
  });
});
