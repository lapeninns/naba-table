'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import useOnlineStatus from '@/hooks/useOnlineStatus';

import {
  buildOpsCustomersFilterBadges,
  buildOpsCustomersQueryString,
  decodeSortOption,
  encodeSortOption,
  parseOpsCustomersQueryState,
} from './opsCustomersSelectors';
import {
  DEFAULT_CUSTOMERS_FILTER_STATE,
  type LastVisitFilter,
  type MarketingFilter,
  type OpsCustomersFilterBadge,
  type OpsCustomersFilterState,
  type SortBy,
  type SortDirection,
  type SortOption,
} from './opsCustomersTypes';

export function useOpsCustomersQueryState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isOnline = useOnlineStatus();
  const [, startTransition] = useTransition();

  const targetPath = useMemo(() => {
    if (pathname?.startsWith('/app')) {
      return '/app/customers';
    }
    if (pathname) {
      return pathname;
    }
    return '/customers';
  }, [pathname]);

  const searchParamsKey = useMemo(() => searchParams?.toString() ?? '', [searchParams]);
  const parsedState = useMemo(
    () => parseOpsCustomersQueryState(searchParamsKey),
    [searchParamsKey],
  );
  const [state, setState] = useState<OpsCustomersFilterState>(parsedState);

  useEffect(() => {
    setState((current) => {
      if (
        current.searchTerm === parsedState.searchTerm &&
        current.marketingOptIn === parsedState.marketingOptIn &&
        current.lastVisit === parsedState.lastVisit &&
        current.minBookings === parsedState.minBookings &&
        current.sort === parsedState.sort &&
        current.sortBy === parsedState.sortBy
      ) {
        return current;
      }

      return parsedState;
    });
  }, [parsedState]);

  const deferredSearchTerm = useDebouncedValue(state.searchTerm, 250);
  const normalizedSearch = deferredSearchTerm.trim();
  const displaySearch = state.searchTerm.trim();

  const updateQueryParams = useCallback(
    (
      nextState: Pick<
        OpsCustomersFilterState,
        'marketingOptIn' | 'lastVisit' | 'minBookings' | 'sort' | 'sortBy'
      > & { search: string | null },
    ) => {
      if (!isOnline) {
        return;
      }

      const currentQuery = searchParams?.toString() ?? '';
      const nextQuery = buildOpsCustomersQueryString(currentQuery, nextState);
      if (nextQuery === currentQuery) {
        return;
      }

      startTransition(() => {
        router.replace(`${targetPath}${nextQuery ? `?${nextQuery}` : ''}`, {
          scroll: false,
        });
      });
    },
    [isOnline, router, searchParams, targetPath],
  );

  useEffect(() => {
    updateQueryParams({
      search: normalizedSearch || null,
      marketingOptIn: state.marketingOptIn,
      lastVisit: state.lastVisit,
      minBookings: state.minBookings,
      sort: state.sort,
      sortBy: state.sortBy,
    });
  }, [
    normalizedSearch,
    state.lastVisit,
    state.marketingOptIn,
    state.minBookings,
    state.sort,
    state.sortBy,
    updateQueryParams,
  ]);

  const activeFilterBadges = useMemo<OpsCustomersFilterBadge[]>(
    () =>
      buildOpsCustomersFilterBadges({
        searchTerm: displaySearch,
        marketingOptIn: state.marketingOptIn,
        lastVisit: state.lastVisit,
        minBookings: state.minBookings,
      }),
    [displaySearch, state.lastVisit, state.marketingOptIn, state.minBookings],
  );

  const hasActiveFilters =
    activeFilterBadges.length > 0 ||
    state.sortBy !== DEFAULT_CUSTOMERS_FILTER_STATE.sortBy ||
    state.sort !== DEFAULT_CUSTOMERS_FILTER_STATE.sort;

  const sortOption = useMemo(
    () => encodeSortOption(state.sortBy, state.sort),
    [state.sort, state.sortBy],
  );

  const setSearchTerm = useCallback((searchTerm: string) => {
    setState((current) =>
      current.searchTerm === searchTerm ? current : { ...current, searchTerm },
    );
  }, []);

  const setMarketingOptIn = useCallback((marketingOptIn: MarketingFilter) => {
    setState((current) =>
      current.marketingOptIn === marketingOptIn ? current : { ...current, marketingOptIn },
    );
  }, []);

  const setLastVisit = useCallback((lastVisit: LastVisitFilter) => {
    setState((current) => (current.lastVisit === lastVisit ? current : { ...current, lastVisit }));
  }, []);

  const setMinBookings = useCallback((minBookings: number) => {
    setState((current) =>
      current.minBookings === minBookings ? current : { ...current, minBookings },
    );
  }, []);

  const setSortState = useCallback((sortBy: SortBy, sort: SortDirection) => {
    setState((current) =>
      current.sortBy === sortBy && current.sort === sort ? current : { ...current, sortBy, sort },
    );
  }, []);

  const handleSortChange = useCallback(
    (value: SortOption) => {
      const decoded = decodeSortOption(value);
      setSortState(decoded.sortBy, decoded.sort);
    },
    [setSortState],
  );

  const handleMinBookingsChange = useCallback(
    (value: string) => {
      const parsed = Number.parseInt(value, 10);
      setMinBookings(Number.isFinite(parsed) ? parsed : 0);
    },
    [setMinBookings],
  );

  const handleClearFilters = useCallback(() => {
    setState(DEFAULT_CUSTOMERS_FILTER_STATE);
  }, []);

  return {
    isOnline,
    searchTerm: state.searchTerm,
    marketingOptIn: state.marketingOptIn,
    lastVisit: state.lastVisit,
    minBookings: state.minBookings,
    sort: state.sort,
    sortBy: state.sortBy,
    normalizedSearch,
    sortOption,
    activeFilterBadges,
    hasActiveFilters,
    setSearchTerm,
    setMarketingOptIn,
    setLastVisit,
    handleMinBookingsChange,
    handleSortChange,
    handleClearFilters,
  };
}
