import { describe, expect, it, vi } from 'vitest';

import { readCapacityVersions } from '../src/capacity-versions';

describe('N+1 query budget', () => {
  it('reads every restaurant version in one Durable Object storage operation', async () => {
    const get = vi.fn().mockResolvedValue(
      new Map([
        ['inv:restaurant-1', 2],
        ['adj:restaurant-1', 3],
        ['inv:restaurant-2', 5],
      ]),
    );

    await expect(readCapacityVersions({ get }, ['restaurant-1', 'restaurant-2'])).resolves.toEqual({
      'restaurant-1': { inv: 2, adj: 3 },
      'restaurant-2': { inv: 5, adj: 0 },
    });
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith([
      'inv:restaurant-1',
      'adj:restaurant-1',
      'inv:restaurant-2',
      'adj:restaurant-2',
    ]);
  });
});
