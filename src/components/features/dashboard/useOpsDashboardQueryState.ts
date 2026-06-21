'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState, useTransition } from 'react';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { sanitizeDateParam } from '@/utils/ops/dashboard';

import { normalizeBookingFilter } from './bookingFilters';

import type { BookingFilter } from './BookingsFilterBar';
import type { ChangeEvent } from 'react';

export type DashboardSortKey = 'time' | 'party' | 'name';
export type DashboardSortDir = 'asc' | 'desc';

const DEFAULT_FILTER: BookingFilter = 'all';
const SORT_KEYS: DashboardSortKey[] = ['time', 'party', 'name'];
const SORT_DIRS: DashboardSortDir[] = ['asc', 'desc'];

const parseFilterParam = (value: string | null): BookingFilter | null => {
  return normalizeBookingFilter(value);
};

const parseSortKeyParam = (value: string | null): DashboardSortKey => {
  if (!value) return 'time';
  return SORT_KEYS.includes(value as DashboardSortKey) ? (value as DashboardSortKey) : 'time';
};

const parseSortDirParam = (value: string | null): DashboardSortDir => {
  if (!value) return 'asc';
  return SORT_DIRS.includes(value as DashboardSortDir) ? (value as DashboardSortDir) : 'asc';
};

export function useOpsDashboardQueryState({ initialDate }: { initialDate: string | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  const [filter, setFilter] = useState<BookingFilter>(() => {
    const initial = parseFilterParam(searchParams?.get('filter') ?? null);
    return initial ?? DEFAULT_FILTER;
  });
  const [searchQuery, setSearchQuery] = useState(() => searchParams?.get('search') ?? '');
  const deferredSearchQuery = useDebouncedValue(searchQuery, 250);
  const [selectedDate, setSelectedDate] = useState<string | null>(
    sanitizeDateParam(initialDate ?? undefined),
  );
  const [sortKey, setSortKeyState] = useState<DashboardSortKey>(() =>
    parseSortKeyParam(searchParams?.get('sortKey') ?? null),
  );
  const [sortDir, setSortDirState] = useState<DashboardSortDir>(() =>
    parseSortDirParam(searchParams?.get('sortDir') ?? null),
  );
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const updateQueryParams = useCallback(
    (updates: {
      date?: string | null;
      filter?: BookingFilter | null;
      search?: string | null;
      sortKey?: DashboardSortKey | null;
      sortDir?: DashboardSortDir | null;
    }) => {
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      const apply = (key: string, value?: string | null) => {
        if (value === null || value === undefined || value === '') {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      };

      if ('date' in updates) apply('date', updates.date ?? null);
      if ('filter' in updates) apply('filter', updates.filter ?? null);
      if ('search' in updates) apply('search', updates.search ?? null);
      if ('sortKey' in updates) apply('sortKey', updates.sortKey ?? null);
      if ('sortDir' in updates) apply('sortDir', updates.sortDir ?? null);

      const nextQuery = params.toString();
      const currentQuery = searchParams?.toString() ?? '';
      if (nextQuery === currentQuery) return;

      startTransition(() => {
        const query = nextQuery ? `?${nextQuery}` : '';
        router.replace(`${pathname}${query}`);
      });
    },
    [pathname, router, searchParams],
  );

  const searchParamsKey = searchParams?.toString() ?? '';

  useEffect(() => {
    const params = new URLSearchParams(searchParamsKey);
    const rawFilter = params.get('filter');
    const nextFilter = parseFilterParam(rawFilter) ?? DEFAULT_FILTER;
    const nextSearch = params.get('search') ?? '';
    const nextSortKey = parseSortKeyParam(params.get('sortKey'));
    const nextSortDir = parseSortDirParam(params.get('sortDir'));
    const hasDateParam = params.has('date');
    const nextDate = hasDateParam ? sanitizeDateParam(params.get('date') ?? undefined) : null;

    setFilter((current) => (current === nextFilter ? current : nextFilter));
    setSearchQuery((current) => (current === nextSearch ? current : nextSearch));
    setSortKeyState((current) => (current === nextSortKey ? current : nextSortKey));
    setSortDirState((current) => (current === nextSortDir ? current : nextSortDir));
    setSelectedDate((current) => {
      if (!hasDateParam) {
        return current === null ? current : null;
      }
      return current === nextDate ? current : nextDate;
    });

    if (rawFilter === 'completed') {
      updateQueryParams({ filter: nextFilter === DEFAULT_FILTER ? null : nextFilter });
    }
  }, [searchParamsKey, updateQueryParams]);

  const handleSelectFilter = useCallback(
    (nextFilter: BookingFilter) => {
      setFilter(nextFilter);
      updateQueryParams({ filter: nextFilter === DEFAULT_FILTER ? null : nextFilter });
    },
    [updateQueryParams],
  );

  const handleSelectDate = useCallback(
    (date: string) => {
      setSelectedDate(date);
      updateQueryParams({ date });
    },
    [updateQueryParams],
  );

  const handleSearchChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  }, []);

  const handleSortKeyChange = useCallback(
    (value: DashboardSortKey) => {
      setSortKeyState(value);
      updateQueryParams({
        sortKey: value === 'time' ? null : value,
        sortDir: sortDir === 'asc' ? null : sortDir,
      });
    },
    [sortDir, updateQueryParams],
  );

  const handleSortDirChange = useCallback(
    (value: DashboardSortDir) => {
      setSortDirState(value);
      updateQueryParams({
        sortKey: sortKey === 'time' ? null : sortKey,
        sortDir: value === 'asc' ? null : value,
      });
    },
    [sortKey, updateQueryParams],
  );

  useEffect(() => {
    const trimmed = deferredSearchQuery.trim();
    updateQueryParams({ search: trimmed ? trimmed : null });
  }, [deferredSearchQuery, updateQueryParams]);

  return {
    filter,
    searchQuery,
    deferredSearchQuery,
    selectedDate,
    sortKey,
    sortDir,
    isCalendarOpen,
    setIsCalendarOpen,
    handleSelectFilter,
    handleSelectDate,
    handleSearchChange,
    handleSortKeyChange,
    handleSortDirChange,
  };
}
