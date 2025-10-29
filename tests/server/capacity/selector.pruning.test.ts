import { describe, expect, it } from "vitest";

import { getSelectorScoringConfig } from "@/server/capacity/policy";
import { buildScoredTablePlans } from "@/server/capacity/selector";

import type { Table } from "@/server/capacity/tables";

function createTable(id: string, capacity: number, overrides: Partial<Table> = {}): Table {
  return {
    id,
    tableNumber: overrides.tableNumber ?? id.toUpperCase(),
    capacity,
    minPartySize: overrides.minPartySize ?? 1,
    maxPartySize: overrides.maxPartySize ?? null,
    section: overrides.section ?? null,
    category: overrides.category ?? "dining",
    seatingType: overrides.seatingType ?? "standard",
    mobility: overrides.mobility ?? "movable",
    zoneId: overrides.zoneId ?? "main",
    status: overrides.status ?? "available",
    active: overrides.active ?? true,
    position: overrides.position ?? null,
  } as Table;
}

function buildAdjacency(pairs: Array<[string, string]>): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  const addEdge = (a: string, b: string) => {
    if (!map.has(a)) {
      map.set(a, new Set());
    }
    map.get(a)!.add(b);
  };

  for (const [a, b] of pairs) {
    addEdge(a, b);
    addEdge(b, a);
  }

  return map;
}

describe("selector pruning diagnostics", () => {
  it("increments adjacency_frontier skip when no adjacent candidates remain", () => {
    const tables: Table[] = [
      createTable("t1", 4),
      createTable("t2", 4),
      createTable("t3", 4),
    ];

    const adjacency = buildAdjacency([
      ["t1", "t2"],
    ]);

    const config = getSelectorScoringConfig();

    const result = buildScoredTablePlans({
      tables,
      partySize: 6,
      adjacency,
      config,
      enableCombinations: true,
      requireAdjacency: true,
    });

    expect(result.diagnostics.skipped.adjacency_frontier).toBeGreaterThan(0);
  });

  it("increments capacity_upper_bound skip when remaining candidates cannot satisfy party size", () => {
    const tables: Table[] = [
      createTable("a1", 6),
      createTable("a2", 6),
      createTable("a3", 6),
    ];

    const adjacency = buildAdjacency([
      ["a1", "a2"],
      ["a2", "a3"],
      ["a1", "a3"],
    ]);

    const config = getSelectorScoringConfig();

    const result = buildScoredTablePlans({
      tables,
      partySize: 20,
      adjacency,
      config,
      enableCombinations: true,
      requireAdjacency: true,
    });

    expect(result.diagnostics.skipped.capacity_upper_bound).toBeGreaterThan(0);
  });
});
