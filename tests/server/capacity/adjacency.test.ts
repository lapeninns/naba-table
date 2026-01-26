import { describe, expect, it } from "vitest";

import { evaluateAdjacency, isAdjacencySatisfied, summarizeAdjacencyStatus } from "@/server/capacity/adjacency";

const makeAdjacency = (edges: Array<[string, string]>): Map<string, Set<string>> => {
  const map = new Map<string, Set<string>>();
  for (const [a, b] of edges) {
    if (!map.has(a)) map.set(a, new Set());
    if (!map.has(b)) map.set(b, new Set());
    map.get(a)!.add(b);
    map.get(b)!.add(a);
  }
  return map;
};

describe("adjacency evaluation", () => {
  it("treats a chain as connected with a hub-aligned neighbor", () => {
    const adjacency = makeAdjacency([
      ["a", "b"],
      ["b", "c"],
    ]);
    const evaluation = evaluateAdjacency(["a", "b", "c"], adjacency);

    expect(evaluation.connected).toBe(true);
    expect(evaluation.pairwise).toBe(false);
    expect(evaluation.hubAligned).toBe(true);
    expect(isAdjacencySatisfied(evaluation, "connected")).toBe(true);
    expect(isAdjacencySatisfied(evaluation, "neighbors")).toBe(true);
    expect(isAdjacencySatisfied(evaluation, "pairwise")).toBe(false);
    expect(summarizeAdjacencyStatus(evaluation, 3)).toBe("neighbors");
  });

  it("flags disconnected selections", () => {
    const adjacency = makeAdjacency([]);
    const evaluation = evaluateAdjacency(["a", "b"], adjacency);

    expect(evaluation.connected).toBe(false);
    expect(evaluation.pairwise).toBe(false);
    expect(evaluation.hubAligned).toBe(false);
    expect(summarizeAdjacencyStatus(evaluation, 2)).toBe("disconnected");
  });

  it("recognizes pairwise cliques", () => {
    const adjacency = makeAdjacency([
      ["a", "b"],
      ["a", "c"],
      ["b", "c"],
    ]);
    const evaluation = evaluateAdjacency(["a", "b", "c"], adjacency);

    expect(evaluation.connected).toBe(true);
    expect(evaluation.pairwise).toBe(true);
    expect(evaluation.hubAligned).toBe(true);
    expect(summarizeAdjacencyStatus(evaluation, 3)).toBe("pairwise");
    expect(isAdjacencySatisfied(evaluation, "pairwise")).toBe(true);
  });

  it("handles single table selections", () => {
    const adjacency = makeAdjacency([]);
    const evaluation = evaluateAdjacency(["a"], adjacency);

    expect(summarizeAdjacencyStatus(evaluation, 1)).toBe("single");
    expect(isAdjacencySatisfied(evaluation, "connected")).toBe(true);
  });
});
