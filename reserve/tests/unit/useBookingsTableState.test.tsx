import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useBookingsTableState } from '@/hooks/useBookingsTableState';

describe('useBookingsTableState', () => {
  it('defaults to upcoming filter with future range', () => {
    const { result } = renderHook(() => useBookingsTableState());

    const { status, from, sort } = result.current.queryFilters;
    expect(status).toBeUndefined();
    expect(from).toBeInstanceOf(Date);
    expect((from as Date).getTime()).not.toBeNaN();
    expect(sort).toBe('asc');
  });

  it('maps upcoming filter to future date range', () => {
    const { result } = renderHook(() => useBookingsTableState());

    act(() => {
      result.current.handleStatusFilterChange('upcoming');
    });

    const { status, from, sort } = result.current.queryFilters;
    expect(status).toBeUndefined();
    expect(from).toBeInstanceOf(Date);
    expect((from as Date).getTime()).not.toBeNaN();
    expect(sort).toBe('asc');
  });

  it('maps past filter to descending sort with end date', () => {
    const { result } = renderHook(() => useBookingsTableState());

    act(() => {
      result.current.handleStatusFilterChange('past');
    });

    const { status, to, sort } = result.current.queryFilters;
    expect(status).toBeUndefined();
    expect(to).toBeInstanceOf(Date);
    expect((to as Date).getTime()).not.toBeNaN();
    expect(sort).toBe('desc');
  });

  it('maps cancelled filter to cancelled status', () => {
    const { result } = renderHook(() => useBookingsTableState());

    act(() => {
      result.current.handleStatusFilterChange('cancelled');
    });

    const { status, sort } = result.current.queryFilters;
    expect(status).toBe('cancelled');
    expect(sort).toBe('desc');
  });
});
