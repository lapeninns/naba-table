import { describe, expect, it } from 'vitest';

import { resolvePreferredOpsRestaurantId } from '@/lib/ops/session';

describe('resolvePreferredOpsRestaurantId', () => {
  it('prefers a valid saved restaurant id', () => {
    expect(
      resolvePreferredOpsRestaurantId(
        ['restaurant-a', 'restaurant-b'],
        'restaurant-b',
      ),
    ).toBe('restaurant-b');
  });

  it('falls back to the first membership when the saved id is missing or invalid', () => {
    expect(resolvePreferredOpsRestaurantId(['restaurant-a', 'restaurant-b'], 'restaurant-c')).toBe(
      'restaurant-a',
    );
    expect(resolvePreferredOpsRestaurantId(['restaurant-a', 'restaurant-b'], null)).toBe(
      'restaurant-a',
    );
  });

  it('returns null when there are no available restaurants', () => {
    expect(resolvePreferredOpsRestaurantId([], 'restaurant-a')).toBeNull();
  });
});
