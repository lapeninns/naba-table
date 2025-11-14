import type { AdjacencyMode } from "@/server/feature-flags";

export type AdjacencyEvaluation = {
  connected: boolean;
  pairwise: boolean;
  hubAligned: boolean;
  depths: Map<string, number>;
};

function hasEdge(a: string, b: string, adjacency: Map<string, Set<string>>): boolean {
  return Boolean(adjacency.get(a)?.has(b) || adjacency.get(b)?.has(a));
}

export function evaluateAdjacency(ids: string[], adjacency: Map<string, Set<string>>): AdjacencyEvaluation {
  const depths = new Map<string, number>();
  if (ids.length === 0) {
    return { connected: true, pairwise: true, hubAligned: true, depths };
  }

  const visited = new Set<string>();
  const queue: string[] = [];
  const [firstId] = ids;
  if (firstId) {
    queue.push(firstId);
    depths.set(firstId, 0);
  }

  const selection = new Set(ids);
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    visited.add(current);
    const neighbors = adjacency.get(current);
    if (!neighbors) {
      continue;
    }
    for (const neighbor of neighbors) {
      if (!selection.has(neighbor) || depths.has(neighbor)) {
        continue;
      }
      depths.set(neighbor, (depths.get(current) ?? 0) + 1);
      queue.push(neighbor);
    }
  }

  const connected = visited.size === selection.size;

  let pairwise = true;
  for (let i = 0; i < ids.length && pairwise; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      if (!hasEdge(ids[i]!, ids[j]!, adjacency)) {
        pairwise = false;
        break;
      }
    }
  }

  let hubAligned = false;
  if (ids.length <= 1) {
    hubAligned = true;
  } else {
    hubAligned = ids.some((candidate) =>
      ids.every((other) => other === candidate || hasEdge(candidate, other, adjacency)),
    );
  }

  return { connected, pairwise, hubAligned, depths };
}

export function isAdjacencySatisfied(evaluation: AdjacencyEvaluation, mode: AdjacencyMode): boolean {
  switch (mode) {
    case "pairwise":
      return evaluation.pairwise;
    case "neighbors":
      return evaluation.hubAligned;
    default:
      return evaluation.connected;
  }
}

export function summarizeAdjacencyStatus(
  evaluation: AdjacencyEvaluation,
  tableCount: number,
): "single" | "pairwise" | "neighbors" | "connected" | "disconnected" {
  if (tableCount <= 1) {
    return "single";
  }
  if (evaluation.pairwise) {
    return "pairwise";
  }
  if (evaluation.hubAligned) {
    return "neighbors";
  }
  if (evaluation.connected) {
    return "connected";
  }
  return "disconnected";
}
