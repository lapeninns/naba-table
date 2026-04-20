'use client';

import Link from 'next/link';
import { memo, useMemo } from 'react';

import { BookingOfflineBanner } from '@/components/features/booking-state-machine';
import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { Button } from '@/components/ui/button';
import { BookingStateMachineProvider } from '@/contexts/booking-state-machine';
import { useMinimumDelay } from '@/hooks/use-minimum-delay';
import { opsHref } from '@/lib/url/opsHref';
import { getTodayInTimezone } from '@/lib/utils/datetime';

import { DashboardErrorState } from './DashboardErrorState';
import { DashboardSummarySkeleton } from './DashboardSummarySkeleton';
import { OpsDashboardDialogs } from './OpsDashboardDialogs';
import { OpsDashboardHeader } from './OpsDashboardHeader';
import { OpsDashboardSummarySection } from './OpsDashboardSummarySection';
import { useOpsDashboardState } from './useOpsDashboardState';

import type { OpsDashboardDialogsProps } from './OpsDashboardDialogs';
import type { OpsDashboardHeaderProps } from './OpsDashboardHeader';
import type { OpsDashboardSummarySectionProps } from './OpsDashboardSummarySection';
import type { DashboardBookingActionHandlers, DashboardListControls } from './types';
import type { OpsTodayBookingsSummary } from '@/types/ops';

export type OpsDashboardClientProps = {
  initialDate: string | null;
  initialNowIso: string;
};

const DashboardHeaderSection = memo(function DashboardHeaderSection(
  props: OpsDashboardHeaderProps,
) {
  return <OpsDashboardHeader {...props} />;
});

const DashboardSummarySectionContent = memo(function DashboardSummarySectionContent(
  props: OpsDashboardSummarySectionProps,
) {
  return <OpsDashboardSummarySection {...props} />;
});

const DashboardDialogsSection = memo(function DashboardDialogsSection(
  props: OpsDashboardDialogsProps,
) {
  return <OpsDashboardDialogs {...props} />;
});

export function OpsDashboardClient({ initialDate, initialNowIso }: OpsDashboardClientProps) {
  return (
    <BookingStateMachineProvider>
      <OpsDashboardClientContent initialDate={initialDate} initialNowIso={initialNowIso} />
    </BookingStateMachineProvider>
  );
}

