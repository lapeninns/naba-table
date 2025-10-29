import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";

import { createAvailabilityBitset, markWindow } from "@/server/capacity/planner/bitset";
import { getSelectorScoringConfig } from "@/server/capacity/policy";
import { buildScoredTablePlans } from "@/server/capacity/selector";
import { computeBookingWindow, filterAvailableTables } from "@/server/capacity/tables";

import type { Table } from "@/server/capacity/tables";

function makeTable(index: number, overrides: Partial<Table> = {}): Table {
  const id = `table-${index}`;
  return {
    id,
    tableNumber: overrides.tableNumber ?? `T${index.toString().padStart(2, "0")}`,
    capacity: overrides.capacity ?? 6,
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

function buildCompleteAdjacency(ids: string[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const id of ids) {
    map.set(
      id,
      new Set(ids.filter((other) => other !== id)),
    );
  }
  return map;
}

describe("planner time pruning benchmark", () => {
  it("reduces enumerated combinations by at least 25% when busy tables are present", () => {
    const partySize = 6;
    const tables = Array.from({ length: 10 }, (_, idx) => makeTable(idx + 1));
    const adjacency = buildCompleteAdjacency(tables.map((table) => table.id));
    const config = getSelectorScoringConfig();

    const bookingStart = DateTime.fromISO("2025-02-01T18:00:00.000Z");
    const window = computeBookingWindow({
      startISO: bookingStart.toISO(),
      partySize,
    });

    const baseline = buildScoredTablePlans({
      tables,
      partySize,
      adjacency,
      config,
      enableCombinations: true,
      requireAdjacency: true,
    });

    const busy = new Map<
      string,
      {
        bitset: ReturnType<typeof createAvailabilityBitset>;
        windows: never[];
      }
    >();

    for (const table of tables.slice(0, 6)) {
      const bitset = createAvailabilityBitset();
      markWindow(bitset, window.block.start, window.block.end);
      busy.set(table.id, { bitset, windows: [] });
    }

    let captured: { prunedByTime: number; candidatesAfterTimePrune: number } | null = null;

    const prunedTables = filterAvailableTables(
      tables,
      partySize,
      window,
      adjacency,
      undefined,
      undefined,
      {
        timeFilter: {
          busy,
          mode: "strict",
          captureStats: (stats) => {
            captured = {
              prunedByTime: stats.prunedByTime,
              candidatesAfterTimePrune: stats.candidatesAfterTimePrune,
            };
          },
        },
      },
    );

    const pruned = buildScoredTablePlans({
      tables: prunedTables,
      partySize,
      adjacency,
      config,
      enableCombinations: true,
      requireAdjacency: true,
    });

    const baselineEnumerated = baseline.diagnostics.totals.enumerated;
    const prunedEnumerated = pruned.diagnostics.totals.enumerated;
    const relativeDrop =
      baselineEnumerated > 0
        ? (baselineEnumerated - prunedEnumerated) / baselineEnumerated
        : 0;

    expect(captured).toEqual({
      prunedByTime: 6,
      candidatesAfterTimePrune: prunedTables.length,
    });
    expect(baselineEnumerated).toBeGreaterThan(0);
    expect(prunedEnumerated).toBeLessThan(baselineEnumerated);
    expect(relativeDrop).toBeGreaterThanOrEqual(0.25);
  });
});
