import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetEnvCache } from "../../lib/env";

import type { Database } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

const mockLoyalty = vi.fn().mockResolvedValue(new Map());
const mockProfiles = vi.fn().mockResolvedValue(new Map());

vi.mock("@/server/ops/loyalty", () => ({
  getLoyaltyPointsForCustomers: mockLoyalty,
}));

vi.mock("@/server/ops/customer-profiles", () => ({
  getCustomerProfilesForCustomers: mockProfiles,
}));

type MockSupabase = {
  client: SupabaseClient<Database, "public">;
  spies: {
    restaurantMaybeSingle: ReturnType<typeof vi.fn>;
    bookingsOrder: ReturnType<typeof vi.fn>;
    bookingVersionsLimit: ReturnType<typeof vi.fn>;
  };
};

function createMockClient(): MockSupabase {
  const restaurantMaybeSingle = vi.fn().mockResolvedValue({ data: { timezone: "Europe/London" }, error: null });
  const restaurantEq = vi.fn().mockReturnThis();
  const restaurantSelect = vi.fn().mockReturnValue({
    eq: restaurantEq,
    maybeSingle: restaurantMaybeSingle,
  });

  const bookingsOrder = vi.fn().mockResolvedValue({
    data: [
      {
        id: "booking-1",
        status: "confirmed",
        start_time: "2025-02-01T18:00:00.000Z",
        end_time: "2025-02-01T19:00:00.000Z",
        party_size: 2,
        customer_name: "Guest One",
        customer_email: "guest@example.com",
        customer_phone: "123456789",
        notes: null,
        reference: "ABC123",
        details: null,
        source: "web",
        checked_in_at: null,
        checked_out_at: null,
        customer_id: "cust-1",
        booking_table_assignments: [],
      },
    ],
    error: null,
  });

  const bookingsEq = vi.fn().mockReturnThis();
  const bookingsSelect = vi.fn().mockReturnValue({
    eq: bookingsEq,
    order: bookingsOrder,
  });

  const bookingVersionsLimit = vi.fn().mockResolvedValue({
    data: [
      {
        version_id: "v1",
        booking_id: "booking-1",
        change_type: "created",
        changed_at: "2025-02-01T10:00:00.000Z",
        changed_by: null,
        old_data: null,
        new_data: null,
        bookings: { customer_name: "Guest One", reference: "ABC123" },
      },
    ],
    error: null,
  });

  const bookingVersionsOrder = vi.fn().mockReturnValue({ limit: bookingVersionsLimit });
  const bookingVersionsChain = {
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: bookingVersionsOrder,
  };
  const bookingVersionsSelect = vi.fn().mockReturnValue(bookingVersionsChain);

  const from = vi.fn((table: string) => {
    if (table === "restaurants") return { select: restaurantSelect };
    if (table === "bookings") return { select: bookingsSelect };
    if (table === "booking_versions") return { select: bookingVersionsSelect };
    throw new Error(`Unexpected table ${table}`);
  });

  const client = { from } as unknown as SupabaseClient<Database, "public">;

  return {
    client,
    spies: {
      restaurantMaybeSingle,
      bookingsOrder,
      bookingVersionsLimit,
    },
  };
}

describe("ops bookings caching", () => {
  beforeEach(() => {
    vi.resetModules();
    mockLoyalty.mockClear();
    mockProfiles.mockClear();
    process.env.OPS_SUMMARY_CACHE_TTL_MS = "10000";
    process.env.OPS_CHANGES_CACHE_TTL_MS = "10000";
    process.env.OPS_RESTAURANT_META_CACHE_TTL_MS = "600000";
    process.env.OPS_CACHE_MAX_ENTRIES = "50";
    resetEnvCache();
  });

  afterEach(() => {
    delete process.env.OPS_SUMMARY_CACHE_TTL_MS;
    delete process.env.OPS_CHANGES_CACHE_TTL_MS;
    delete process.env.OPS_RESTAURANT_META_CACHE_TTL_MS;
    delete process.env.OPS_CACHE_MAX_ENTRIES;
    resetEnvCache();
  });

  it("returns cached summary on repeat calls within TTL", async () => {
    const { client, spies } = createMockClient();
    const { getTodayBookingsSummary, __resetOpsBookingsCachesForTest } = await import("@/server/ops/bookings");

    __resetOpsBookingsCachesForTest();

    const first = await getTodayBookingsSummary("rest-1", { client, targetDate: "2025-02-01" });
    const second = await getTodayBookingsSummary("rest-1", { client, targetDate: "2025-02-01" });

    expect(first).toEqual(second);
    expect(spies.bookingsOrder).toHaveBeenCalledTimes(1);
    expect(spies.restaurantMaybeSingle).toHaveBeenCalledTimes(1);
  });

  it("returns cached booking changes on repeat calls within TTL", async () => {
    const { client, spies } = createMockClient();
    const { getTodayBookingChanges, __resetOpsBookingsCachesForTest } = await import("@/server/ops/bookings");

    __resetOpsBookingsCachesForTest();

    await getTodayBookingChanges("rest-1", { client, date: "2025-02-01", limit: 20 });
    await getTodayBookingChanges("rest-1", { client, date: "2025-02-01", limit: 20 });

    expect(spies.bookingVersionsLimit).toHaveBeenCalledTimes(1);
  });
});
