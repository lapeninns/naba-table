import { describe, expect, it } from 'vitest';

import { buildScoredTablePlans } from '@/server/capacity/selector';
import { getSelectorScoringConfig } from '@/server/capacity/policy';
import { deriveTableRules } from '@/server/capacity/table-rules';

function graphFromEdges(edges: Array<[string, string]>): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const [a, b] of edges) {
    if (!map.has(a)) map.set(a, new Set());
    map.get(a)!.add(b);
  }
  return map;
}

describe('allocator merge policy (Option A)', () => {
  it('prefers lower overage even if it requires merging (party 5: 4+2 over 7-top)', () => {
    const zoneId = 'zone-1';
    const tables = [
      { id: 't7', tableNumber: '09', capacity: 7, mobility: 'fixed', zoneId },
      { id: 't4', tableNumber: '02', capacity: 4, mobility: 'movable', zoneId },
      { id: 't2', tableNumber: '03', capacity: 2, mobility: 'movable', zoneId },
    ];

    const adjacency = graphFromEdges([
      ['t4', 't2'],
      ['t2', 't4'],
    ]);

    const result = buildScoredTablePlans({
      tables,
      partySize: 5,
      adjacency,
      config: getSelectorScoringConfig(),
      enableCombinations: true,
      requireAdjacency: true,
      kMax: 3,
    });

    expect(result.plans.length).toBeGreaterThan(0);
    const top = result.plans[0]!;
    expect(top.tables.map((t) => t.id).sort()).toEqual(['t2', 't4']);
    expect(top.metrics.overage).toBe(1);
  });

  it('breaks ties by fewer tables when overage is equal (party 4: single 4 over 2+2)', () => {
    const zoneId = 'zone-1';
    const tables = [
      { id: 't4', tableNumber: '01', capacity: 4, mobility: 'fixed', zoneId },
      { id: 't2a', tableNumber: '02', capacity: 2, mobility: 'movable', zoneId },
      { id: 't2b', tableNumber: '03', capacity: 2, mobility: 'movable', zoneId },
    ];

    const adjacency = graphFromEdges([
      ['t2a', 't2b'],
      ['t2b', 't2a'],
    ]);

    const result = buildScoredTablePlans({
      tables,
      partySize: 4,
      adjacency,
      config: getSelectorScoringConfig(),
      enableCombinations: true,
      requireAdjacency: true,
      kMax: 3,
    });

    expect(result.plans.length).toBeGreaterThan(0);
    const top = result.plans[0]!;
    expect(top.tables.map((t) => t.id)).toEqual(['t4']);
    expect(top.metrics.overage).toBe(0);
  });

  it('rejects merges when any table has null zone_id', () => {
    const tables = [
      { id: 'a', tableNumber: '01', capacity: 4, mobility: 'movable', zoneId: 'zone-1' },
      { id: 'b', tableNumber: '02', capacity: 4, mobility: 'movable', zoneId: null },
    ];

    // Even if adjacency incorrectly claims they are adjacent, zone invariant should block merges.
    const adjacency = graphFromEdges([
      ['a', 'b'],
      ['b', 'a'],
    ]);

    const result = buildScoredTablePlans({
      tables,
      partySize: 7,
      adjacency,
      config: getSelectorScoringConfig(),
      enableCombinations: true,
      requireAdjacency: true,
      kMax: 3,
    });

    // No single table can seat 7 and merges are invalid because of null zone.
    expect(result.plans).toHaveLength(0);
  });

  it('continues past an overflowing partner so a smaller adjacent table can complete a merge', () => {
    const zoneId = 'zone-1';
    const tables = [
      {
        id: 'large-base',
        tableNumber: '01',
        capacity: 8,
        maxPartySize: 4,
        mobility: 'movable',
        zoneId,
      },
      { id: 'overflowing-partner', tableNumber: '02', capacity: 4, mobility: 'movable', zoneId },
      { id: 'fitting-partner', tableNumber: '03', capacity: 1, mobility: 'movable', zoneId },
    ];

    const adjacency = graphFromEdges([
      ['large-base', 'overflowing-partner'],
      ['overflowing-partner', 'large-base'],
      ['large-base', 'fitting-partner'],
      ['fitting-partner', 'large-base'],
    ]);

    const result = buildScoredTablePlans({
      tables,
      partySize: 5,
      adjacency,
      config: getSelectorScoringConfig(),
      enableCombinations: true,
      requireAdjacency: true,
      kMax: 2,
    });

    expect(result.plans.some((plan) => plan.tableKey === '01+03')).toBe(true);
  });

  it('treats legacy mobility values as movable (null/adjustable)', () => {
    expect(deriveTableRules({ capacity: 4, mobility: null }).canBeMerged).toBe(true);
    expect(deriveTableRules({ capacity: 4, mobility: 'adjustable' }).canBeMerged).toBe(true);
    expect(deriveTableRules({ capacity: 4, mobility: 'fixed' }).canBeMerged).toBe(false);
  });
});
