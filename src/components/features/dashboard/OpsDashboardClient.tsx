'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Filter, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';

import { BookingOfflineBanner } from '@/components/features/booking-state-machine';
import { BookingDetailsDialogWrapper } from '@/components/features/bookings/BookingDetailsDialogWrapper';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { BookingStateMachineProvider } from '@/contexts/booking-state-machine';
import { useOpsActiveMembership } from '@/contexts/ops-session';
import { useOpsBookingChanges, useOpsBookingHeatmap, useOpsBookingLifecycleActions, useOpsTableAssignmentActions, useOpsTodaySummary } from '@/hooks';
import { queryKeys } from '@/lib/query/keys';
import { cn } from '@/lib/utils';
import { formatDateKey, getTodayInTimezone } from '@/lib/utils/datetime';
import { computeCalendarRange, sanitizeDateParam } from '@/utils/ops/dashboard';

import { BookingChangeFeed } from './BookingChangeFeed';
import { BookingsFilterBar } from './BookingsFilterBar';
import { DashboardErrorState } from './DashboardErrorState';
import { DashboardSkeleton } from './DashboardSkeleton';
import { DashboardSummaryCard } from './DashboardSummaryCard';
import { HeatmapCalendar } from './HeatmapCalendar';

import type { BookingFilter } from './BookingsFilterBar';
import type { BookingDTO } from '@/hooks/useBookings';

/* 
  Using 'all' as default to show complete overview first.
*/
const DEFAULT_FILTER: BookingFilter = 'all';

