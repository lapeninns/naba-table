process.env.BASE_URL = "http://localhost:3000";
process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";

import { describe, expect, it, vi } from "vitest";

import { AssignTablesRpcError } from "@/server/capacity/holds";
import { getVenuePolicy, ServiceOverrunError } from "@/server/capacity/policy";

vi.mock("@/server/feature-flags", () => ({
  isSelectorScoringEnabled: () => false,
  isOpsMetricsEnabled: () => false,
  isAllocatorAdjacencyRequired: () => true,
  getAllocatorAdjacencyMinPartySize: () => null,
  getAllocatorKMax: () => 3,
  getSelectorPlannerLimits: () => ({}),
  isHoldsEnabled: () => false,
  isCombinationPlannerEnabled: () => false,
}));

const { isTableAvailableV2, isTableAvailable } = await import("@/server/capacity/tables");

type SupabaseResponse = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[] | null;
  error: {
    message?: string;
    details?: string | null;
    hint?: string | null;
    code?: string | null;
  } | null;
};

function createClient(response: SupabaseResponse) {
  return {
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve(response),
      }),
    }),
  } as const;
}

describe("isTableAvailableV2", () => {
  it("detects buffer collisions from existing assignments", async () => {
    const rows = [
      {
        table_id: "table-1",
        start_at: "2025-10-26T18:00:00Z",
        end_at: "2025-10-26T19:35:00Z",
        bookings: {
          id: "booking-existing",
          status: "confirmed",
        },
      },
    ];

    const client = createClient({ data: rows, error: null });
    const policy = getVenuePolicy();

    await expect(
      isTableAvailableV2("table-1", "2025-10-26T19:30:00Z", 2, {
        client,
        policy,
      }),
    ).resolves.toBe(false);

    await expect(
      isTableAvailableV2("table-1", "2025-10-26T20:00:00Z", 2, {
        client,
        policy,
      }),
    ).resolves.toBe(true);
  });

  it("ignores the excluded booking when checking availability", async () => {
    const rows = [
      {
        table_id: "table-1",
        start_at: "2025-10-26T18:00:00Z",
        end_at: "2025-10-26T19:35:00Z",
        bookings: {
          id: "booking-edit",
          status: "confirmed",
        },
      },
    ];

    const client = createClient({ data: rows, error: null });
    const policy = getVenuePolicy();

    await expect(
      isTableAvailableV2("table-1", "2025-10-26T18:00:00Z", 2, {
        client,
        policy,
        excludeBookingId: "booking-edit",
      }),
    ).resolves.toBe(true);
  });
  it("throws ServiceOverrunError when fallback window would overrun service", async () => {
    const policy = getVenuePolicy({ timezone: "Europe/London" });
    const client = createClient({ data: [], error: null });

    await expect(
      isTableAvailableV2("table-1", "2025-10-26T23:30:00+01:00", 2, {
        client,
        policy,
      }),
    ).rejects.toThrow(ServiceOverrunError);
  });

  it("throws AssignTablesRpcError when Supabase returns an error", async () => {
    const policy = getVenuePolicy();
    const client = createClient({
      data: null,
      error: { message: "Database offline", details: "timeout", hint: null, code: "P0001" },
    });

    await expect(
      isTableAvailableV2("table-1", "2025-10-26T18:00:00Z", 2, {
        client,
        policy,
      }),
    ).rejects.toThrow(AssignTablesRpcError);
  });

  it("wraps availability errors with a stable AssignTablesRpcError message", async () => {
    const policy = getVenuePolicy();
    const client = createClient({
      data: null,
      error: { message: "Database offline", details: "timeout", hint: "retry", code: "P0001" },
    });

    await expect(
      isTableAvailable("table-1", "2025-10-26T18:00:00Z", 2, {
        client,
        policy,
      }),
    ).rejects.toMatchObject({
      message: "Failed to verify table availability",
      code: "TABLE_AVAILABILITY_QUERY_FAILED",
    });
  });
});
