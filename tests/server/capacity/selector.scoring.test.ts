import { describe, expect, it } from "vitest";

import { buildScoredTablePlans } from "@/server/capacity/selector";
import { getSelectorScoringConfig } from "@/server/capacity/policy";
import type { Table } from "@/server/capacity/tables";

function createTable(overrides: Partial<Table> & Pick<Table, "id">): Table {
  return {
    id: overrides.id,
    tableNumber: overrides.tableNumber ?? overrides.id,
    capacity: overrides.capacity ?? 0,
    minPartySize: overrides.minPartySize ?? 1,
    maxPartySize: overrides.maxPartySize ?? null,
    section: overrides.section ?? null,
    category: overrides.category ?? "dining",
    seatingType: overrides.seatingType ?? "standard",
    mobility: overrides.mobility ?? "movable",
    zoneId: overrides.zoneId ?? "zone-1",
    status: overrides.status ?? "available",
    active: overrides.active ?? true,
    mergeEligible: overrides.mergeEligible ?? true,
    position: overrides.position ?? null,
  } as Table;
}

function buildAdjacency(edges: Array<[string, string]>): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const [a, b] of edges) {
    if (!map.has(a)) {
      map.set(a, new Set());
    }
    map.get(a)!.add(b);
  }
  return map;
}

describe("buildScoredTablePlans", () => {
  const config = getSelectorScoringConfig();

  it("prefers a single table when capacity fits exactly", () => {
    const tables: Table[] = [
      createTable({ id: "t-single", tableNumber: "S6", capacity: 6, mergeEligible: false }),
      createTable({ id: "t-a", tableNumber: "M1", capacity: 3 }),
      createTable({ id: "t-b", tableNumber: "M2", capacity: 3 }),
    ];

    const adjacency = buildAdjacency([
      ["t-a", "t-b"],
      ["t-b", "t-a"],
    ]);

    const { plans } = buildScoredTablePlans({
      tables,
      partySize: 5,
      adjacency,
      config,
    });

    expect(plans[0]?.tables.map((table) => table.id)).toEqual(["t-single"]);
  });

  it("is deterministic regardless of table ordering", () => {
    const baseTables: Table[] = [
      createTable({ id: "a", tableNumber: "A", capacity: 2 }),
      createTable({ id: "b", tableNumber: "B", capacity: 4 }),
      createTable({ id: "c", tableNumber: "C", capacity: 6, mergeEligible: false }),
    ];

    const adjacency = buildAdjacency([
      ["a", "b"],
      ["b", "a"],
    ]);

    const permutations = permute(baseTables);
    const expectedTopKey = buildScoredTablePlans({ tables: baseTables, partySize: 5, adjacency, config }).plans[0]?.tableKey;

    for (const tables of permutations) {
      const { plans } = buildScoredTablePlans({ tables, partySize: 5, adjacency, config });
      expect(plans[0]?.tableKey).toBe(expectedTopKey);
    }
  });

  it("penalises higher overage even when lexicographic order would differ", () => {
    const tables: Table[] = [
      createTable({ id: "preferred", tableNumber: "Z4", capacity: 4, mergeEligible: false }),
      createTable({ id: "fallback", tableNumber: "A5", capacity: 5, mergeEligible: false }),
    ];

    const adjacency = new Map<string, Set<string>>();

    const { plans } = buildScoredTablePlans({ tables, partySize: 4, adjacency, config });

    expect(plans[0]?.tables[0]?.id).toBe("preferred");
    expect(plans[0]?.metrics?.overage).toBe(0);
    expect(plans[1]?.metrics?.overage).toBe(1);
  });

  it("produces a three-table merge when adjacency allows and singles are insufficient", () => {
    const tables: Table[] = [
      createTable({ id: "t1", tableNumber: "T1", capacity: 2 }),
      createTable({ id: "t2", tableNumber: "T2", capacity: 2 }),
      createTable({ id: "t3", tableNumber: "T3", capacity: 2 }),
    ];

    const adjacency = buildAdjacency([
      ["t1", "t2"],
      ["t2", "t1"],
      ["t2", "t3"],
      ["t3", "t2"],
      ["t1", "t3"],
      ["t3", "t1"],
    ]);

    const { plans, fallbackReason } = buildScoredTablePlans({ tables, partySize: 6, adjacency, config });

    expect(fallbackReason).toBeUndefined();
    expect(plans[0]?.tables).toHaveLength(3);
    expect(new Set(plans[0]?.tables.map((table) => table.id))).toEqual(new Set(["t1", "t2", "t3"]));
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
