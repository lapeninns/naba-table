'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useMemo } from 'react';

import { useOpsActiveMembership } from '@/contexts/ops-session';
import { useOpsBookingHeatmap } from '@/hooks/ops/useOpsBookingHeatmap';
import { useOpsBookingLifecycleActions } from '@/hooks/ops/useOpsBookingStatusActions';
import { useOpsCancelBooking } from '@/hooks/ops/useOpsCancelBooking';
import { useOpsRestaurantDetails } from '@/hooks/ops/useOpsRestaurantDetails';
import { useOpsTableAssignmentActions } from '@/hooks/ops/useOpsTableAssignments';
import { useOpsTodaySummary } from '@/hooks/ops/useOpsTodaySummary';
import { useDateSwipe } from '@/hooks/useDateSwipe';
import { formatDateKey, getDateInTimezone, getTodayInTimezone } from '@/lib/utils/datetime';
import {
  computeCalendarRange,
  resolveDashboardDateState,
} from '@/utils/ops/dashboard';

import {
  getBookingTabCounts,
  getEmptyBookingTabCounts,
} from './bookingFilters';
import { useOpsDashboardBookingActions } from './useOpsDashboardBookingActions';
import { useOpsDashboardDialogs } from './useOpsDashboardDialogs';
import { useOpsDashboardQueryState } from './useOpsDashboardQueryState';

import type { UseOpsDashboardStateProps } from './types';
import type { BookingDTO } from '@/hooks/useBookings';

