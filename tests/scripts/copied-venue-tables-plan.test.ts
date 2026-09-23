import { describe, expect, it } from 'vitest';

import {
  COPIED_VENUE_TABLE_SPECS,
  countsMatchDesired,
  desiredTables,
  formatTableNumber,
  resolveRestaurant,
  seatTotal,
  summarizeByCapacity,
} from '@/scripts/copied-venue-tables/plan';

describe('copied venue table plan', () => {
  it('uses the operator-supplied 2-top, 4-top and 6-top counts', () => {
    const byId = Object.fromEntries(COPIED_VENUE_TABLE_SPECS.map((spec) => [spec.id, spec]));

    expect(byId['barley-mow']?.counts).toEqual({ 2: 3, 4: 12, 6: 5 });
    expect(byId['the-prince']?.counts).toEqual({ 2: 5, 4: 11, 6: 3 });
    expect(seatTotal(byId['barley-mow']!.counts)).toBe(84);
    expect(seatTotal(byId['the-prince']!.counts)).toBe(72);
  });

  it('builds sequential T-capacity labels for each size', () => {
    expect(formatTableNumber(4, 12)).toBe('T-4-12');
    expect(desiredTables({ 2: 2, 4: 1, 6: 1 })).toEqual([
      { tableNumber: 'T-2-01', capacity: 2 },
      { tableNumber: 'T-2-02', capacity: 2 },
      { tableNumber: 'T-4-01', capacity: 4 },
      { tableNumber: 'T-6-01', capacity: 6 },
    ]);
  });

  it('resolves each copied venue uniquely and rejects ambiguous names', () => {
    const restaurants = [
      { id: '1', name: 'The Barley Mow', slug: 'the-barley-mow-hartford' },
      { id: '2', name: 'The Prince', slug: 'the-prince' },
      { id: '3', name: 'The Old School House', slug: 'the-old-school-house' },
    ];

    expect(resolveRestaurant(restaurants, COPIED_VENUE_TABLE_SPECS[0]!).slug).toBe(
      'the-barley-mow-hartford',
    );
    expect(resolveRestaurant(restaurants, COPIED_VENUE_TABLE_SPECS[1]!).slug).toBe('the-prince');
    expect(
      resolveRestaurant(
        [
          restaurants[0]!,
          restaurants[2]!,
          { id: '4', name: 'Prince of Wales', slug: 'prince-of-wales-bromham' },
        ],
        COPIED_VENUE_TABLE_SPECS[1]!,
      ).slug,
    ).toBe('prince-of-wales-bromham');
    expect(
      resolveRestaurant(
        [...restaurants, { id: '4', name: 'Prince of Wales', slug: 'prince-of-wales-bromham' }],
        COPIED_VENUE_TABLE_SPECS[1]!,
      ).slug,
    ).toBe('the-prince');
    expect(() => resolveRestaurant(restaurants.slice(0, 1), COPIED_VENUE_TABLE_SPECS[1]!)).toThrow(
      /No restaurant matched The Prince/,
    );
    expect(() =>
      resolveRestaurant(
        [...restaurants, { id: '5', name: 'The Prince Bromham', slug: 'the-prince-bromham' }],
        COPIED_VENUE_TABLE_SPECS[1]!,
      ),
    ).toThrow(/Multiple restaurants matched The Prince/);
  });

  it('treats leftover copied table sizes as a mismatch', () => {
    const desired = { 2: 3, 4: 12, 6: 5 } as const;
    const current = summarizeByCapacity([
      ...Array.from({ length: 3 }, () => ({ capacity: 2 })),
      ...Array.from({ length: 12 }, () => ({ capacity: 4 })),
      ...Array.from({ length: 5 }, () => ({ capacity: 6 })),
    ]);

    expect(countsMatchDesired(current, desired)).toBe(true);
    expect(countsMatchDesired({ ...current, '8': 2 }, desired)).toBe(false);
    expect(countsMatchDesired({ '2': 18, '4': 36 }, desired)).toBe(false);
  });
});
