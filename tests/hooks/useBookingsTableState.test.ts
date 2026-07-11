import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useBookingsTableState } from '@/hooks/useBookingsTableState';

const NOW_ISO = '2026-07-11T12:00:00.000Z';

describe('useBookingsTableState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW_ISO));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('@contract starts on the upcoming filter with ascending sort from now', () => {
    const { result } = renderHook(() => useBookingsTableState());

    expect(result.current.statusFilter).toBe('upcoming');
    expect(result.current.page).toBe(1);
    expect(result.current.pageSize).toBe(10);
    expect(result.current.queryFilters).toEqual({
      page: 1,
      pageSize: 10,
      from: new Date(NOW_ISO),
      sort: 'asc',
    });
  });

  it('@contract maps every status filter branch to its query filters', () => {
    const { result } = renderHook(() => useBookingsTableState());

    act(() => result.current.handleStatusFilterChange('past'));
    expect(result.current.queryFilters).toEqual({
      page: 1,
      pageSize: 10,
      to: new Date(NOW_ISO),
      sort: 'desc',
    });

    act(() => result.current.handleStatusFilterChange('cancelled'));
    expect(result.current.queryFilters).toEqual({
      page: 1,
      pageSize: 10,
      status: 'cancelled',
      sort: 'desc',
    });

    act(() => result.current.handleStatusFilterChange('recent'));
    expect(result.current.queryFilters).toEqual({ page: 1, pageSize: 10, sort: 'desc' });

    act(() => result.current.handleStatusFilterChange('all'));
    expect(result.current.queryFilters).toEqual({ page: 1, pageSize: 10, sort: 'asc' });

    act(() => result.current.handleStatusFilterChange('confirmed'));
    expect(result.current.queryFilters).toEqual({
      page: 1,
      pageSize: 10,
      status: 'confirmed',
      sort: 'asc',
    });
  });

  it('@contract resets pagination when the status filter changes', () => {
    const { result } = renderHook(() => useBookingsTableState());

    act(() => result.current.handlePageChange(3, 100));
    expect(result.current.page).toBe(3);

    act(() => result.current.handleStatusFilterChange('past'));
    expect(result.current.page).toBe(1);
  });

  it('@contract clamps page changes to the valid range', () => {
    const { result } = renderHook(() => useBookingsTableState({ pageSize: 10 }));

    act(() => result.current.handlePageChange(0, 100));
    expect(result.current.page).toBe(1);

    act(() => result.current.handlePageChange(99, 25));
    expect(result.current.page).toBe(3);

    act(() => result.current.handlePageChange(5, 0));
    expect(result.current.page).toBe(1);
  });

  it('@contract ignores NaN page changes', () => {
    const { result } = renderHook(() => useBookingsTableState());

    act(() => result.current.handlePageChange(2, 100));
    act(() => result.current.handlePageChange(Number.NaN, 100));

    expect(result.current.page).toBe(2);
  });

  it('@contract honours initial options', () => {
    const { result } = renderHook(() =>
      useBookingsTableState({ initialStatus: 'cancelled', initialPage: 4, pageSize: 25 }),
    );

    expect(result.current.statusFilter).toBe('cancelled');
    expect(result.current.page).toBe(4);
    expect(result.current.queryFilters.pageSize).toBe(25);
  });
});
