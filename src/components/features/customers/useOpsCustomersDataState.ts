'use client';

import { useCallback, useMemo } from 'react';

import { useOpsCustomers } from '@/hooks/useOpsCustomers';

import { buildOpsGuestRowViewModels } from './opsCustomersSelectors';
import { INFINITE_PAGE_SIZE, type OpsCustomersExportFilters } from './opsCustomersTypes';

import type { LastVisitFilter, MarketingFilter, SortBy, SortDirection } from './opsCustomersTypes';

type UseOpsCustomersDataStateArgs = {
  activeRestaurantId: string | null;
  isOnline: boolean;
  normalizedSearch: string;
  marketingOptIn: MarketingFilter;
  lastVisit: LastVisitFilter;
  minBookings: number;
  sort: SortDirection;
  sortBy: SortBy;
};

export function useOpsCustomersDataState({
  activeRestaurantId,
  isOnline,
  normalizedSearch,
  marketingOptIn,
  lastVisit,
  minBookings,
  sort,
  sortBy,
}: UseOpsCustomersDataStateArgs) {
  const filters = useMemo(() => {
    if (!activeRestaurantId) {
      return null;
    }

    return {
      restaurantId: activeRestaurantId,
      pageSize: INFINITE_PAGE_SIZE,
      sort,
      sortBy,
      search: normalizedSearch || undefined,
      marketingOptIn,
      lastVisit,
      minBookings,
    };
  }, [activeRestaurantId, lastVisit, marketingOptIn, minBookings, normalizedSearch, sort, sortBy]);

  const customersQuery = useOpsCustomers(filters);
  const {
    data,
    error,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = customersQuery;

  const customerPages = useMemo(() => data?.pages ?? [], [data?.pages]);
  const guestRows = useMemo(
    () => buildOpsGuestRowViewModels(customerPages.flatMap((page) => page.items)),
    [customerPages],
  );
  const summary = customerPages[0]?.summary ?? null;
  const isSummaryLoading = isLoading && !summary;
  const isSummaryUpdating = isFetching && !!summary && !isFetchingNextPage;
  const isRefreshing = isFetching && !isFetchingNextPage;

  const exportFilters = useMemo<OpsCustomersExportFilters>(
    () => ({
      sortBy,
      search: normalizedSearch || undefined,
      marketingOptIn,
      lastVisit,
      minBookings,
    }),
    [lastVisit, marketingOptIn, minBookings, normalizedSearch, sortBy],
  );

  const handleLoadMore = useCallback(() => {
    if (!isOnline) return;
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, isOnline]);

  return {
    customersQuery,
    error,
    isLoading,
    guestRows,
    isFetchingNextPage,
    hasNextPage: hasNextPage ?? false,
    isSummaryLoading,
    isSummaryUpdating,
    isRefreshing,
    summary,
    exportFilters,
    handleLoadMore,
    refetch,
  };
}
