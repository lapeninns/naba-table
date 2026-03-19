import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createScopedRealtimeInvalidator,
  matchesDashboardSummaryRealtimePayload,
} from '@src/utils/ops/realtimeInvalidation';

describe('createScopedRealtimeInvalidator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('does not let a cleaned-up invalidator disable the next subscription', () => {
    const invalidateQueries = vi.fn();
    const queryClient = {
      invalidateQueries,
    } as never;
    const queryKey = ['ops', 'dashboard', 'restaurant-1', 'summary', '2026-03-19'] as const;

    const first = createScopedRealtimeInvalidator({
      queryClient,
      queryKey,
      waitMs: 10,
    });
    first.deactivate();

    const second = createScopedRealtimeInvalidator({
      queryClient,
      queryKey,
      waitMs: 10,
    });

    first.run();
    second.run();
    vi.advanceTimersByTime(20);

    expect(invalidateQueries).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey,
      refetchType: 'active',
    });
  });
});

describe('matchesDashboardSummaryRealtimePayload', () => {
  it('matches updates that move a booking off the active day using the old row', () => {
    expect(
      matchesDashboardSummaryRealtimePayload({
        restaurantId: 'restaurant-1',
        effectiveDate: '2026-03-19',
        payload: {
          old: {
            restaurant_id: 'restaurant-1',
            booking_date: '2026-03-19',
          },
          new: {
            restaurant_id: 'restaurant-1',
            booking_date: '2026-03-20',
          },
        },
      }),
    ).toBe(true);
  });

  it('matches updates that move a booking onto the active day using the new row', () => {
    expect(
      matchesDashboardSummaryRealtimePayload({
        restaurantId: 'restaurant-1',
        effectiveDate: '2026-03-19',
        payload: {
          old: {
            restaurant_id: 'restaurant-1',
            booking_date: '2026-03-18',
          },
          new: {
            restaurant_id: 'restaurant-1',
            booking_date: '2026-03-19',
          },
        },
      }),
    ).toBe(true);
  });

  it('ignores payloads where neither old nor new matches the active dashboard identity', () => {
    expect(
      matchesDashboardSummaryRealtimePayload({
        restaurantId: 'restaurant-1',
        effectiveDate: '2026-03-19',
        payload: {
          old: {
            restaurant_id: 'restaurant-2',
            booking_date: '2026-03-18',
          },
          new: {
            restaurant_id: 'restaurant-2',
            booking_date: '2026-03-20',
          },
        },
      }),
    ).toBe(false);
  });

  it('falls back to restaurant-only matching when there is no effective date yet', () => {
    expect(
      matchesDashboardSummaryRealtimePayload({
        restaurantId: 'restaurant-1',
        effectiveDate: null,
        payload: {
          new: {
            restaurant_id: 'restaurant-1',
            booking_date: '2026-03-20',
          },
        },
      }),
    ).toBe(true);
  });
});
