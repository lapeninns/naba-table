import { describe, expect, it } from "vitest";

import { buildScoredTablePlans } from "@/server/capacity/selector";
import { getSelectorScoringConfig } from "@/server/capacity/policy";
import type { Table } from "@/server/capacity/tables";

function createTable(index: number, overrides: Partial<Table> = {}): Table {
  const id = `table-${index}`;
  return {
    id,
    tableNumber: `T${index.toString().padStart(2, "0")}`,
    capacity: overrides.capacity ?? (index % 3 === 0 ? 6 : 4),
    minPartySize: overrides.minPartySize ?? 1,
    maxPartySize: overrides.maxPartySize ?? null,
    section: overrides.section ?? null,
    category: overrides.category ?? "dining",
    seatingType: overrides.seatingType ?? "standard",
    mobility: overrides.mobility ?? "movable",
    zoneId: overrides.zoneId ?? "main",
    status: overrides.status ?? "available",
    active: overrides.active ?? true,
    mergeEligible: overrides.mergeEligible ?? true,
    position: overrides.position ?? null,
  } as Table;
}

function buildDenseAdjacency(ids: string[], neighbourCount: number): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();

  const addEdge = (a: string, b: string) => {
    if (!map.has(a)) {
      map.set(a, new Set());
    }
    map.get(a)!.add(b);
  };

  for (let i = 0; i < ids.length; i++) {
    for (let offset = 1; offset <= neighbourCount; offset++) {
      const j = (i + offset) % ids.length;
      const a = ids[i];
      const b = ids[j];
      addEdge(a, b);
      addEdge(b, a);
    }
  }

  return map;
}

describe("buildScoredTablePlans performance", () => {
  it("evaluates dense adjacency graph within bounded diagnostics and runtime", () => {
    const tableCount = 36;
    const tables = Array.from({ length: tableCount }, (_, idx) =>
      createTable(idx, {
        capacity: idx % 4 === 0 ? 6 : 4,
        zoneId: "main",
      }),
    );

    const adjacency = buildDenseAdjacency(
      tables.map((table) => table.id),
      5,
    );

    const config = getSelectorScoringConfig();
    const start = process.hrtime.bigint();

    const result = buildScoredTablePlans({
      tables,
      partySize: 10,
      adjacency,
      config,
    });

    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;

    expect(result.plans.length).toBeGreaterThan(0);
    expect(result.diagnostics.mergeCombosEvaluated).toBeLessThan(5000);
    expect(durationMs).toBeLessThan(250);
  });
});
