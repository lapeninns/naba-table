import { describe, expect, it } from 'vitest';

import { buildPlannerCacheKey } from '@/server/capacity/planner-cache';

describe('buildPlannerCacheKey', () => {
  it('differentiates by booking type to prevent cross-option cache collisions', () => {
    const base = {
      restaurantId: 'restaurant-1',
      bookingDate: '2026-02-17',
      startTime: '19:00',
      partySize: 4,
      strategy: { requireAdjacency: null, maxTables: null },
      trigger: 'creation',
    } as const;

    const standardKey = buildPlannerCacheKey({ ...base, bookingType: 'standard' });
    const tastingKey = buildPlannerCacheKey({ ...base, bookingType: 'tasting' });

    expect(standardKey).not.toBe(tastingKey);
  });
});
