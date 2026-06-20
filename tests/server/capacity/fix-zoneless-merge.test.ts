import { describe, expect, it } from 'vitest';

import { getSelectorScoringConfig } from '@/server/capacity/policy';
import { buildScoredTablePlans } from '@/server/capacity/selector';

function graphFromEdges(edges: Array<[string, string]>): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const [a, b] of edges) {
    if (!map.has(a)) map.set(a, new Set());
    map.get(a)!.add(b);
  }
  return map;
}

// Regression for bug #14: zoneless tables (null zoneId) were excluded from every
// combination because seeds/members required a non-null zoneId. They should be allowed
// to merge with one another (null zone as its own joinable group), while mixing two
// different non-null zones — or a zoned table with a zoneless one — stays forbidden.
describe('zoneless tables can form combinations', () => {
  const config = getSelectorScoringConfig();

  it('merges two adjacent zoneless tables to seat a party that no single table fits', () => {
    const tables = [
      { id: 'z1', tableNumber: '01', capacity: 3, mobility: 'movable', zoneId: null },
      { id: 'z2', tableNumber: '02', capacity: 3, mobility: 'movable', zoneId: null },
    ];
    const adjacency = graphFromEdges([
      ['z1', 'z2'],
      ['z2', 'z1'],
    ]);

    const result = buildScoredTablePlans({
      tables,
      partySize: 5,
      adjacency,
      config,
      enableCombinations: true,
      requireAdjacency: true,
      kMax: 3,
    });

    expect(result.plans.length).toBeGreaterThan(0);
    const merged = result.plans.find((plan) => plan.tables.length === 2);
    expect(merged).toBeDefined();
    expect(merged!.tables.map((t) => t.id).sort()).toEqual(['z1', 'z2']);
    expect(merged!.metrics.overage).toBe(1);
  });

  it('still forbids merging a zoneless table with a zoned table', () => {
    const tables = [
      { id: 'zoned', tableNumber: '01', capacity: 4, mobility: 'movable', zoneId: 'zone-1' },
      { id: 'zoneless', tableNumber: '02', capacity: 4, mobility: 'movable', zoneId: null },
    ];
    // Even if adjacency claims they are adjacent, mixing a zoned and a zoneless table
    // is not a joinable group, so no merge can seat the party.
    const adjacency = graphFromEdges([
      ['zoned', 'zoneless'],
      ['zoneless', 'zoned'],
    ]);

    const result = buildScoredTablePlans({
      tables,
      partySize: 7,
      adjacency,
      config,
      enableCombinations: true,
      requireAdjacency: true,
      kMax: 3,
    });

    expect(result.plans).toHaveLength(0);
  });

  it('still forbids merging two different non-null zones', () => {
    const tables = [
      { id: 'a', tableNumber: '01', capacity: 4, mobility: 'movable', zoneId: 'zone-1' },
      { id: 'b', tableNumber: '02', capacity: 4, mobility: 'movable', zoneId: 'zone-2' },
    ];
    const adjacency = graphFromEdges([
      ['a', 'b'],
      ['b', 'a'],
    ]);

    const result = buildScoredTablePlans({
      tables,
      partySize: 7,
      adjacency,
      config,
      enableCombinations: true,
      requireAdjacency: true,
      kMax: 3,
    });

    expect(result.plans).toHaveLength(0);
  });
});
