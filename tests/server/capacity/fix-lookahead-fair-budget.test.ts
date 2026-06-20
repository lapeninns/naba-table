import { describe, expect, it } from 'vitest';

import { buildFairEvaluationOrder } from '@/server/capacity/table-assignment/availability';

describe('#11 lookahead fair evaluation order (time-budget starvation)', () => {
  it('returns an empty order for non-positive counts', () => {
    expect(buildFairEvaluationOrder(0)).toEqual([]);
    expect(buildFairEvaluationOrder(-3)).toEqual([]);
  });

  it('returns natural order for trivially small counts', () => {
    expect(buildFairEvaluationOrder(1)).toEqual([0]);
    expect(buildFairEvaluationOrder(2)).toEqual([0, 1]);
  });

  it.each([3, 5, 8, 13, 20, 37, 50])(
    'is a permutation of [0, count) with no gaps or duplicates (count=%i)',
    (count) => {
      const order = buildFairEvaluationOrder(count);
      expect(order).toHaveLength(count);
      expect(new Set(order).size).toBe(count);
      expect([...order].sort((a, b) => a - b)).toEqual(
        Array.from({ length: count }, (_value, index) => index),
      );
    },
  );

  it('spreads any budget-limited prefix across the full range instead of clustering at the front', () => {
    const count = 20;
    const order = buildFairEvaluationOrder(count);

    // If the time budget only allows the first few plans to be evaluated, those
    // plans must NOT all be the top-ranked head of the list. A naive in-order
    // sweep would yield a prefix whose max index is (prefixSize - 1); the fair
    // order must reach much deeper so later plans still get evaluated.
    for (const prefixSize of [3, 5, 8]) {
      const prefix = order.slice(0, prefixSize);
      const maxIndex = Math.max(...prefix);
      // Fair order reaches well past the head: the deepest sampled index in a
      // small prefix should be at least half-way through the list.
      expect(maxIndex).toBeGreaterThanOrEqual(Math.floor(count / 2));
      // And it should be strictly deeper than the naive front-loaded order.
      expect(maxIndex).toBeGreaterThan(prefixSize - 1);
    }
  });

  it('does not bias the very first index to dominate (head is sampled but not exclusively)', () => {
    const order = buildFairEvaluationOrder(16);
    // The first evaluated plan is still the top-ranked one (best-effort priority),
    // but the second sampled index jumps ahead rather than walking 0,1,2,...
    expect(order[0]).toBe(0);
    expect(order[1]).toBeGreaterThan(1);
  });
});
