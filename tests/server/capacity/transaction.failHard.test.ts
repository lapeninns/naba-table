import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Database } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/server/observability", () => ({
  recordObservabilityEvent: vi.fn(),
}));

const REQUIRED_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-key",
};

type RpcResponse = {
  data: unknown;
  error: { code?: string; message?: string; details?: string | null } | null;
};

function createSupabaseClient(response: RpcResponse): SupabaseClient<Database, "public"> {
  return {
    rpc: vi.fn().mockResolvedValue(response),
  } as unknown as SupabaseClient<Database, "public">;
}

describe("createBookingWithCapacityCheck fail-hard mode", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NODE_ENV = "test";
    for (const [key, value] of Object.entries(REQUIRED_ENV)) {
      process.env[key] = value;
    }
  });

  it("skips fallback path when fail-hard flag enabled", async () => {
    const supabaseClient = createSupabaseClient({
      data: null,
      error: {
        code: "PGRST202",
        message: "Function create_booking_with_capacity_check does not exist",
        details: null,
      },
    });

    vi.doMock("@/server/supabase", () => ({
      getServiceSupabaseClient: () => supabaseClient,
    }));

    const featureFlagsModule = await import("@/server/feature-flags");
    const observability = await import("@/server/observability");
    const transactions = await import("@/server/capacity/transaction");

    vi.spyOn(featureFlagsModule, "isAllocatorServiceFailHard").mockReturnValue(true);

    await expect(
      transactions.createBookingWithCapacityCheck(
        {
          restaurantId: "restaurant-fixture",
          customerId: "customer-fixture",
          bookingDate: "2025-01-20",
          startTime: "18:00",
          endTime: "20:00",
          partySize: 4,
          bookingType: "dinner",
          customerName: "Fail Hard Guest",
          customerEmail: "fail.hard@example.com",
          customerPhone: "+15555550009",
          seatingPreference: "any",
          source: "test",
          details: {},
        },
        supabaseClient,
      ),
    ).rejects.toThrow("Capacity enforcement unavailable");

    expect(observability.recordObservabilityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "booking.creation.fallback_skipped",
      }),
    );
    expect(supabaseClient.rpc).toHaveBeenCalledTimes(1);
  });
});
