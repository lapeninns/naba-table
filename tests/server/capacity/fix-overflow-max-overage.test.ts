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

// Regression for bug #2: the capacity-overflow fallback must still enforce
// policy.maxOverage. Previously allowCapacityOverflow set effectiveCapacityCap to
// Number.POSITIVE_INFINITY, which disabled the overage guard and seated parties on
// tables/combinations far beyond partySize + maxOverage.
describe('overflow fallback honors policy.maxOverage', () => {
  const config = getSelectorScoringConfig();

  it('exposes maxOverage of 4 (guards the assumptions below)', () => {
    expect(config.maxOverage).toBe(4);
  });

  it('does NOT seat a single table that exceeds partySize + maxOverage even under overflow', () => {
    // partySize 2, maxOverage 4 => maxAllowedCapacity 6. A 10-top overshoots by 8.
    const tables = [
      { id: 'huge', tableNumber: '01', capacity: 10, mobility: 'fixed', zoneId: 'zone-1' },
    ];

    const result = buildScoredTablePlans({
      tables,
      partySize: 2,
      adjacency: new Map<string, Set<string>>(),
      config,
      enableCombinations: false,
      requireAdjacency: false,
      kMax: 1,
      allowCapacityOverflow: true,
    });

    expect(result.plans).toHaveLength(0);
    expect(result.diagnostics.skipped.overage ?? 0).toBeGreaterThan(0);
  });

  it('still seats a single table at exactly partySize + maxOverage under overflow (no over-rejection)', () => {
    // partySize 2, maxOverage 4 => capacity 6 is the boundary and must remain seatable.
    const tables = [
      { id: 'boundary', tableNumber: '01', capacity: 6, mobility: 'fixed', zoneId: 'zone-1' },
    ];

    const result = buildScoredTablePlans({
      tables,
      partySize: 2,
      adjacency: new Map<string, Set<string>>(),
      config,
      enableCombinations: false,
      requireAdjacency: false,
      kMax: 1,
      allowCapacityOverflow: true,
    });

    expect(result.plans.length).toBeGreaterThan(0);
    expect(result.plans[0]!.tables.map((t) => t.id)).toEqual(['boundary']);
    expect(result.plans[0]!.metrics.overage).toBe(4);
  });

  it('does NOT assemble a combination that exceeds partySize + maxOverage under overflow', () => {
    // partySize 5, maxOverage 4 => maxAllowedCapacity 9. Two 6-tops sum to 12 (overage 7).
    const zoneId = 'zone-1';
    const tables = [
      { id: 't6a', tableNumber: '01', capacity: 6, mobility: 'movable', zoneId },
      { id: 't6b', tableNumber: '02', capacity: 6, mobility: 'movable', zoneId },
    ];
    const adjacency = graphFromEdges([
      ['t6a', 't6b'],
      ['t6b', 't6a'],
    ]);

    const result = buildScoredTablePlans({
      tables,
      partySize: 5,
      adjacency,
      config,
      enableCombinations: true,
      requireAdjacency: true,
      kMax: 3,
      allowCapacityOverflow: true,
    });

    // Each single 6-top already seats party 5 within overage 1, so the combination is
    // never needed; but critically, no over-policy combo (overage 7) is produced.
    expect(result.plans.every((plan) => plan.metrics.overage <= config.maxOverage)).toBe(true);
    expect(result.plans.some((plan) => plan.tables.length >= 2)).toBe(false);
  });
});