function OpsDashboardClientContent({ initialDate, initialNowIso }: OpsDashboardClientProps) {
  const state = useOpsDashboardState({ initialDate });
  const fallbackSummary = useMemo<OpsTodayBookingsSummary>(() => {
    const timezone = state.restaurantTimezone ?? 'UTC';
    const date = state.requestedDate ?? getTodayInTimezone(timezone);
    return {
      meta: {
        date,
        timezone,
        restaurantId: state.restaurantId ?? 'unknown',
      },
      date,
      timezone,
      restaurantId: state.restaurantId ?? 'unknown',
      totals: {
        total: 0,
        confirmed: 0,
        completed: 0,
        pending: 0,
        cancelled: 0,
        noShow: 0,
        upcoming: 0,
        covers: 0,
      },
      bookings: [],
    };
  }, [state.requestedDate, state.restaurantId, state.restaurantTimezone]);
  const summary = state.summary && !state.isSummaryMismatch ? state.summary : fallbackSummary;
  const selectedDate = state.requestedDate ?? summary.date;
  const showSummarySkeleton = useMinimumDelay(!state.summary || state.isInitialLoading, {
    delayMs: 120,
    minDurationMs: 300,
  });
  const isSummaryLoading = showSummarySkeleton;
  const headerProps = useMemo<OpsDashboardHeaderProps>(
    () => ({
      headerSwipeRef: state.headerSwipeRef,
      guestStats: state.guestStats,
      summary,
      selectedDate,
      isRefetching: state.isRefetching,
      isSummaryLoading,
      initialNowIso,
      dataUpdatedAt: state.dataUpdatedAt,
      realtimeEnabled: state.summaryRealtimeEnabled,
      realtimeHealthy: state.summaryRealtimeHealthy,
      isPolling: state.summaryIsPolling,
      hasSummaryError: state.summaryHasError,
      heatmap: state.heatmapQuery.data,
      heatmapLoading: state.heatmapQuery.isLoading,
      onCalendarOpenChange: state.setIsCalendarOpen,
      onSelectDate: state.handleSelectDate,
      onShiftDate: state.handleShiftDate,
      onPrevDate: state.handlePrevDate,
      onNextDate: state.handleNextDate,
    }),
    [
      initialNowIso,
      isSummaryLoading,
      selectedDate,
      state.dataUpdatedAt,
      state.guestStats,
      state.handleNextDate,
      state.handlePrevDate,
      state.handleSelectDate,
      state.handleShiftDate,
      state.headerSwipeRef,
      state.heatmapQuery.data,
      state.heatmapQuery.isLoading,
      state.isRefetching,
      state.setIsCalendarOpen,
      state.summaryHasError,
      state.summaryIsPolling,
      state.summaryRealtimeEnabled,
      state.summaryRealtimeHealthy,
      summary,
    ],
  );
  const summarySectionProps = useMemo<OpsDashboardSummarySectionProps>(
    () => ({
      summary,
      restaurantName: state.restaurantName,
      controls: {
        filter: state.filter,
        tabCounts: state.tabCounts,
        searchQuery: state.searchQuery,
        deferredSearchQuery: state.deferredSearchQuery,
        sortKey: state.sortKey,
        sortDir: state.sortDir,
        isRefetching: state.isRefetching,
        onFilterChange: state.handleSelectFilter,
        onSearchChange: state.handleSearchChange,
        onPrint: state.handlePrint,
        onSortKeyChange: state.setSortKey,
        onSortDirChange: state.setSortDir,
      } satisfies DashboardListControls,
      bookingActions: {
        onDetails: state.handleDetails,
        onEdit: state.handleEdit,
        onCancel: state.handleCancelRequest,
        onAssignTable: state.handleAssignTable,
        onUnassignTable: state.handleUnassignTable,
        tableActionState: state.tableActionState,
        onMarkNoShow: state.handleMarkNoShow,
        onUndoNoShow: state.handleUndoNoShow,
        onCheckIn: state.handleCheckIn,
        onCheckOut: state.handleCheckOut,
        pendingLifecycleAction: state.pendingBookingAction,
      } satisfies DashboardBookingActionHandlers,
      initialNowIso,
      allowTableAssignments: state.allowTableAssignments,
      restaurantSlug: state.restaurantSlug,
    }),
    [
      initialNowIso,
      state.allowTableAssignments,
      state.deferredSearchQuery,
      state.filter,
      state.handleAssignTable,
      state.handleCancelRequest,
      state.handleCheckIn,
      state.handleCheckOut,
      state.handleDetails,
      state.handleEdit,
      state.handleMarkNoShow,
      state.handlePrint,
      state.handleSearchChange,
      state.handleSelectFilter,
      state.handleUndoNoShow,
      state.handleUnassignTable,
      state.isRefetching,
      state.pendingBookingAction,
      state.restaurantName,
      state.restaurantSlug,
      state.searchQuery,
      state.setSortDir,
      state.setSortKey,
      state.sortDir,
      state.sortKey,
      state.tabCounts,
      state.tableActionState,
      summary,
    ],
  );
  const dialogProps = useMemo<OpsDashboardDialogsProps>(
    () => ({
      detailsBooking: state.detailsBooking,
      isDetailsOpen: state.isDetailsOpen,
      onDetailsOpenChange: state.handleDetailsOpenChange,
      editBooking: state.editBooking,
      isEditOpen: state.isEditOpen,
      onEditOpenChange: state.handleEditOpenChange,
      restaurantSlug: state.restaurantSlug,
      restaurantTimezone: state.restaurantTimezone,
      cancelBooking: state.cancelBooking,
      isCancelOpen: state.isCancelOpen,
      onCancelOpenChange: state.handleCancelOpenChange,
      onConfirmCancel: state.handleConfirmCancel,
      isCancelPending: state.cancelBookingPending,
    }),
    [
      state.cancelBooking,
      state.cancelBookingPending,
      state.detailsBooking,
      state.editBooking,
      state.handleCancelOpenChange,
      state.handleConfirmCancel,
      state.handleDetailsOpenChange,
      state.handleEditOpenChange,
      state.isCancelOpen,
      state.isDetailsOpen,
      state.isEditOpen,
      state.restaurantSlug,
      state.restaurantTimezone,
    ],
  );

  if (!state.restaurantId) {
    return <NoAccessState />;
  }

  if (state.hasError) {
    return <DashboardErrorState onRetry={state.handleRetry} />;
  }

  return (
    <div className="w-full min-w-0 bg-background font-sans text-foreground">
      <div className="mx-auto w-full min-w-0 max-w-6xl space-y-5 px-4 py-5 sm:space-y-6 sm:px-6 sm:py-8 lg:px-8">
        <DashboardHeaderSection {...headerProps} />

        <section aria-label="Connection status">
          <BookingOfflineBanner />
        </section>

        {showSummarySkeleton ? (
          <DashboardSummarySkeleton restaurantName={state.restaurantName} />
        ) : (
          <div className="motion-safe:animate-fade-in">
            <DashboardSummarySectionContent {...summarySectionProps} />
          </div>
        )}

        <DashboardDialogsSection {...dialogProps} />
      </div>
    </div>
  );
}

function NoAccessState() {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center p-6 sm:p-10">
      <OpsEmptyState
        title="No restaurant access yet"
        description="Ask an owner or manager to send you an invitation so you can manage bookings."
        action={
          <Button variant="outline" size="sm" asChild>
            <Link href={opsHref('/dashboard')}>Return to ops home</Link>
          </Button>
        }
      />
    </section>
  );
}
