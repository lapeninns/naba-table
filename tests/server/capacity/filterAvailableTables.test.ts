process.env.BASE_URL = "http://localhost:3000";
process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";

import { describe, expect, it, vi } from "vitest";

import { createAvailabilityBitset, markWindow } from "@/server/capacity/planner/bitset";
import { getVenuePolicy } from "@/server/capacity/policy";

import type { Table } from "@/server/capacity/tables";
import type * as FeatureFlags from "@/server/feature-flags";

vi.mock("@/server/feature-flags", async () => {
  const actual = await vi.importActual<typeof FeatureFlags>("@/server/feature-flags");
  return {
    ...actual,
    isSelectorScoringEnabled: () => false,
    isOpsMetricsEnabled: () => false,
    isAllocatorAdjacencyRequired: () => true,
    getAllocatorAdjacencyMinPartySize: () => null,
    getAllocatorKMax: () => 3,
    getSelectorPlannerLimits: () => ({}),
    isHoldsEnabled: () => false,
    isCombinationPlannerEnabled: () => false,
  };
});

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

  it("allows tables exceeding maxPartySize when violations are permitted", () => {
    const policy = getVenuePolicy();
    const window = computeBookingWindow({
      startISO: "2025-10-26T18:00:00Z",
      partySize: 6,
      policy,
    });
    if (!window) {
      throw new Error("Failed to compute booking window for test");
    }
    const tables: Table[] = [
      {
        id: "table-flex",
        tableNumber: "FLEX",
        capacity: 6,
        minPartySize: 1,
        maxPartySize: 4,
        section: "Main",
        category: "dining",
        seatingType: "standard",
        mobility: "movable",
        zoneId: "zone-main",
        status: "available",
        active: true,
        position: null,
      },
    ];
    const adjacency = new Map<string, Set<string>>([["table-flex", new Set()]]);
    const result = filterAvailableTables(
      tables,
      6,
      window,
      adjacency,
      undefined,
      undefined,
      {
        allowMaxPartySizeViolation: true,
      },
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("table-flex");
  });

  it("does not mutate adjacency map entries when enforcement is required", () => {
    const policy = getVenuePolicy();
    const window = computeBookingWindow({
      startISO: "2025-10-26T18:00:00Z",
      partySize: 4,
      policy,
    });
    if (!window) {
      throw new Error("Failed to compute booking window for test");
    }

    const adjacency = new Map<string, Set<string>>();
    const tables: Table[] = [
      {
        id: "table-a",
        tableNumber: "A1",
        capacity: 4,
        minPartySize: 1,
        maxPartySize: 4,
        section: "Main",
        category: "dining",
        seatingType: "standard",
        mobility: "movable",
        zoneId: "zone-main",
        status: "available",
        active: true,
        position: null,
      },
    ];

    const result = filterAvailableTables(tables, 4, window, adjacency, undefined, undefined);
    expect(result).toHaveLength(0);
    expect(adjacency.has("table-a")).toBe(false);
    expect(adjacency.size).toBe(0);
  });

  it("drops tables that overlap the target window when strict time pruning is enabled", () => {
    const policy = getVenuePolicy();
    const window = computeBookingWindow({
      startISO: "2025-10-26T18:00:00Z",
      partySize: 2,
      policy,
    });
    if (!window) {
      throw new Error("Failed to compute booking window for test");
    }

    const busyBitset = createAvailabilityBitset();
    markWindow(busyBitset, "2025-10-26T18:00:00Z", "2025-10-26T19:00:00Z");

    const busy: Map<string, { bitset: ReturnType<typeof createAvailabilityBitset>; windows: never[] }> = new Map();
    busy.set("table-busy", { bitset: busyBitset, windows: [] });

    const tables: Table[] = [
      {
        id: "table-busy",
        tableNumber: "B1",
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
      {
        id: "table-free",
        tableNumber: "F1",
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

    let statsCaptured: { prunedByTime: number; candidatesAfterTimePrune: number } | null = null;

    const adjacency = new Map<string, Set<string>>([
      ["table-busy", new Set()],
      ["table-free", new Set()],
    ]);
    const result = filterAvailableTables(
      tables,
      2,
      window,
      adjacency,
      undefined,
      undefined,
      {
        timeFilter: {
          busy,
          mode: "strict",
          captureStats: (stats) => {
            statsCaptured = stats;
          },
        },
      },
    );

    expect(result.map((table) => table.id)).toEqual(["table-free"]);
    expect(statsCaptured).toEqual({
      prunedByTime: 1,
      candidatesAfterTimePrune: 1,
      pruned_by_time: 1,
      candidates_after_time_prune: 1,
    });
  });
});
