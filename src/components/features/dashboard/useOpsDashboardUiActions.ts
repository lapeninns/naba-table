'use client';

import { usePathname } from 'next/navigation';
import { useCallback } from 'react';

import { useDateSwipe } from '@/hooks/useDateSwipe';
import { formatDateKey, getDateInTimezone, getTodayInTimezone } from '@/lib/utils/datetime';

import type { BookingFilter } from './BookingsFilterBar';
import type { DashboardSortDir, DashboardSortKey } from './useOpsDashboardQueryState';
import type { useOpsCancelBooking } from '@/hooks/ops/useOpsCancelBooking';
import type { BookingDTO } from '@/hooks/useBookings';

export function useOpsDashboardUiActions(params: {
  summaryDate: string | null;
  requestedDate: string | null;
  selectedDate: string | null;
  filter: BookingFilter;
  sortKey: DashboardSortKey;
  sortDir: DashboardSortDir;
  searchQuery: string;
  restaurantId: string | null;
  restaurantTimezone: string | null;
  cancelBooking: BookingDTO | null;
  cancelBookingMutation: ReturnType<typeof useOpsCancelBooking>;
  onCancelOpenChange: (open: boolean) => void;
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
    restaurantId,
    restaurantTimezone,
    cancelBooking,
    cancelBookingMutation,
    onCancelOpenChange,
    onSelectDate,
  } = params;

  const handleShiftDate = useCallback(
    (days: number) => {
      const baseDate = requestedDate;
      if (!baseDate) return;
      const nextDate = new Date(`${baseDate}T00:00:00`);
      if (Number.isNaN(nextDate.getTime())) return;
      nextDate.setDate(nextDate.getDate() + days);
      onSelectDate(formatDateKey(nextDate));
    },
    [onSelectDate, requestedDate],
  );

  const handlePrevDate = useCallback(() => {
    handleShiftDate(-1);
  }, [handleShiftDate]);

  const handleNextDate = useCallback(() => {
    handleShiftDate(1);
  }, [handleShiftDate]);

  const resolveCancelTargetDate = useCallback(
    (booking: BookingDTO, timezone: string) => {
      if (booking.startIso) {
        const startDate = new Date(booking.startIso);
        if (!Number.isNaN(startDate.getTime())) {
          return getDateInTimezone(startDate, timezone);
        }
      }
      if (requestedDate) {
        return requestedDate;
      }
      return getTodayInTimezone(timezone);
    },
    [requestedDate],
  );

  const handleConfirmCancel = useCallback(async () => {
    if (!cancelBooking) return;
    const resolvedRestaurantId = cancelBooking.restaurantId ?? restaurantId;
    if (!resolvedRestaurantId) return;
    const timezone = cancelBooking.restaurantTimezone ?? restaurantTimezone ?? 'UTC';
    const targetDate = resolveCancelTargetDate(cancelBooking, timezone);
    try {
      await cancelBookingMutation.mutateAsync({
        bookingId: cancelBooking.id,
        restaurantId: resolvedRestaurantId,
        targetDate,
      });
    } finally {
      onCancelOpenChange(false);
    }
  }, [
    cancelBooking,
    cancelBookingMutation,
    onCancelOpenChange,
    resolveCancelTargetDate,
    restaurantId,
    restaurantTimezone,
  ]);

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
    handleConfirmCancel,
    handlePrint,
  };
}
