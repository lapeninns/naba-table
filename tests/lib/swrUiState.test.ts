import { describe, expect, it } from 'vitest';

import { getSwrUiState } from '@/lib/query/swrUiState';

import type { UseQueryResult } from '@tanstack/react-query';

function mockQuery(overrides: Partial<UseQueryResult<unknown>>): UseQueryResult<unknown> {
  return {
    data: undefined,
    error: null,
    isError: false,
    isPending: true,
    isLoading: true,
    isLoadingError: false,
    isRefetchError: false,
    isSuccess: false,
    isFetching: true,
    isFetched: false,
    isFetchedAfterMount: false,
    isPlaceholderData: false,
    isRefetching: false,
    isStale: false,
    status: 'pending',
    fetchStatus: 'fetching',
    dataUpdatedAt: 0,
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null,
    errorUpdateCount: 0,
    refetch: (() =>
      Promise.resolve({} as UseQueryResult<unknown>)) as UseQueryResult<unknown>['refetch'],
    promise: Promise.resolve(undefined),
    ...overrides,
  } as UseQueryResult<unknown>;
}

describe('getSwrUiState', () => {
  it('detects initial load: pending, no data, no placeholder', () => {
    const result = getSwrUiState(
      mockQuery({ isPending: true, isFetching: true, isPlaceholderData: false, data: undefined }),
    );

    expect(result).toEqual({
      isInitialLoad: true,
      isRefetching: false,
      isPlaceholderStale: false,
    });
  });

  it('detects same-key refetch: has data, fetching, not placeholder', () => {
    const result = getSwrUiState(
      mockQuery({
        isPending: false,
        isFetching: true,
        isPlaceholderData: false,
        data: { items: [] },
      }),
    );

    expect(result).toEqual({
      isInitialLoad: false,
      isRefetching: true,
      isPlaceholderStale: false,
    });
  });

  it('detects placeholder-stale: fetching with placeholder data', () => {
    const result = getSwrUiState(
      mockQuery({
        isPending: false,
        isFetching: true,
        isPlaceholderData: true,
        data: { items: ['stale'] },
      }),
    );

    expect(result).toEqual({
      isInitialLoad: false,
      isRefetching: false,
      isPlaceholderStale: true,
    });
  });

  it('returns all-false when not fetching and has data', () => {
    const result = getSwrUiState(
      mockQuery({
        isPending: false,
        isFetching: false,
        isPlaceholderData: false,
        data: { items: ['fresh'] },
      }),
    );

    expect(result).toEqual({
      isInitialLoad: false,
      isRefetching: false,
      isPlaceholderStale: false,
    });
  });

  it('handles query with no placeholderData configured gracefully', () => {
    // Query that never sets placeholderData — isPending on first load
    const result = getSwrUiState(
      mockQuery({
        isPending: true,
        isFetching: true,
        isPlaceholderData: false,
        data: undefined,
      }),
    );

    expect(result.isInitialLoad).toBe(true);
    expect(result.isPlaceholderStale).toBe(false);
  });

  it('does not treat disabled idle queries as an initial load', () => {
    const result = getSwrUiState(
      mockQuery({
        isPending: true,
        isFetching: false,
        isPlaceholderData: false,
        data: undefined,
        fetchStatus: 'idle',
      }),
    );

    expect(result).toEqual({
      isInitialLoad: false,
      isRefetching: false,
      isPlaceholderStale: false,
    });
  });
});
