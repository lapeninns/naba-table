import { describe, expect, it, vi } from 'vitest';

import { getSelectorScoringConfig } from '@/server/capacity/policy';
import { buildScoredTablePlans } from '@/server/capacity/selector';

describe('selector fallback reason', () => {
  it('reports timeout fallback when planner exhausts time budget without accepted plans', () => {
    const tables = [
      { id: 'a', tableNumber: '01', capacity: 2, mobility: 'movable', zoneId: 'zone-1' },
      { id: 'b', tableNumber: '02', capacity: 2, mobility: 'movable', zoneId: 'zone-1' },
      { id: 'c', tableNumber: '03', capacity: 2, mobility: 'movable', zoneId: 'zone-1' },
    ];
    const adjacency = new Map<string, Set<string>>([
      ['a', new Set(['b', 'c'])],
      ['b', new Set(['a', 'c'])],
      ['c', new Set(['a', 'b'])],
    ]);

    const nowSpy = vi.spyOn(performance, 'now');
    let tick = 0;
    nowSpy.mockImplementation(() => {
      tick += 100;
      return tick;
    });

    try {
      const result = buildScoredTablePlans({
        tables,
        partySize: 4,
        adjacency,
        config: getSelectorScoringConfig(),
        enableCombinations: true,
        requireAdjacency: true,
        kMax: 2,
        maxCombinationEvaluations: 200,
        maxPlansPerSlack: 10,
        enumerationTimeoutMs: 50,
      });

      expect(result.plans).toHaveLength(0);
      expect(result.diagnostics.skipped.timeout ?? 0).toBeGreaterThan(0);
      expect(result.fallbackReason).toBe('Planner timeout before finding suitable tables.');
    } finally {
      nowSpy.mockRestore();
    }
  });
});
