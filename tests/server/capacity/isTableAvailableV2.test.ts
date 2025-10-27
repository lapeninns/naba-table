process.env.BASE_URL = "http://localhost:3000";
process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";

import { describe, expect, it, vi } from "vitest";

import { getVenuePolicy } from "@/server/capacity/policy";

vi.mock("@/server/feature-flags", () => ({
  isSelectorScoringEnabled: () => false,
  isOpsMetricsEnabled: () => false,
  isAllocatorAdjacencyRequired: () => true,
  getAllocatorKMax: () => 3,
  isHoldsEnabled: () => false,
  isCombinationPlannerEnabled: () => false,
}));

const { isTableAvailableV2 } = await import("@/server/capacity/tables");

function createClient(rows: any[]) {
  return {
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({ data: rows, error: null }),
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

    const client = createClient(rows);
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

    const client = createClient(rows);
    const policy = getVenuePolicy();

    await expect(
      isTableAvailableV2("table-1", "2025-10-26T18:00:00Z", 2, {
        client,
        policy,
        excludeBookingId: "booking-edit",
      }),
    ).resolves.toBe(true);
  });
});
