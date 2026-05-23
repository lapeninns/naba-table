import { computePayloadChecksum } from '@/server/capacity/v2';

import type { DbClient, ManualSelectionSummary, Table } from './types';
import type { CreateTableHoldInput } from '@/server/capacity/holds';

export type ManualHoldAdjacencySnapshot = {
  zoneIds: string[];
  adjacency: {
    undirected: boolean;
    edges: string[];
    hash: string | null;
  };
};

export function buildManualHoldAdjacencySnapshot({
  adjacency,
  adjacencyUndirected,
  requireAdjacency,
  tableIds,
  tables,
}: {
  adjacency: Map<string, Set<string>>;
  adjacencyUndirected: boolean;
  requireAdjacency?: boolean;
  tableIds: string[];
  tables: Table[];
}): ManualHoldAdjacencySnapshot | null {
  if (requireAdjacency !== true) {
    return null;
  }

  const edgeSet = new Set<string>();
  for (const a of tableIds) {
    const neighbors = adjacency.get(a);
    if (!neighbors) continue;
    for (const b of neighbors) {
      if (!tableIds.includes(b)) continue;
      const key = adjacencyUndirected
        ? ([a, b].sort((x, y) => x.localeCompare(y)) as [string, string]).join('->')
        : `${a}->${b}`;
      edgeSet.add(key);
    }
  }

  const edges = Array.from(edgeSet).sort();
  const zoneIds = Array.from(new Set(tables.map((table) => table.zoneId))).filter(
    Boolean,
  ) as string[];

  return {
    zoneIds,
    adjacency: {
      undirected: adjacencyUndirected,
      edges,
      hash: computePayloadChecksum({
        undirected: adjacencyUndirected,
        edges,
      }),
    },
  };
}

export function buildManualTableHoldPayload({
  adjacency,
  adjacencyUndirected,
  assignedBy,
  bookingId,
  client,
  createdBy,
  endAt,
  expiresAt,
  instantAssignment = false,
  policyVersion,
  requireAdjacency,
  restaurantId,
  startAt,
  summary,
  tableIds,
  tables,
  zoneId,
}: {
  adjacency: Map<string, Set<string>>;
  adjacencyUndirected: boolean;
  assignedBy?: string | null;
  bookingId: string;
  client: DbClient;
  createdBy: string;
  endAt: string;
  expiresAt: string;
  instantAssignment?: boolean;
  policyVersion: string;
  requireAdjacency?: boolean;
  restaurantId: string;
  startAt: string;
  summary: ManualSelectionSummary;
  tableIds: string[];
  tables: Table[];
  zoneId: string;
}): CreateTableHoldInput {
  const snapshot = buildManualHoldAdjacencySnapshot({
    adjacency,
    adjacencyUndirected,
    requireAdjacency,
    tableIds,
    tables,
  });

  return {
    bookingId,
    restaurantId,
    zoneId,
    tableIds,
    startAt,
    endAt,
    expiresAt,
    createdBy,
    metadata: {
      selection: {
        tableIds,
        summary,
        snapshot,
      },
      policyVersion,
      requireAdjacency,
      ...(instantAssignment
        ? {
            instantAssignment: true,
            assignedBy,
          }
        : {}),
    },
    client,
  };
}
