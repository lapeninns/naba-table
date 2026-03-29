'use client';

import { useCallback, useMemo } from 'react';

import { useOpsBookingLifecycleActions } from '@/hooks/ops/useOpsBookingStatusActions';
import { useOpsCancelBooking } from '@/hooks/ops/useOpsCancelBooking';
import { useOpsTableAssignmentActions } from '@/hooks/ops/useOpsTableAssignments';
import { mapOpsDashboardBookingItemToBookingDTO } from '@/utils/ops/mapOpsDashboardBookingItemToBookingDTO';

import { useOpsDashboardBookingActions } from './useOpsDashboardBookingActions';
import { useOpsDashboardDataState } from './useOpsDashboardDataState';
import { useOpsDashboardDialogs } from './useOpsDashboardDialogs';
import { useOpsDashboardQueryState } from './useOpsDashboardQueryState';
import { useOpsDashboardUiActions } from './useOpsDashboardUiActions';

import type { UseOpsDashboardStateProps } from './types';

export function useOpsDashboardState({ initialDate }: UseOpsDashboardStateProps) {
  const cancelBookingMutation = useOpsCancelBooking();
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
    cancelBooking,
    isCancelOpen,
    handleDetails,
    handleEdit,
    handleDetailsOpenChange,
    handleEditOpenChange,
    handleCancelRequest,
    handleCancelOpenChange,
  } = dialogs;
  const bookingLifecycleMutations = useOpsBookingLifecycleActions();
  const assignmentDate = explicitDate;
  const tableAssignmentActions = useOpsTableAssignmentActions({
    restaurantId,
    date: assignmentDate,
  });
  const bookingActions = useOpsDashboardBookingActions({
    summary,
    restaurantId,
    selectedDate: explicitDate,
    bookingLifecycleMutations,
    tableAssignmentActions,
  });
  const uiActions = useOpsDashboardUiActions({
    summaryDate: summary?.date ?? null,
    requestedDate,
    selectedDate: explicitDate,
    filter,
    sortKey,
    sortDir,
    searchQuery,
    restaurantId,
    restaurantTimezone,
    cancelBooking,
    cancelBookingMutation,
    onCancelOpenChange: handleCancelOpenChange,
    onSelectDate: handleSelectDate,
  });

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
    handleCancelOpenChange,
    handleConfirmCancel: uiActions.handleConfirmCancel,
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
