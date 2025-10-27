import { describe, expect, it } from "vitest";

import { getSelectorScoringConfig } from "@/server/capacity/policy";
import { buildScoredTablePlans } from "@/server/capacity/selector";

import type { Table } from "@/server/capacity/tables";

import {
  TABLE_IDS,
  createAllocatorLayoutFixture,
  pickTables,
  sliceAdjacency,
} from "../../fixtures/layout";

describe("buildScoredTablePlans", () => {
  const config = getSelectorScoringConfig();

  it("prefers a single table when capacity fits exactly", () => {
    const layout = createAllocatorLayoutFixture();
    const tables = pickTables(layout.tableMap, [
      TABLE_IDS.mainSixTop,
      TABLE_IDS.mainMergeA,
      TABLE_IDS.mainMergeB,
    ]);
    const adjacency = sliceAdjacency(layout.adjacencyMap, new Set(tables.map((table) => table.id)));

    const { plans } = buildScoredTablePlans({
      tables,
      partySize: 5,
      adjacency,
      config,
    });

    expect(plans[0]?.tables.map((table) => table.id)).toEqual([TABLE_IDS.mainSixTop]);
  });

  it("is deterministic regardless of table ordering", () => {
    const layout = createAllocatorLayoutFixture();
    const baseTables = pickTables(layout.tableMap, [
      TABLE_IDS.mainMergeA,
      TABLE_IDS.mainMergeB,
      TABLE_IDS.loungeHighTop,
    ]);

    const adjacency = sliceAdjacency(layout.adjacencyMap, new Set(baseTables.map((table) => table.id)));

    const permutations = permute(baseTables);
    const expectedTopKey = buildScoredTablePlans({ tables: baseTables, partySize: 5, adjacency, config }).plans[0]?.tableKey;

    for (const tables of permutations) {
      const { plans } = buildScoredTablePlans({ tables, partySize: 5, adjacency, config });
      expect(plans[0]?.tableKey).toBe(expectedTopKey);
    }
  });

  it("penalises higher overage even when lexicographic order would differ", () => {
    const layout = createAllocatorLayoutFixture();
    const tables = pickTables(layout.tableMap, [TABLE_IDS.loungeHighTop, TABLE_IDS.mainSixTop]);
    const adjacency = new Map<string, Set<string>>();

    const { plans } = buildScoredTablePlans({ tables, partySize: 4, adjacency, config });

    expect(plans[0]?.tables[0]?.id).toBe(TABLE_IDS.loungeHighTop);
    expect(plans[0]?.metrics?.overage).toBe(0);
    expect(plans[1]?.metrics?.overage).toBeGreaterThan(0);
  });

  it("enumerates multi-table combinations when enabled", () => {
    const tables: Table[] = [
      {
        id: "combo-a",
        tableNumber: "C1",
        capacity: 4,
        minPartySize: 2,
        maxPartySize: 8,
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
        id: "combo-b",
        tableNumber: "C2",
        capacity: 4,
        minPartySize: 2,
        maxPartySize: 8,
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

    const adjacency = new Map<string, Set<string>>([
      ["combo-a", new Set(["combo-b"])],
      ["combo-b", new Set(["combo-a"])],
    ]);

    const result = buildScoredTablePlans({
      tables,
      partySize: 7,
      adjacency,
      config,
      enableCombinations: true,
      kMax: 3,
    });

    const topPlan = result.plans[0];
    expect(topPlan?.tables.map((table) => table.id)).toEqual(["combo-a", "combo-b"]);
    expect(topPlan?.slack).toBe(1);
    expect(result.diagnostics.combinationsEnumerated).toBeGreaterThan(0);
    expect(result.diagnostics.combinationsAccepted).toBeGreaterThan(0);
  });

  it("prunes combinations that violate adjacency or kMax", () => {
    const tables: Table[] = [
      {
        id: "combo-a",
        tableNumber: "A",
        capacity: 4,
        minPartySize: 2,
        maxPartySize: 8,
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
        id: "combo-b",
        tableNumber: "B",
        capacity: 4,
        minPartySize: 2,
        maxPartySize: 8,
        section: "Patio",
        category: "dining",
        seatingType: "standard",
        mobility: "fixed",
        zoneId: "zone-main",
        status: "available",
        active: true,
        position: null,
      },
      {
        id: "combo-c",
        tableNumber: "C",
        capacity: 4,
        minPartySize: 2,
        maxPartySize: 8,
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

    const adjacency = new Map<string, Set<string>>([
      ["combo-a", new Set(["combo-c"])],
      ["combo-c", new Set(["combo-a"])],
    ]);

    const result = buildScoredTablePlans({
      tables,
      partySize: 9,
      adjacency,
      config,
      enableCombinations: true,
      kMax: 2,
    });

    expect(result.plans.length).toBe(0);
    expect(result.diagnostics.skipped.capacity).toBeGreaterThanOrEqual(1);
  });

  it("allows disconnected combinations when adjacency is optional", () => {
    const tables: Table[] = [
      {
        id: "combo-a",
        tableNumber: "A",
        capacity: 4,
        minPartySize: 2,
        maxPartySize: 8,
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
        id: "combo-b",
        tableNumber: "B",
        capacity: 4,
        minPartySize: 2,
        maxPartySize: 8,
        section: "Patio",
        category: "dining",
        seatingType: "standard",
        mobility: "fixed",
        zoneId: "zone-main",
        status: "available",
        active: true,
        position: null,
      },
    ];

    const adjacency = new Map<string, Set<string>>();

    const result = buildScoredTablePlans({
      tables,
      partySize: 6,
      adjacency,
      config,
      enableCombinations: true,
      kMax: 2,
      requireAdjacency: false,
    });

    expect(result.plans.length).toBeGreaterThan(0);
    expect(result.plans[0]?.tables.map((table) => table.id).sort()).toEqual(["combo-a", "combo-b"]);
    expect(result.plans[0]?.adjacencyStatus).toBe("disconnected");
  });
});

function permute<T>(items: T[]): T[][] {
  if (items.length <= 1) {
    return [items];
  }

  const result: T[][] = [];
  items.forEach((item, index) => {
    const remaining = [...items.slice(0, index), ...items.slice(index + 1)];
    for (const permutation of permute(remaining)) {
      result.push([item, ...permutation]);
    }
  });
  return result;
}
