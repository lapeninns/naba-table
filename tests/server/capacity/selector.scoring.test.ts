import { afterEach, describe, expect, it } from "vitest";

import { getSelectorScoringConfig, YIELD_MANAGEMENT_SCARCITY_WEIGHT } from "@/server/capacity/policy";
import { buildScoredTablePlans } from "@/server/capacity/selector";
import { resetStrategicConfigTestOverrides, setStrategicScarcityWeightForTests } from "@/server/capacity/strategic-config";

import {
  TABLE_IDS,
  createAllocatorLayoutFixture,
  pickTables,
  sliceAdjacency,
} from "../../fixtures/layout";

import type { Table } from "@/server/capacity/tables";


describe("buildScoredTablePlans", () => {
const createConfig = () => getSelectorScoringConfig();
afterEach(() => {
  resetStrategicConfigTestOverrides();
});

  it("prefers a single table when capacity fits exactly", () => {
    const config = createConfig();
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
    const config = createConfig();
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
    const config = createConfig();
    const layout = createAllocatorLayoutFixture();
    const tables = pickTables(layout.tableMap, [TABLE_IDS.loungeHighTop, TABLE_IDS.mainSixTop]);
    const adjacency = new Map<string, Set<string>>();

    const { plans } = buildScoredTablePlans({ tables, partySize: 4, adjacency, config });

    expect(plans[0]?.tables[0]?.id).toBe(TABLE_IDS.loungeHighTop);
    expect(plans[0]?.metrics?.overage).toBe(0);
    expect(plans[1]?.metrics?.overage).toBeGreaterThan(0);
  });

  it("enumerates multi-table combinations when enabled", () => {
    const config = createConfig();
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
    expect(result.diagnostics.limits).toEqual({
      kMax: 2,
      maxPlansPerSlack: 50,
      maxCombinationEvaluations: 500,
    });
  });

  it("prunes combinations that violate adjacency or kMax", () => {
    const config = createConfig();
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
    const config = createConfig();
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

  it("penalizes rare tables more heavily via scarcity scoring", () => {
    const config = createConfig();
    config.weights.scarcity = YIELD_MANAGEMENT_SCARCITY_WEIGHT;
    const tables: Table[] = [
      {
        id: "rare-4-top",
        tableNumber: "R4",
        capacity: 4,
        zoneId: "zone-main",
        status: "available",
        active: true,
        position: null,
        minPartySize: 2,
        maxPartySize: 6,
        section: "Main",
        category: "dining",
        seatingType: "standard",
        mobility: "fixed",
      },
      {
        id: "common-6-a",
        tableNumber: "C6A",
        capacity: 6,
        zoneId: "zone-main",
        status: "available",
        active: true,
        position: null,
        minPartySize: 2,
        maxPartySize: 8,
        section: "Main",
        category: "dining",
        seatingType: "standard",
        mobility: "fixed",
      },
      {
        id: "common-6-b",
        tableNumber: "C6B",
        capacity: 6,
        zoneId: "zone-main",
        status: "available",
        active: true,
        position: null,
        minPartySize: 2,
        maxPartySize: 8,
        section: "Main",
        category: "dining",
        seatingType: "standard",
        mobility: "fixed",
      },
    ];

    const { plans } = buildScoredTablePlans({
      tables,
      partySize: 4,
      adjacency: new Map(),
      config,
      demandMultiplier: 1,
    });

    const commonPlan = plans.find((plan) => plan.tableKey.includes("C6A"));
    const rarePlan = plans.find((plan) => plan.tableKey.includes("R4"));

    expect(commonPlan).toBeDefined();
    expect(rarePlan).toBeDefined();

    expect(commonPlan?.scoreBreakdown?.scarcityPenalty).toBeLessThan(rarePlan?.scoreBreakdown?.scarcityPenalty ?? Infinity);
    expect(plans[0]?.tableKey).toContain("C6");
  });

  it("scales slack penalty with demand multiplier", () => {
    const config = createConfig();
    config.weights.scarcity = YIELD_MANAGEMENT_SCARCITY_WEIGHT;
    const tables: Table[] = [
      {
        id: "single-table",
        tableNumber: "T1",
        capacity: 4,
        zoneId: "zone-main",
        status: "available",
        active: true,
        position: null,
        minPartySize: 2,
        maxPartySize: 6,
        section: "Main",
        category: "dining",
        seatingType: "standard",
        mobility: "fixed",
      },
    ];

    const base = buildScoredTablePlans({ tables, partySize: 3, adjacency: new Map(), config, demandMultiplier: 1 });
    const highDemand = buildScoredTablePlans({ tables, partySize: 3, adjacency: new Map(), config, demandMultiplier: 3 });

    const basePlan = base.plans[0];
    const highPlan = highDemand.plans[0];

    expect(basePlan).toBeDefined();
    expect(highPlan).toBeDefined();

    expect(basePlan?.scoreBreakdown?.demandMultiplier).toBe(1);
    expect(highPlan?.scoreBreakdown?.demandMultiplier).toBe(3);
    expect(highPlan?.scoreBreakdown?.slackPenalty).toBeCloseTo((basePlan?.scoreBreakdown?.slackPenalty ?? 0) * 3);
  });

  it("increases combination penalty when rare tables are merged", () => {
    const config = createConfig();
    config.weights.scarcity = YIELD_MANAGEMENT_SCARCITY_WEIGHT;
    const tables: Table[] = [
      {
        id: "rare-4",
        tableNumber: "R4",
        capacity: 4,
        zoneId: "zone-main",
        status: "available",
        active: true,
        position: null,
        minPartySize: 2,
        maxPartySize: 6,
        section: "Main",
        category: "dining",
        seatingType: "standard",
        mobility: "fixed",
      },
      {
        id: "common-3-a",
        tableNumber: "C3A",
        capacity: 3,
        zoneId: "zone-main",
        status: "available",
        active: true,
        position: null,
        minPartySize: 1,
        maxPartySize: 6,
        section: "Main",
        category: "dining",
        seatingType: "standard",
        mobility: "fixed",
      },
      {
        id: "common-3-b",
        tableNumber: "C3B",
        capacity: 3,
        zoneId: "zone-main",
        status: "available",
        active: true,
        position: null,
        minPartySize: 1,
        maxPartySize: 6,
        section: "Main",
        category: "dining",
        seatingType: "standard",
        mobility: "fixed",
      },
      {
        id: "common-2-a",
        tableNumber: "C2A",
        capacity: 2,
        zoneId: "zone-main",
        status: "available",
        active: true,
        position: null,
        minPartySize: 1,
        maxPartySize: 6,
        section: "Main",
        category: "dining",
        seatingType: "standard",
        mobility: "fixed",
      },
      {
        id: "common-2-b",
        tableNumber: "C2B",
        capacity: 2,
        zoneId: "zone-main",
        status: "available",
        active: true,
        position: null,
        minPartySize: 1,
        maxPartySize: 6,
        section: "Main",
        category: "dining",
        seatingType: "standard",
        mobility: "fixed",
      },
    ];

    const adjacency = new Map<string, Set<string>>();
    for (const table of tables) {
      adjacency.set(
        table.id,
        new Set(tables.filter((candidate) => candidate.id !== table.id).map((candidate) => candidate.id)),
      );
    }

    const result = buildScoredTablePlans({
      tables,
      partySize: 5,
      adjacency,
      config,
      enableCombinations: true,
      kMax: 3,
    });

    const combinationPlans = result.plans.filter((plan) => plan.tables.length === 2);
    const rareMix = combinationPlans.find((plan) =>
      plan.tables.some((table) => table.id === "rare-4") && plan.tables.some((table) => table.id === "common-2-a" || table.id === "common-2-b"),
    );
    const commonOnly = combinationPlans.find((plan) =>
      plan.tables.every((table) => table.id.startsWith("common-3")),
    );

    expect(rareMix).toBeDefined();
    expect(commonOnly).toBeDefined();

    const rareCombinationPenalty = rareMix?.scoreBreakdown?.combinationPenalty ?? 0;
    const commonCombinationPenalty = commonOnly?.scoreBreakdown?.combinationPenalty ?? 0;

    expect(rareCombinationPenalty).toBeGreaterThan(commonCombinationPenalty);
    expect(rareMix?.scoreBreakdown?.scarcityPenalty ?? 0).toBeGreaterThan(commonOnly?.scoreBreakdown?.scarcityPenalty ?? 0);
  });
});

it("applies scarcity penalty so rare tables lose to common alternatives during peak demand", () => {
  setStrategicScarcityWeightForTests(30);
  const config = getSelectorScoringConfig();
  const rareFourTop: Table = {
    id: "rare-4",
    tableNumber: "R4",
    capacity: 4,
    minPartySize: 2,
    maxPartySize: 4,
    section: "Window",
    category: "window",
    seatingType: "standard",
    mobility: "fixed",
    zoneId: "zone-main",
    status: "available",
    active: true,
    position: null,
  };
  const commonSixTop: Table = {
    id: "common-6",
    tableNumber: "C6",
    capacity: 6,
    minPartySize: 2,
    maxPartySize: 6,
    section: "Main",
    category: "dining",
    seatingType: "standard",
    mobility: "fixed",
    zoneId: "zone-main",
    status: "available",
    active: true,
    position: null,
  };

  const tableScarcityScores = new Map<string, number>([
    [rareFourTop.id, 1],
    [commonSixTop.id, 0.05],
  ]);

  const { plans } = buildScoredTablePlans({
    tables: [rareFourTop, commonSixTop],
    partySize: 4,
    adjacency: new Map(),
    config,
    demandMultiplier: 2,
    tableScarcityScores,
  });

  expect(plans[0]?.tables[0]?.id).toBe(commonSixTop.id);
  const rarePlan = plans.find((plan) => plan.tables[0]?.id === rareFourTop.id);
  expect(rarePlan?.scoreBreakdown.scarcityPenalty ?? 0).toBeGreaterThan(
    plans[0]?.scoreBreakdown.scarcityPenalty ?? 0,
  );
});

it("amplifies slack penalty when demand multiplier increases", () => {
  setStrategicScarcityWeightForTests(YIELD_MANAGEMENT_SCARCITY_WEIGHT);
  const config = getSelectorScoringConfig();
  const fourTop: Table = {
    id: "offpeak-4",
    tableNumber: "OP4",
    capacity: 4,
    minPartySize: 2,
    maxPartySize: 4,
    section: "Patio",
    category: "dining",
    seatingType: "standard",
    mobility: "fixed",
    zoneId: "zone-patio",
    status: "available",
    active: true,
    position: null,
  };
  const adjacency = new Map<string, Set<string>>();
  const tableScarcityScores = new Map<string, number>([[fourTop.id, 0.2]]);

  const offPeak = buildScoredTablePlans({
    tables: [fourTop],
    partySize: 2,
    adjacency,
    config,
    demandMultiplier: 1,
    tableScarcityScores,
  }).plans[0];

  const peak = buildScoredTablePlans({
    tables: [fourTop],
    partySize: 2,
    adjacency,
    config,
    demandMultiplier: 2,
    tableScarcityScores,
  }).plans[0];

  expect(offPeak?.scoreBreakdown.slackPenalty).toBeDefined();
  expect(peak?.scoreBreakdown.slackPenalty).toBeGreaterThan(
    offPeak?.scoreBreakdown.slackPenalty ?? 0,
  );
  expect(peak?.scoreBreakdown.total ?? 0).toBeGreaterThan(offPeak?.scoreBreakdown.total ?? 0);
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
