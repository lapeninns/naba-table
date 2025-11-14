import { describe, expect, it } from "vitest";

import { evaluateAdjacency, isAdjacencySatisfied, summarizeAdjacencyStatus } from "@/server/capacity/adjacency";

describe("adjacency helpers", () => {
  it("detects connectivity vs pairwise/hub", () => {
    const adjacency = new Map<string, Set<string>>([
      ["a", new Set(["b"])],
      ["b", new Set(["a", "c"])],
      ["c", new Set(["b"])],
    ]);
    const evaluation = evaluateAdjacency(["a", "b", "c"], adjacency);
    expect(evaluation.connected).toBe(true);
    expect(evaluation.pairwise).toBe(false);
    expect(evaluation.hubAligned).toBe(false);
    expect(summarizeAdjacencyStatus(evaluation, 3)).toBe("connected");
    expect(isAdjacencySatisfied(evaluation, "connected")).toBe(true);
    expect(isAdjacencySatisfied(evaluation, "pairwise")).toBe(false);
    expect(isAdjacencySatisfied(evaluation, "neighbors")).toBe(false);
  });

  it("identifies pairwise cliques", () => {
    const adjacency = new Map<string, Set<string>>([
      ["a", new Set(["b"])],
      ["b", new Set(["a"])],
    ]);
    const evaluation = evaluateAdjacency(["a", "b"], adjacency);
    expect(evaluation.connected).toBe(true);
    expect(evaluation.pairwise).toBe(true);
    expect(summarizeAdjacencyStatus(evaluation, 2)).toBe("pairwise");
    expect(isAdjacencySatisfied(evaluation, "pairwise")).toBe(true);
  });

  it("flags hub-aligned selections", () => {
    const adjacency = new Map<string, Set<string>>([
      ["a", new Set(["b", "c"])],
      ["b", new Set(["a"])],
      ["c", new Set(["a"])],
    ]);
    const evaluation = evaluateAdjacency(["a", "b", "c"], adjacency);
    expect(evaluation.connected).toBe(true);
    expect(evaluation.pairwise).toBe(false);
    expect(evaluation.hubAligned).toBe(true);
    expect(summarizeAdjacencyStatus(evaluation, 3)).toBe("neighbors");
    expect(isAdjacencySatisfied(evaluation, "neighbors")).toBe(true);
  });
});
