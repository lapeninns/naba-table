import { describe, expect, it } from "vitest";

import { buildScoredTablePlans } from "@/server/capacity/selector";

import type { SelectorScoringConfig } from "@/server/capacity/policy";
import type { Table } from "@/server/capacity/table-assignment/types";

const baseConfig: SelectorScoringConfig = {
  weights: {
    overage: 1,
    tableCount: 1,
    fragmentation: 0,
    zoneBalance: 0,
    adjacencyCost: 0,
    scarcity: 0,
  },
  maxOverage: 10,
  maxTables: 3,
};

const makeTable = (overrides: Partial<Table>): Table => ({
  id: overrides.id ?? "t",
  tableNumber: overrides.tableNumber ?? "T",
  capacity: overrides.capacity ?? 2,
  zoneId: overrides.zoneId ?? "z1",
  minPartySize: overrides.minPartySize ?? null,
  maxPartySize: overrides.maxPartySize ?? null,
  section: overrides.section ?? null,
  category: overrides.category ?? null,
  seatingType: overrides.seatingType ?? null,
  mobility: overrides.mobility ?? "movable",
  zoneActive: overrides.zoneActive ?? true,
  status: overrides.status ?? "active",
  active: overrides.active ?? true,
  position: overrides.position ?? null,
});

describe("buildScoredTablePlans", () => {
  it("prefers exact-fit single tables with stable ordering", () => {
    const tables = [
      makeTable({ id: "a", tableNumber: "A", capacity: 2 }),
      makeTable({ id: "b", tableNumber: "B", capacity: 4 }),
      makeTable({ id: "c", tableNumber: "C", capacity: 2 }),
    ];

    const result = buildScoredTablePlans({
      tables,
      partySize: 2,
      adjacency: new Map(),
      config: baseConfig,
      enableCombinations: false,
      kMax: 2,
      requireAdjacency: false,
    });

    expect(result.plans.map((plan) => plan.tables[0]?.id)).toEqual(["a", "c", "b"]);
  });

  it("allows combination plans when maxPartySize is below party size", () => {
    const tables = [
      makeTable({ id: "a", tableNumber: "A", capacity: 2, maxPartySize: 2 }),
      makeTable({ id: "b", tableNumber: "B", capacity: 2, maxPartySize: 2 }),
    ];

    const result = buildScoredTablePlans({
      tables,
      partySize: 4,
      adjacency: new Map(),
      config: baseConfig,
      enableCombinations: true,
      kMax: 2,
      requireAdjacency: false,
    });

    expect(result.plans).toHaveLength(1);
    expect(result.plans[0]?.tables.map((table) => table.id).sort()).toEqual(["a", "b"]);
  });

  it("enforces adjacency requirements for combinations", () => {
    const tables = [
      makeTable({ id: "a", tableNumber: "A", capacity: 2 }),
      makeTable({ id: "b", tableNumber: "B", capacity: 2 }),
    ];

    const result = buildScoredTablePlans({
      tables,
      partySize: 4,
      adjacency: new Map(),
      config: baseConfig,
      enableCombinations: true,
      kMax: 2,
      requireAdjacency: true,
    });

    expect(result.plans).toHaveLength(0);
  });

  it("records adjacency frontier skips when adjacency blocks combinations", () => {
    const tables = [
      makeTable({ id: "a", tableNumber: "A", capacity: 2 }),
      makeTable({ id: "b", tableNumber: "B", capacity: 2 }),
      makeTable({ id: "c", tableNumber: "C", capacity: 2 }),
    ];

    const result = buildScoredTablePlans({
      tables,
      partySize: 4,
      adjacency: new Map(),
      config: baseConfig,
      enableCombinations: true,
      kMax: 3,
      requireAdjacency: true,
    });

    expect(result.plans).toHaveLength(0);
    expect(result.diagnostics.skipped.adjacency_frontier ?? 0).toBeGreaterThan(0);
  });
});