export function useOpsDashboardState({ initialDate }: UseOpsDashboardStateProps) {
  const membership = useOpsActiveMembership();
  const pathname = usePathname();
  const cancelBookingMutation = useOpsCancelBooking();
  const queryState = useOpsDashboardQueryState({ initialDate });
  const dialogs = useOpsDashboardDialogs();
  const {
    filter,
    searchQuery,
    deferredSearchQuery,
    selectedDate: explicitDate,
    sortKey,
    sortDir,
    isCalendarOpen,
    setIsCalendarOpen,
    handleSelectFilter,
    handleSelectDate,
    handleSearchChange,
    handleSortKeyChange,
    handleSortDirChange,
  } = queryState;
  const {
    detailsBooking,
    isDetailsOpen,
    editBooking,
    isEditOpen,
    cancelBooking,
    isCancelOpen,
    handleDetails,
    handleEdit,
    handleDetailsOpenChange,
    handleEditOpenChange,
    handleCancelRequest,
    handleCancelOpenChange,
  } = dialogs;

  const restaurantId = membership?.restaurantId ?? null;
  const restaurantDetails = useOpsRestaurantDetails(restaurantId ?? null);

  const summaryQuery = useOpsTodaySummary({ restaurantId, targetDate: explicitDate });
  const {
    data: summaryData,
    isLoading: isSummaryLoading,
    isFetching: isSummaryFetching,
    isError: isSummaryError,
    refetch: refetchSummary,
  } = summaryQuery;
  const summary = summaryData ?? null;
  const dateState = resolveDashboardDateState({
    summary,
    restaurantId,
    explicitDate,
  });
  const isSummaryMismatch = dateState.isSummaryMismatch;
  const requestedDate = dateState.activeDate;
  const restaurantSlug = restaurantDetails.data?.slug ?? membership?.restaurantSlug ?? null;
  const restaurantTimezone =
    restaurantDetails.data?.timezone ?? (!isSummaryMismatch ? summary?.timezone ?? null : null);
  const restaurantName = membership?.restaurantName ?? 'Restaurant';

  const heatmapRange = useMemo(() => {
    if (!requestedDate) return null;
    return computeCalendarRange(requestedDate);
  }, [requestedDate]);
  const heatmapQuery = useOpsBookingHeatmap({
    restaurantId,
    startDate: heatmapRange?.start ?? null,
    endDate: heatmapRange?.end ?? null,
    enabled: Boolean(restaurantId && heatmapRange && isCalendarOpen),
  });

  const bookingLifecycleMutations = useOpsBookingLifecycleActions();
  const assignmentDate = explicitDate;
  const tableAssignmentActions = useOpsTableAssignmentActions({
    restaurantId,
    date: assignmentDate,
  });
  const allowTableAssignments = useMemo(() => {
    const targetDate = requestedDate;
    if (!targetDate) return true;

    const timezone = restaurantTimezone ?? summary?.timezone ?? 'UTC';
    const today = getTodayInTimezone(timezone);
    return targetDate >= today;
  }, [requestedDate, restaurantTimezone, summary?.timezone]);
  const bookingActions = useOpsDashboardBookingActions({
    summary,
    restaurantId,
    selectedDate: explicitDate,
    refetchSummary,
    bookingLifecycleMutations,
    tableAssignmentActions,
  });

  const handleShiftDate = useCallback(
    (days: number) => {
      const baseDate = requestedDate;
      if (!baseDate) return;
      const nextDate = new Date(`${baseDate}T00:00:00`);
      if (Number.isNaN(nextDate.getTime())) return;
      nextDate.setDate(nextDate.getDate() + days);
      handleSelectDate(formatDateKey(nextDate));
    },
    [handleSelectDate, requestedDate],
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
      handleCancelOpenChange(false);
    }
  }, [
    cancelBooking,
    cancelBookingMutation,
    handleCancelOpenChange,
    resolveCancelTargetDate,
    restaurantId,
    restaurantTimezone,
  ]);

  const handlePrint = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!summary) return;
    const params = new URLSearchParams();
    const date = explicitDate ?? summary.date;
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
  }, [explicitDate, filter, pathname, searchQuery, sortDir, sortKey, summary]);

  const { guestStats, tabCounts } = useMemo(() => {
    const empty = {
      guestStats: { upcoming: 0, seated: 0 },
      tabCounts: getEmptyBookingTabCounts(),
    };
    if (!summary) return empty;

    let guestUpcoming = 0;
    let guestSeated = 0;

    for (const booking of summary.bookings) {
      const status = booking.status;

      if (status === 'checked_in') {
        guestSeated += booking.partySize;
      }

      if (status === 'confirmed' || status === 'PRIORITY_WAITLIST') {
        guestUpcoming += booking.partySize;
      }
    }

    return {
      guestStats: { upcoming: guestUpcoming, seated: guestSeated },
      tabCounts: getBookingTabCounts({
        summary,
        allowTableAssignments,
        hasAssignmentHandlers: true,
      }),
    };
  }, [allowTableAssignments, summary]);

  const handleRetry = useCallback(() => refetchSummary(), [refetchSummary]);

  const headerSwipeRef = useDateSwipe<HTMLElement>({
    onSwipeLeft: handleNextDate,
    onSwipeRight: handlePrevDate,
    threshold: 50,
  });

  const isInitialLoading =
    (isSummaryLoading && !summary) || (isSummaryMismatch && !summaryQuery.isError);
  const isRefetching = isSummaryFetching && !!summary && !isSummaryMismatch;
  const hasError = isSummaryError && (!summary || isSummaryMismatch);
  const summaryHasError = summaryQuery.isError;

  return {
    membership,
    restaurantId,
    restaurantSlug,
    restaurantTimezone,
    restaurantName,
    summary,
    summaryQuery,
    dataUpdatedAt: summaryQuery.dataUpdatedAt ?? null,
    summaryRealtimeHealthy: summaryQuery.realtimeHealthy,
    summaryRealtimeEnabled: summaryQuery.realtimeEnabled,
    summaryIsPolling: summaryQuery.isPolling,
    summaryHasError,
    heatmapQuery,
    isCalendarOpen,
    setIsCalendarOpen,
    filter,
    searchQuery,
    deferredSearchQuery,
    selectedDate: explicitDate,
    requestedDate,
    sortKey,
    sortDir,
    setSortKey: handleSortKeyChange,
    setSortDir: handleSortDirChange,
    guestStats,
    tabCounts,
    allowTableAssignments,
    pendingBookingAction: bookingActions.pendingBookingAction,
    tableActionState: bookingActions.tableActionState,
    detailsBooking,
    isDetailsOpen,
    editBooking,
    isEditOpen,
    cancelBooking,
    isCancelOpen,
    isInitialLoading,
    isRefetching,
    isSummaryMismatch,
    hasError,
    headerSwipeRef,
    handleSelectFilter,
    handleSelectDate,
    handleShiftDate,
    handlePrevDate,
    handleNextDate,
    handleSearchChange,
    handlePrint,
    handleDetails,
    handleEdit,
    handleDetailsOpenChange,
    handleEditOpenChange,
    handleCancelRequest,
    handleCancelOpenChange,
    handleConfirmCancel,
    handleMarkNoShow: bookingActions.handleMarkNoShow,
    handleUndoNoShow: bookingActions.handleUndoNoShow,
    handleCheckIn: bookingActions.handleCheckIn,
    handleCheckOut: bookingActions.handleCheckOut,
    handleAssignTable: bookingActions.handleAssignTable,
    handleUnassignTable: bookingActions.handleUnassignTable,
    handleRetry,
    cancelBookingPending: cancelBookingMutation.isPending,
  };
}
