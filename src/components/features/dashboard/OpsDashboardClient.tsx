'use client';

import Link from 'next/link';
import { useMemo } from 'react';

import { BookingOfflineBanner } from '@/components/features/booking-state-machine';
import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { Button } from '@/components/ui/button';
import { BookingStateMachineProvider } from '@/contexts/booking-state-machine';
import { getTodayInTimezone } from '@/lib/utils/datetime';

import { DashboardErrorState } from './DashboardErrorState';
import { DashboardSummarySkeleton } from './DashboardSummarySkeleton';
import { OpsDashboardDialogs } from './OpsDashboardDialogs';
import { OpsDashboardHeader } from './OpsDashboardHeader';
import { OpsDashboardSummarySection } from './OpsDashboardSummarySection';
import { OpsDashboardToolbar } from './OpsDashboardToolbar';
import { useOpsDashboardState } from './useOpsDashboardState';

import type { OpsTodayBookingsSummary } from '@/types/ops';

export type OpsDashboardClientProps = {
  initialDate: string | null;
};

export function OpsDashboardClient({ initialDate }: OpsDashboardClientProps) {
  return (
    <BookingStateMachineProvider>
      <OpsDashboardClientContent initialDate={initialDate} />
    </BookingStateMachineProvider>
  );
}

function OpsDashboardClientContent({ initialDate }: OpsDashboardClientProps) {
  const state = useOpsDashboardState({ initialDate });
  const fallbackSummary = useMemo<OpsTodayBookingsSummary>(() => {
    const timezone = state.restaurantTimezone ?? 'UTC';
    const date = state.selectedDate ?? getTodayInTimezone(timezone);
    return {
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
  }, [state.restaurantId, state.restaurantTimezone, state.selectedDate]);
  const summary = state.summary ?? fallbackSummary;
  const isSummaryLoading = !state.summary || state.isInitialLoading;

  if (!state.restaurantId) {
    return <NoAccessState />;
  }

  if (state.hasError) {
    return <DashboardErrorState onRetry={state.handleRetry} />;
  }

  return (
    <div className="w-full min-w-0 bg-background font-sans text-foreground">
      <div className="mx-auto w-full min-w-0 max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <OpsDashboardHeader
          headerSwipeRef={state.headerSwipeRef}
          guestStats={state.guestStats}
          summary={summary}
          isRefetching={state.isRefetching}
          isSummaryLoading={isSummaryLoading}
          heatmap={state.heatmapQuery.data}
          heatmapLoading={state.heatmapQuery.isLoading}
          onCalendarOpenChange={state.setIsCalendarOpen}
          onSelectDate={state.handleSelectDate}
          onShiftDate={state.handleShiftDate}
          onPrevDate={state.handlePrevDate}
          onNextDate={state.handleNextDate}
        />

        <section aria-label="Connection status">
          <BookingOfflineBanner />
        </section>

        <OpsDashboardToolbar
          filter={state.filter}
          tabCounts={state.tabCounts}
          searchQuery={state.searchQuery}
          onFilterChange={state.handleSelectFilter}
          onSearchChange={state.handleSearchChange}
          onPrint={state.handlePrint}
        />

        {state.summary ? (
          <OpsDashboardSummarySection
            summary={state.summary}
            restaurantName={state.restaurantName}
            selectedDate={state.summary.date}
            heatmap={state.heatmapQuery.data}
            heatmapLoading={state.heatmapQuery.isLoading}
            heatmapError={state.heatmapQuery.error ?? null}
            filter={state.filter}
            searchQuery={state.deferredSearchQuery}
            sortKey={state.sortKey}
            sortDir={state.sortDir}
            onSortKeyChange={state.setSortKey}
            onSortDirChange={state.setSortDir}
            isRefetching={state.isRefetching}
            allowTableAssignments={state.allowTableAssignments}
            restaurantSlug={state.restaurantSlug}
            onSelectDate={state.handleSelectDate}
            onFilterChange={state.handleSelectFilter}
            onDetails={state.handleDetails}
            onEdit={state.handleEdit}
            onCancel={state.handleCancelRequest}
            onAssignTable={state.handleAssignTable}
            onUnassignTable={state.handleUnassignTable}
            tableActionState={state.tableActionState}
            onMarkNoShow={state.handleMarkNoShow}
            onUndoNoShow={state.handleUndoNoShow}
            onCheckIn={state.handleCheckIn}
            onCheckOut={state.handleCheckOut}
            pendingLifecycleAction={state.pendingBookingAction}
          />
        ) : (
          <DashboardSummarySkeleton restaurantName={state.restaurantName} />
        )}

        <OpsDashboardDialogs
          detailsBooking={state.detailsBooking}
          isDetailsOpen={state.isDetailsOpen}
          onDetailsOpenChange={state.handleDetailsOpenChange}
          editBooking={state.editBooking}
          isEditOpen={state.isEditOpen}
          onEditOpenChange={state.handleEditOpenChange}
          restaurantSlug={state.restaurantSlug}
          restaurantTimezone={state.restaurantTimezone}
          cancelBooking={state.cancelBooking}
          isCancelOpen={state.isCancelOpen}
          onCancelOpenChange={state.handleCancelOpenChange}
          onConfirmCancel={state.handleConfirmCancel}
          isCancelPending={state.cancelBookingPending}
        />
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
            <Link href="/guest/dashboard">Back to dashboard</Link>
          </Button>
        }
      />
    </section>
  );
}
