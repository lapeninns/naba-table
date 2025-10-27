process.env.BASE_URL = "http://localhost:3000";
process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";

import { describe, expect, it, vi } from "vitest";

import { getVenuePolicy } from "@/server/capacity/policy";
import type { Table } from "@/server/capacity/tables";

vi.mock("@/server/feature-flags", () => ({
  isSelectorScoringEnabled: () => false,
  isOpsMetricsEnabled: () => false,
  isAllocatorAdjacencyRequired: () => true,
  getAllocatorKMax: () => 3,
  isHoldsEnabled: () => false,
  isCombinationPlannerEnabled: () => false,
}));

const tablesModule = await import("@/server/capacity/tables");
const { __internal } = tablesModule;

const { filterAvailableTables, computeBookingWindow } = __internal;

describe("filterAvailableTables", () => {
  it("excludes tables exceeding maxPartySize", () => {
    const policy = getVenuePolicy();
    const window = computeBookingWindow({
      startISO: "2025-10-26T18:00:00Z",
      partySize: 3,
      policy,
    });

    if (!window) {
      throw new Error("Failed to compute booking window for test");
    }

    const tables: Table[] = [
      {
        id: "table-small",
        tableNumber: "S1",
        capacity: 2,
        minPartySize: 1,
        maxPartySize: 2,
        section: "Main",
        category: "dining",
        seatingType: "standard",
        mobility: "fixed",
        zoneId: "zone-main",
        status: "available",
        active: true,
        position: null,
      },
    ];

    const result = filterAvailableTables(tables, 3, window, new Map(), undefined, undefined);
    expect(result).toHaveLength(0);
  });
});
