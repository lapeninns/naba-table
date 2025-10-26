import type { Table } from "@/server/capacity/tables";

export const ZONE_IDS = {
  main: "zone-main-dining",
  patio: "zone-patio",
} as const;

export const TABLE_IDS = {
  mainSixTop: "table-main-6",
  mainMergeA: "table-main-merge-a",
  mainMergeB: "table-main-merge-b",
  patioTwoTop: "table-patio-2",
  patioSixTop: "table-patio-6",
  loungeHighTop: "table-lounge-h1",
} as const;

export type AllocatorLayoutFixture = {
  tables: Table[];
  adjacencyPairs: Array<[string, string]>;
  adjacencyMap: Map<string, Set<string>>;
  tableMap: Map<string, Table>;
  zoneIds: typeof ZONE_IDS;
};

export function buildAdjacencyMap(pairs: Array<[string, string]>): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const [from, to] of pairs) {
    if (!map.has(from)) {
      map.set(from, new Set());
    }
    map.get(from)!.add(to);
  }
  return map;
}

export function sliceAdjacency(base: Map<string, Set<string>>, ids: Set<string>): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  for (const id of ids) {
    const neighbors = base.get(id);
    if (!neighbors) continue;
    const filtered = new Set([...neighbors].filter((neighbor) => ids.has(neighbor)));
    result.set(id, filtered);
  }
  return result;
}

export function pickTables(tableMap: Map<string, Table>, ids: string[]): Table[] {
  return ids.map((id) => {
    const table = tableMap.get(id);
    if (!table) {
      throw new Error(`Table fixture ${id} not found`);
    }
    return { ...table };
  });
}

export function createAllocatorLayoutFixture(): AllocatorLayoutFixture {
  const tables: Table[] = [
    {
      id: TABLE_IDS.mainSixTop,
      tableNumber: "A6",
      capacity: 6,
      minPartySize: 2,
      maxPartySize: 6,
      section: "Main",
      category: "dining",
      seatingType: "standard",
      mobility: "fixed",
      zoneId: ZONE_IDS.main,
      status: "available",
      active: true,
      position: null,
    },
    {
      id: TABLE_IDS.mainMergeA,
      tableNumber: "M1",
      capacity: 3,
      minPartySize: 1,
      maxPartySize: 4,
      section: "Main",
      category: "dining",
      seatingType: "standard",
      mobility: "movable",
      zoneId: ZONE_IDS.main,
      status: "available",
      active: true,
      position: null,
    },
    {
      id: TABLE_IDS.mainMergeB,
      tableNumber: "M2",
      capacity: 3,
      minPartySize: 1,
      maxPartySize: 4,
      section: "Main",
      category: "dining",
      seatingType: "standard",
      mobility: "movable",
      zoneId: ZONE_IDS.main,
      status: "available",
      active: true,
      position: null,
    },
    {
      id: TABLE_IDS.patioTwoTop,
      tableNumber: "P2",
      capacity: 2,
      minPartySize: 1,
      maxPartySize: 2,
      section: "Patio",
      category: "outdoor",
      seatingType: "standard",
      mobility: "movable",
      zoneId: ZONE_IDS.patio,
      status: "available",
      active: true,
      position: null,
    },
    {
      id: TABLE_IDS.patioSixTop,
      tableNumber: "P6",
      capacity: 6,
      minPartySize: 3,
      maxPartySize: 6,
      section: "Patio",
      category: "outdoor",
      seatingType: "standard",
      mobility: "fixed",
      zoneId: ZONE_IDS.patio,
      status: "available",
      active: true,
      position: null,
    },
    {
      id: TABLE_IDS.loungeHighTop,
      tableNumber: "H1",
      capacity: 4,
      minPartySize: 2,
      maxPartySize: 4,
      section: "Lounge",
      category: "bar",
      seatingType: "high_top",
      mobility: "movable",
      zoneId: ZONE_IDS.main,
      status: "available",
      active: true,
      position: null,
    },
  ];

  const adjacencyPairs: Array<[string, string]> = [
    [TABLE_IDS.mainMergeA, TABLE_IDS.mainMergeB],
    [TABLE_IDS.mainMergeB, TABLE_IDS.mainMergeA],
    [TABLE_IDS.patioTwoTop, TABLE_IDS.patioSixTop],
    [TABLE_IDS.patioSixTop, TABLE_IDS.patioTwoTop],
    [TABLE_IDS.loungeHighTop, TABLE_IDS.mainMergeA],
    [TABLE_IDS.mainMergeA, TABLE_IDS.loungeHighTop],
  ];

  const adjacencyMap = buildAdjacencyMap(adjacencyPairs);
  const tableMap = new Map(tables.map((table) => [table.id, table] as const));

  return {
    tables,
    adjacencyPairs,
    adjacencyMap,
    tableMap,
    zoneIds: ZONE_IDS,
  };
}
