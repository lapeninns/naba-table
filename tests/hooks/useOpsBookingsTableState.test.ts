import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useOpsBookingsTableState } from '@src/hooks/ops/useOpsBookingsTableState';

import type { OpsBookingStatus } from '@/types/ops';

const NOW_ISO = '2026-07-11T12:00:00.000Z';

const UPCOMING_STATUSES: OpsBookingStatus[] = [
  'pending',
  'pending_allocation',
  'confirmed',
  'checked_in',
  'PRIORITY_WAITLIST',
];

// Stable references: the hook re-syncs its store whenever the initial props change
// identity, so tests pass module-scope constants exactly like a memoised caller.
const EMPTY_STATUSES: OpsBookingStatus[] = [];
const defaultOptions = {
  initialStatus: 'upcoming' as const,
  initialQuery: '',
  initialSelectedStatuses: EMPTY_STATUSES,
};

function renderTableState(options = defaultOptions) {
  return renderHook(() => useOpsBookingsTableState(options));
}

describe('useOpsBookingsTableState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW_ISO));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('@contract defaults to upcoming with the active status set and ascending start order', () => {
    const { result } = renderTableState();

    expect(result.current.statusFilter).toBe('upcoming');
    expect(result.current.queryFilters).toEqual({
      from: new Date(NOW_ISO),
      sort: 'asc',
      sortBy: 'start_at',
      statuses: UPCOMING_STATUSES,
    });
  });

  it('@contract maps each status filter branch onto query filters', () => {
    const { result } = renderTableState();

    act(() => result.current.handleStatusFilterChange('past'));
    expect(result.current.queryFilters).toEqual({
      to: new Date(NOW_ISO),
      sort: 'desc',
      sortBy: 'start_at',
    });

    act(() => result.current.handleStatusFilterChange('cancelled'));
    expect(result.current.queryFilters).toEqual({
      status: 'cancelled',
      sort: 'desc',
      sortBy: 'start_at',
    });

    act(() => result.current.handleStatusFilterChange('recent'));
    expect(result.current.queryFilters).toEqual({ sort: 'desc', sortBy: 'created_at' });

    act(() => result.current.handleStatusFilterChange('all'));
    expect(result.current.queryFilters).toEqual({ sort: 'asc', sortBy: 'start_at' });

    act(() => result.current.handleStatusFilterChange('no_show'));
    expect(result.current.queryFilters).toEqual({
      status: 'no_show',
      sort: 'asc',
      sortBy: 'start_at',
    });
  });

  it('@contract trims the search input into the deferred query filter', async () => {
    vi.useRealTimers();
    const { result } = renderTableState();

    act(() => result.current.handleSearchChange('  fox table  '));

    expect(result.current.search).toBe('  fox table  ');
    await waitFor(() => expect(result.current.queryFilters.query).toBe('fox table'));
  });

  it('@contract toggles individual statuses in and out of the selection', () => {
    const { result } = renderTableState();

    act(() => result.current.toggleSelectedStatus('confirmed'));
    expect(result.current.selectedStatuses).toEqual(['confirmed']);

    act(() => result.current.toggleSelectedStatus('cancelled'));
    expect(result.current.selectedStatuses).toEqual(['confirmed', 'cancelled']);

    act(() => result.current.toggleSelectedStatus('confirmed'));
    expect(result.current.selectedStatuses).toEqual(['cancelled']);
  });

  it('@contract lets explicit selected statuses override the filter branch statuses', () => {
    const { result } = renderTableState();

    act(() => result.current.handleStatusFilterChange('past'));
    act(() => result.current.setSelectedStatuses(['no_show']));

    expect(result.current.queryFilters.statuses).toEqual(['no_show']);

    act(() => result.current.clearSelectedStatuses());
    expect(result.current.queryFilters.statuses).toBeUndefined();
  });

  it('@contract honours custom initial options', () => {
    const options = {
      initialStatus: 'cancelled' as const,
      initialQuery: 'smith',
      initialSelectedStatuses: EMPTY_STATUSES,
    };
    const { result } = renderHook(() => useOpsBookingsTableState(options));

    expect(result.current.statusFilter).toBe('cancelled');
    expect(result.current.search).toBe('smith');
  });
});
