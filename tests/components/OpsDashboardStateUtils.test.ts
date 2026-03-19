import { describe, expect, it } from 'vitest';

import {
  getDashboardDayBoundsUtc,
  getRequestedDashboardDate,
  isDashboardSummaryMismatch,
  resolveDashboardDateState,
} from '@src/utils/ops/dashboard';

describe('dashboard state utilities', () => {
  it('prefers the explicitly selected date over the loaded summary date', () => {
    expect(
      getRequestedDashboardDate({
        selectedDate: '2026-03-20',
        summaryDate: '2026-03-19',
        isSummaryMismatch: true,
      }),
    ).toBe('2026-03-20');
  });

  it('falls back to the summary date when no explicit date is selected', () => {
    expect(
      getRequestedDashboardDate({
        selectedDate: null,
        summaryDate: '2026-03-19',
      }),
    ).toBe('2026-03-19');
  });

  it('waits for fresh summary data when placeholder data belongs to another state', () => {
    expect(
      getRequestedDashboardDate({
        selectedDate: null,
        summaryDate: '2026-03-19',
        isSummaryMismatch: true,
      }),
    ).toBeNull();
  });

  it('detects restaurant mismatches while placeholder data is still on screen', () => {
    expect(
      isDashboardSummaryMismatch({
        restaurantId: 'restaurant-b',
        selectedDate: '2026-03-19',
        summary: { restaurantId: 'restaurant-a', date: '2026-03-19' },
      }),
    ).toBe(true);
  });

  it('detects date mismatches while a new day is loading', () => {
    expect(
      isDashboardSummaryMismatch({
        restaurantId: 'restaurant-a',
        selectedDate: '2026-03-20',
        summary: { restaurantId: 'restaurant-a', date: '2026-03-19' },
      }),
    ).toBe(true);
  });

  it('treats matching summary identity as ready data', () => {
    expect(
      isDashboardSummaryMismatch({
        restaurantId: 'restaurant-a',
        selectedDate: '2026-03-19',
        summary: { restaurantId: 'restaurant-a', date: '2026-03-19' },
      }),
    ).toBe(false);
  });

  it('builds UTC day bounds from the restaurant timezone', () => {
    expect(getDashboardDayBoundsUtc('2026-07-14', 'Europe/London')).toEqual({
      startUtcIso: '2026-07-13T23:00:00.000Z',
      endUtcIso: '2026-07-14T23:00:00.000Z',
    });
  });

  it('resolves the active dashboard date from matching summary data', () => {
    expect(
      resolveDashboardDateState({
        restaurantId: 'restaurant-a',
        explicitDate: null,
        summary: { restaurantId: 'restaurant-a', date: '2026-03-19' },
      }),
    ).toEqual({
      explicitDate: null,
      activeDate: '2026-03-19',
      isSummaryMismatch: false,
    });
  });

  it('keeps the active dashboard date empty while placeholder summary data mismatches', () => {
    expect(
      resolveDashboardDateState({
        restaurantId: 'restaurant-b',
        explicitDate: null,
        summary: { restaurantId: 'restaurant-a', date: '2026-03-19' },
      }),
    ).toEqual({
      explicitDate: null,
      activeDate: null,
      isSummaryMismatch: true,
    });
  });
});