type OpsDashboardClientProps = {
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
  const membership = useOpsActiveMembership();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  // State
  const [filter, setFilter] = useState<BookingFilter>(DEFAULT_FILTER);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState<string | null>(sanitizeDateParam(initialDate ?? undefined));
  const [pendingBookingAction, setPendingBookingAction] = useState<{ bookingId: string; action: 'check-in' | 'check-out' | 'no-show' | 'undo-no-show' } | null>(null);
  const [detailsBooking, setDetailsBooking] = useState<BookingDTO | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const [, startTransition] = useTransition();

  const restaurantId = membership?.restaurantId ?? null;

  const summaryQuery = useOpsTodaySummary({ restaurantId, targetDate: selectedDate });
  const summary = summaryQuery.data ?? null;

  useEffect(() => {
    if (!summary) return;
    if (selectedDate) return;
    if (summary.date !== selectedDate) {
      // Normalize "today" to a concrete date key without forcing a second network fetch:
      // when we update selectedDate, the summary query key changes. Prime the new key with the
      // already-fetched summary so React Query doesn't immediately refetch and risk stale overwrites.
      if (restaurantId) {
        const nextKey = queryKeys.opsDashboard.summary(restaurantId, summary.date);
        queryClient.setQueryData(nextKey, summary);
      }
      setSelectedDate(summary.date);
    }
  }, [queryClient, restaurantId, selectedDate, summary]);

  // Heatmap data for modified calendar popover
  const heatmapRange = useMemo(() => (summary ? computeCalendarRange(summary.date) : null), [summary]);
  const heatmapQuery = useOpsBookingHeatmap({
    restaurantId,
    startDate: heatmapRange?.start ?? null,
    endDate: heatmapRange?.end ?? null,
    enabled: Boolean(restaurantId && heatmapRange),
  });

  const bookingLifecycleMutations = useOpsBookingLifecycleActions();
  const assignmentDate = selectedDate;
  const tableAssignmentActions = useOpsTableAssignmentActions({ restaurantId, date: assignmentDate });
  const allowTableAssignments = useMemo(() => {
    const targetDate = selectedDate ?? summary?.date ?? null;
    if (!targetDate) return true;

    const timezone = summary?.timezone ?? 'UTC';
    const today = getTodayInTimezone(timezone);
    return targetDate >= today;
  }, [selectedDate, summary?.date, summary?.timezone]);

  // Booking Changes feed
  const changesQuery = useOpsBookingChanges({
    restaurantId,
    targetDate: selectedDate ?? summary?.date ?? null,
    limit: 20,
    enabled: Boolean(restaurantId && (selectedDate || summary?.date)),
  });

  // Handle Tab switching
  const handleSelectFilter = (nextFilter: BookingFilter) => {
    setFilter(nextFilter);
  };

  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (date) {
      params.set('date', date);
    } else {
      params.delete('date');
    }

    startTransition(() => {
      const query = params.size > 0 ? `?${params.toString()}` : '';
      router.replace(`${pathname}${query}`);
    });
  };

  const handleShiftDate = (days: number) => {
    const baseDate = selectedDate ?? summary?.date ?? null;
    if (!baseDate) return;
    const nextDate = new Date(`${baseDate}T00:00:00`);
    if (Number.isNaN(nextDate.getTime())) return;
    nextDate.setDate(nextDate.getDate() + days);
    handleSelectDate(formatDateKey(nextDate));
  };

  const handleDetails = (booking: BookingDTO) => {
    setDetailsBooking(booking);
    setIsDetailsOpen(true);
  };

  const handleDetailsOpenChange = (open: boolean) => {
    setIsDetailsOpen(open);
    if (!open) {
      setDetailsBooking(null);
    }
  };

  // Real-time Guest Stats
  const guestStats = useMemo(() => {
    if (!summary) return { upcoming: 0, seated: 0 };

    // Calculate guests (sum of partySize)
    const upcoming = summary.bookings
      .filter(b => b.status === 'confirmed' || b.status === 'PRIORITY_WAITLIST')
      .reduce((sum, b) => sum + b.partySize, 0);

    const seated = summary.bookings
      .filter(b => b.status === 'checked_in')
      .reduce((sum, b) => sum + b.partySize, 0);

    return { upcoming, seated };
  }, [summary]);

  // Tab counts for badges
  const tabCounts = useMemo(() => {
    if (!summary) return { all: 0, upcoming: 0, seated: 0, finished: 0, no_show: 0 };

    const bookings = summary.bookings;
    return {
      all: bookings.length,
      upcoming: bookings.filter(b =>
        b.status === 'confirmed' || b.status === 'PRIORITY_WAITLIST' ||
        b.status === 'pending' || b.status === 'pending_allocation'
      ).length,
      seated: bookings.filter(b => b.status === 'checked_in').length,
      finished: bookings.filter(b =>
        ['completed', 'cancelled', 'no_show'].includes(b.status)
      ).length,
      no_show: bookings.filter(b => b.status === 'no_show').length,
    };
  }, [summary]);

  // All hooks must be called before any early returns
  const tableActionState = useMemo(() => {
    if (tableAssignmentActions.assignTable.isPending) {
      const variables = tableAssignmentActions.assignTable.variables;
      return {
        type: 'assign' as const,
        bookingId: variables?.bookingId ?? null,
        tableId: variables?.tableId ?? null,
        tableName: variables?.tableName,
      };
    }
    if (tableAssignmentActions.unassignTable.isPending) {
      const variables = tableAssignmentActions.unassignTable.variables;
      return {
        type: 'unassign' as const,
        bookingId: variables?.bookingId ?? null,
        tableId: variables?.tableId ?? null,
      };
    }
    return null;
  }, [
    tableAssignmentActions.assignTable.isPending,
    tableAssignmentActions.assignTable.variables,
    tableAssignmentActions.unassignTable.isPending,
    tableAssignmentActions.unassignTable.variables,
  ]);

  // Handler functions
  const handleMarkNoShow = async (bookingId: string, options?: { performedAt?: string | null; reason?: string | null }) => {
    if (!restaurantId) return;
    setPendingBookingAction({ bookingId, action: 'no-show' });
    try {
      await bookingLifecycleMutations.markNoShow.mutateAsync({
        restaurantId,
        bookingId,
        performedAt: options?.performedAt ?? null,
        reason: options?.reason ?? null,
        targetDate: selectedDate,
      });
    } finally {
      setPendingBookingAction(null);
    }
  };

  const handleUndoNoShow = async (bookingId: string, reason?: string | null) => {
    if (!restaurantId) return;
    setPendingBookingAction({ bookingId, action: 'undo-no-show' });
    try {
      await bookingLifecycleMutations.undoNoShow.mutateAsync({
        restaurantId,
        bookingId,
        reason: reason ?? null,
        targetDate: selectedDate,
      });
    } finally {
      setPendingBookingAction(null);
    }
  };

  const handleCheckIn = async (bookingId: string) => {
    if (!restaurantId) return;
    setPendingBookingAction({ bookingId, action: 'check-in' });
    try {
      await bookingLifecycleMutations.checkIn.mutateAsync({
        restaurantId,
        bookingId,
        targetDate: selectedDate,
      });
    } finally {
      setPendingBookingAction(null);
    }
  };

  const handleCheckOut = async (bookingId: string) => {
    if (!restaurantId) return;
    setPendingBookingAction({ bookingId, action: 'check-out' });
    try {
      await bookingLifecycleMutations.checkOut.mutateAsync({
        restaurantId,
        bookingId,
        targetDate: selectedDate,
      });
    } finally {
      setPendingBookingAction(null);
    }
  };

  const handleAssignTable = async (bookingId: string, tableId: string, tableName?: string) => {
    const result = await tableAssignmentActions.assignTable.mutateAsync({ bookingId, tableId, tableName });
    return result.tableAssignments;
  };

  const handleUnassignTable = async (bookingId: string, tableId: string) => {
    const result = await tableAssignmentActions.unassignTable.mutateAsync({ bookingId, tableId });
    return result.tableAssignments;
  };

  // Early returns must come after all hooks
  if (!restaurantId) {
    return <NoAccessState />;
  }

  // Only show full page skeleton on INITIAL load (no cached data yet)
  // For date changes/refetches, we keep the page visible with list-only skeletons
  const isInitialLoading = summaryQuery.isLoading && !summary;
  const isRefetching = summaryQuery.isFetching && !!summary;

  if (isInitialLoading) {
    return <DashboardSkeleton />;
  }

  if (summaryQuery.isError || !summary) {
    return <DashboardErrorState onRetry={() => summaryQuery.refetch()} />;
  }

  return (
    <div className="w-full bg-background font-sans text-foreground">
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">

        {/* HEADER SECTION */}
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Operations</h1>
            <p className={cn(
              "text-sm text-muted-foreground sm:text-base transition-opacity duration-300",
              isRefetching && "opacity-50"
            )}>
              <span className="font-medium text-foreground">{guestStats.upcoming} guests</span> expecting arrival,{' '}
              <span className="font-medium text-foreground">{guestStats.seated} seated</span> now.
              {isRefetching && <span className="ml-2 text-xs text-muted-foreground">(Updating...)</span>}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-lg border border-border bg-card p-1 shadow-sm">
              <DateNavigationButton direction="prev" onClick={() => handleShiftDate(-1)} />
              <div className="flex items-center gap-2 px-2">
                <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <HeatmapCalendar
                  summary={summary}
                  heatmap={heatmapQuery.data}
                  selectedDate={summary.date}
                  onSelectDate={handleSelectDate}
                  isLoading={heatmapQuery.isLoading}
                />
              </div>
              <DateNavigationButton direction="next" onClick={() => handleShiftDate(1)} />
            </div>
          </div>
        </header>

        {/* Connection Banner */}
        <section aria-label="Connection status">
          <BookingOfflineBanner />
        </section>

        {/* TOOLBAR */}
        <div className="sticky top-0 z-[5] bg-background/80 px-4 py-4 backdrop-blur-md transition-all sm:px-6 md:rounded-xl md:border md:border-border/60 md:bg-card/80 md:px-6 md:shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

            <div className="overflow-x-auto scrollbar-hide -mx-2 px-2 md:mx-0 md:px-0">
              <div className="min-w-max">
                <BookingsFilterBar value={filter} onChange={handleSelectFilter} counts={tabCounts} />
              </div>
            </div>

            {/* SEARCH & FILTER */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 md:w-64 md:flex-none">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search guests..."
                  id="ops-dashboard-search"
                  name="search"
                  aria-label="Search guests"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoComplete="off"
                  className="h-10 w-full rounded-lg border border-border bg-background pl-10 pr-4 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 touch-manipulation"
                />
              </div>
              <Button variant="outline" size="icon" className="shrink-0 h-10 w-10 bg-card touch-manipulation">
                <Filter className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="space-y-6">
          {/* Bookings List */}
          <div className="space-y-4">
            {/* If assignments locked warning */}
            {!allowTableAssignments ? (
              <div className="flex justify-end">
                <Badge variant="secondary" className="bg-amber-50 text-amber-700">
                  Past date · Assignments locked
                </Badge>
              </div>
            ) : null}

            <DashboardSummaryCard
              summary={summary}
              restaurantName={membership?.restaurantName ?? 'Restaurant'}
              selectedDate={summary.date}
              onSelectDate={handleSelectDate}
              heatmap={heatmapQuery.data}
              heatmapLoading={heatmapQuery.isLoading}
              heatmapError={heatmapQuery.error ?? null}
              filter={filter}
              onFilterChange={handleSelectFilter}
              searchQuery={searchQuery}
              isRefetching={isRefetching}
              showFilterBar={false}
              showHeatmap={false}
              allowTableAssignments={allowTableAssignments}
              onDetails={handleDetails}
              onAssignTable={handleAssignTable}
              onUnassignTable={handleUnassignTable}
              tableActionState={tableActionState}
              onMarkNoShow={handleMarkNoShow}
              onUndoNoShow={handleUndoNoShow}
              onCheckIn={handleCheckIn}
              onCheckOut={handleCheckOut}
              pendingLifecycleAction={pendingBookingAction}
            />
          </div>
        </div>
        {/* Recent Changes Feed */}
        <section aria-label="Recent activity">
          <BookingChangeFeed
            changes={changesQuery.data?.changes ?? []}
            loading={changesQuery.isLoading}
            totalChanges={changesQuery.data?.totalChanges}
          />
        </section>
        <BookingDetailsDialogWrapper
          bookingId={detailsBooking?.id ?? null}
          initialData={detailsBooking}
          open={isDetailsOpen}
          onOpenChange={handleDetailsOpenChange}
        />
      </main>
    </div>
  );
}

type DateNavigationButtonProps = {
  direction: 'prev' | 'next';
  onClick: () => void;
};

function DateNavigationButton({ direction, onClick }: DateNavigationButtonProps) {
  const Icon = direction === 'prev' ? ChevronLeft : ChevronRight;
  const label = direction === 'prev' ? 'Previous day' : 'Next day';

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 w-8 touch-manipulation items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      aria-label={label}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  );
}

function NoAccessState() {
  return (
    <Card className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-4 border border-dashed border-border/60 bg-muted/20 p-6 text-center sm:p-10">
      <h2 className="text-xl font-semibold text-foreground">No restaurant access yet</h2>
      <p className="text-sm text-muted-foreground">
        Ask an owner or manager to send you an invitation so you can manage bookings.
      </p>
      <Button variant="outline" size="sm" asChild>
        <Link href="/guest/dashboard">Back to dashboard</Link>
      </Button>
    </Card>
  );
}
