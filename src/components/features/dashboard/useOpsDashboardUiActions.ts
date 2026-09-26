'use client';

import { usePathname } from 'next/navigation';
import { useCallback } from 'react';

import { useDateSwipe } from '@/hooks/useDateSwipe';
import { shiftDateKey } from '@/lib/utils/datetime';

import type { BookingFilter } from './BookingsFilterBar';
import type { DashboardSortDir, DashboardSortKey } from './useOpsDashboardQueryState';

export function useOpsDashboardUiActions(params: {
  summaryDate: string | null;
  requestedDate: string | null;
  selectedDate: string | null;
  filter: BookingFilter;
  sortKey: DashboardSortKey;
  sortDir: DashboardSortDir;
  searchQuery: string;
  onSelectDate: (date: string) => void;
}) {
  const pathname = usePathname();
  const {
    summaryDate,
    requestedDate,
    selectedDate,
    filter,
    sortKey,
    sortDir,
    searchQuery,
    onSelectDate,
  } = params;

  const handleShiftDate = useCallback(
    (days: number) => {
      const baseDate = requestedDate;
      if (!baseDate) return;
      const nextDate = shiftDateKey(baseDate, days);
      if (!nextDate) return;
      onSelectDate(nextDate);
    },
    [onSelectDate, requestedDate],
  );

  const handlePrevDate = useCallback(() => {
    handleShiftDate(-1);
  }, [handleShiftDate]);

  const handleNextDate = useCallback(() => {
    handleShiftDate(1);
  }, [handleShiftDate]);

  const handlePrint = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!summaryDate) return;
    const params = new URLSearchParams();
    const date = selectedDate ?? summaryDate;
    params.set('date', date);
    params.set('filter', filter);
    params.set('sortKey', sortKey);
    params.set('sortDir', sortDir);
    const trimmedSearch = searchQuery.trim();
    if (trimmedSearch) {
      params.set('search', trimmedSearch);
    }
    const printPath =
      pathname && pathname.endsWith('/dashboard') ? `${pathname}/print` : '/app/dashboard/print';
    const url = params.size > 0 ? `${printPath}?${params.toString()}` : printPath;
    window.open(url, '_blank', 'noopener');
  }, [filter, pathname, searchQuery, selectedDate, sortDir, sortKey, summaryDate]);

  const headerSwipeRef = useDateSwipe<HTMLElement>({
    onSwipeLeft: handleNextDate,
    onSwipeRight: handlePrevDate,
    threshold: 50,
  });

  return {
    headerSwipeRef,
    handleShiftDate,
    handlePrevDate,
    handleNextDate,
    handlePrint,
  };
}
