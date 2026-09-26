'use client';

import { useCallback, useMemo } from 'react';

import { mapOpsDashboardBookingItemToBookingDTO } from '@/utils/ops/mapOpsDashboardBookingItemToBookingDTO';
import { useBookingLifecycle } from '@src/hooks/ops/useBookingLifecycle';
import { useOpsCancelBookingController } from '@src/hooks/ops/useOpsCancelBookingController';
import { useOpsTableAssignmentActions } from '@src/hooks/ops/useOpsTableAssignments';

import { useOpsDashboardBookingActions } from './useOpsDashboardBookingActions';
import { useOpsDashboardDataState } from './useOpsDashboardDataState';
import { useOpsDashboardDialogs } from './useOpsDashboardDialogs';
import { useOpsDashboardQueryState } from './useOpsDashboardQueryState';
import { useOpsDashboardUiActions } from './useOpsDashboardUiActions';

import type { UseOpsDashboardStateProps } from './types';
import type { BookingDTO } from '@/hooks/useBookings';

export function useOpsDashboardState({ initialDate }: UseOpsDashboardStateProps) {
  const queryState = useOpsDashboardQueryState({ initialDate });
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
  const dataState = useOpsDashboardDataState({
    selectedDate: explicitDate,
    isCalendarOpen,
  });
  const {
    membership,
    restaurantId,
    restaurantSlug,
    restaurantTimezone,
    restaurantName,
    summary,
    summaryQuery,
    requestedDate,
    isSummaryMismatch,
    isStaleContent,
    allowTableAssignments,
    heatmapQuery,
    guestStats,
    tabCounts,
    isInitialLoading,
    isRefetching,
    hasError,
    summaryHasError,
    handleRetry,
  } = dataState;
  const bookingLookup = useMemo(() => {
    if (!summary || !restaurantId) {
      return new Map<string, ReturnType<typeof mapOpsDashboardBookingItemToBookingDTO>>();
    }

    return new Map(
      summary.bookings.map((booking) => [
        booking.id,
        mapOpsDashboardBookingItemToBookingDTO(booking, {
          restaurantId,
          restaurantName,
          restaurantSlug,
          restaurantTimezone: summary.timezone,
          summaryDate: summary.date,
        }),
      ]),
    );
  }, [restaurantId, restaurantName, restaurantSlug, summary]);
  const resolveBookingById = useCallback(
    (bookingId: string | null) => {
      if (!bookingId) return null;
      return bookingLookup.get(bookingId) ?? null;
    },
    [bookingLookup],
  );
  const dialogs = useOpsDashboardDialogs({ resolveBookingById });
  const {
    detailsBooking,
    isDetailsOpen,
    editBooking,
    isEditOpen,
    handleDetails,
    handleEdit,
    handleDetailsOpenChange,
    handleEditOpenChange,
    closeOtherDialogs,
  } = dialogs;
  const lifecycle = useBookingLifecycle();
  const tableAssignmentActions = useOpsTableAssignmentActions({
    restaurantId,
    date: explicitDate,
  });
  const bookingActions = useOpsDashboardBookingActions({
    restaurantId,
    selectedDate: explicitDate,
    lifecycle,
    tableAssignmentActions,
  });
  const cancelController = useOpsCancelBookingController<BookingDTO>({
    fallbackRestaurantId: restaurantId,
  });
  const uiActions = useOpsDashboardUiActions({
    summaryDate: summary?.date ?? null,
    requestedDate,
    selectedDate: explicitDate,
    filter,
    sortKey,
    sortDir,
    searchQuery,
    onSelectDate: handleSelectDate,
  });
  const handleCancelRequest = useCallback(
    (bookingId: string) => {
      const booking = resolveBookingById(bookingId);
      if (!booking) return;
      closeOtherDialogs();
      cancelController.request(booking);
    },
    [cancelController, closeOtherDialogs, resolveBookingById],
  );

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
    pendingLifecycleActions: bookingActions.pendingLifecycleActions,
    tableActionState: bookingActions.tableActionState,
    detailsBooking,
    isDetailsOpen,
    editBooking,
    isEditOpen,
    cancelBooking: cancelController.booking,
    isCancelOpen: cancelController.isOpen,
    isInitialLoading,
    isRefetching,
    isSummaryMismatch,
    isStaleContent,
    hasError,
    headerSwipeRef: uiActions.headerSwipeRef,
    handleSelectFilter,
    handleSelectDate,
    handleShiftDate: uiActions.handleShiftDate,
    handlePrevDate: uiActions.handlePrevDate,
    handleNextDate: uiActions.handleNextDate,
    handleSearchChange,
    handlePrint: uiActions.handlePrint,
    handleDetails,
    handleEdit,
    handleDetailsOpenChange,
    handleEditOpenChange,
    handleCancelRequest,
    handleCancelOpenChange: cancelController.onOpenChange,
    handleConfirmCancel: cancelController.confirm,
    handleMarkNoShow: bookingActions.handleMarkNoShow,
    handleUndoNoShow: bookingActions.handleUndoNoShow,
    handleCheckIn: bookingActions.handleCheckIn,
    handleCheckOut: bookingActions.handleCheckOut,
    handleAssignTable: bookingActions.handleAssignTable,
    handleUnassignTable: bookingActions.handleUnassignTable,
    handleRetry,
    cancelBookingPending: cancelController.isPending,
  };
}
