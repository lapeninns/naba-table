import { DateTime } from 'luxon';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearAllDemandProfileCaches,
  resolveDemandMultiplier,
} from '@/server/capacity/demand-profiles';

class DemandProfileQuery {
  public eqCalls: Array<[string, unknown]> = [];

  constructor(private readonly rows: unknown[]) {}

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.eqCalls.push([column, value]);
    return this;
  }

  then<TResult1 = { data: unknown[]; error: null }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: unknown[]; error: null }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve({ data: this.rows, error: null }).then(onfulfilled, onrejected);
  }
}

describe('resolveDemandMultiplier', () => {
  beforeEach(() => {
    clearAllDemandProfileCaches();
  });

  it('filters database demand profiles by current minute and priority', async () => {
    const query = new DemandProfileQuery([
      {
        multiplier: 2,
        service_window: 'dinner',
        start_minute: 20 * 60,
        end_minute: 21 * 60,
        priority: 99,
        label: 'late-peak',
      },
      {
        multiplier: 1.2,
        service_window: 'dinner',
        start_minute: 18 * 60,
        end_minute: 22 * 60,
        priority: 1,
        label: 'broad-dinner',
      },
      {
        multiplier: 1.8,
        service_window: 'dinner',
        start_minute: 19 * 60,
        end_minute: 20 * 60,
        priority: 5,
        label: 'current-peak',
      },
    ]);
    const client = {
      from: vi.fn(() => query),
    };

    const result = await resolveDemandMultiplier({
      restaurantId: 'restaurant-1',
      serviceKey: 'dinner',
      serviceStart: DateTime.fromISO('2026-05-15T19:30:00', { zone: 'Europe/London' }),
      timezone: 'Europe/London',
      client: client as never,
    });

    expect(result.multiplier).toBe(1.8);
    expect(result.rule).toMatchObject({
      label: 'current-peak',
      source: 'restaurant',
      start: '19:00',
      end: '19:59',
      priority: 5,
    });
    expect(query.eqCalls).toEqual([
      ['restaurant_id', 'restaurant-1'],
      ['day_of_week', 5],
      ['service_window', 'dinner'],
    ]);
  });

  it('breaks database demand profile ties by narrower matching window', async () => {
    const query = new DemandProfileQuery([
      {
        multiplier: 1.1,
        service_window: 'dinner',
        start_minute: 17 * 60,
        end_minute: 23 * 60,
        priority: 3,
        label: 'broad',
      },
      {
        multiplier: 1.4,
        service_window: 'dinner',
        start_minute: 19 * 60,
        end_minute: 20 * 60,
        priority: 3,
        label: 'specific',
      },
    ]);

    const result = await resolveDemandMultiplier({
      restaurantId: 'restaurant-1',
      serviceKey: 'dinner',
      serviceStart: DateTime.fromISO('2026-05-15T19:30:00', { zone: 'Europe/London' }),
      timezone: 'Europe/London',
      client: { from: vi.fn(() => query) } as never,
    });

    expect(result.multiplier).toBe(1.4);
    expect(result.rule?.label).toBe('specific');
  });
});
