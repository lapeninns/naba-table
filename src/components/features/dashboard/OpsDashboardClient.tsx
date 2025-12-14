'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Filter, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';

import { BookingOfflineBanner } from '@/components/features/booking-state-machine';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { BookingStateMachineProvider } from '@/contexts/booking-state-machine';
import { useOpsActiveMembership } from '@/contexts/ops-session';
import { useOpsBookingHeatmap, useOpsBookingLifecycleActions, useOpsTableAssignmentActions, useOpsTodaySummary } from '@/hooks';
import { queryKeys } from '@/lib/query/keys';
import { cn } from '@/lib/utils';
import { formatDateKey, getTodayInTimezone } from '@/lib/utils/datetime';
import { computeCalendarRange, sanitizeDateParam } from '@/utils/ops/dashboard';

import { BookingsList } from './BookingsList';
import { DashboardErrorState } from './DashboardErrorState';
import { DashboardSkeleton } from './DashboardSkeleton';
import { HeatmapCalendar } from './HeatmapCalendar';

import type { BookingFilter } from './BookingsFilterBar';

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

  const [, startTransition] = useTransition();

  const restaurantId = membership?.restaurantId ?? null;

  const summaryQuery = useOpsTodaySummary({ restaurantId, targetDate: selectedDate });
  const summary = summaryQuery.data ?? null;

  useEffect(() => {
    if (!summary) return;
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
    if (!summary) return { all: 0, upcoming: 0, seated: 0, finished: 0 };

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
    <div className="min-h-screen bg-background font-sans text-foreground">
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

          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-lg border border-border bg-card p-1 shadow-sm">
              <DateNavigationButton direction="prev" onClick={() => handleShiftDate(-1)} />
              <div className="flex items-center gap-2 px-2">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
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
        <div className="sticky top-0 z-10 -mx-4 bg-background/80 px-4 py-3 backdrop-blur-md transition-all sm:-mx-6 sm:px-6 md:mx-0 md:rounded-xl md:border md:border-border/60 md:bg-card/80 md:px-4 md:shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

            {/* TABS - horizontally scrollable on mobile */}
            <div className="-mx-1 overflow-x-auto scrollbar-hide">
              <div className="flex items-center gap-1 rounded-lg bg-muted/80 p-1 min-w-max">
                {(['all', 'upcoming', 'seated', 'finished'] as const).map((tab) => {
                  const count = tabCounts[tab];
                  return (
                    <button
                      key={tab}
                      onClick={() => handleSelectFilter(tab as BookingFilter)}
                      className={cn(
                        "relative flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-all whitespace-nowrap touch-manipulation",
                        filter === tab
                          ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted"
                      )}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                      {count > 0 && (
                        <span className={cn(
                          "inline-flex items-center justify-center rounded-full min-w-[20px] px-1.5 py-0.5 text-[10px] font-semibold leading-none",
                          filter === tab
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted-foreground/20 text-muted-foreground"
                        )}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SEARCH & FILTER */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 md:w-64 md:flex-none">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search guests..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-background pl-10 pr-4 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 touch-manipulation"
                />
              </div>
              <Button variant="outline" size="icon" className="shrink-0 h-10 w-10 bg-card touch-manipulation">
                <Filter className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          </div>
        </div>

        {/* LIST SECTION */}
        <div className="space-y-4">
          {/* If assignments locked warning */}
          {!allowTableAssignments ? (
            <div className="flex justify-end">
              <Badge variant="secondary" className="bg-amber-50 text-amber-700">
                Past date · Assignments locked
              </Badge>
            </div>
          ) : null}

          <BookingsList
            bookings={summary.bookings}
            filter={filter}
            searchQuery={searchQuery}
            summary={summary}
            allowTableAssignments={allowTableAssignments}
            isRefetching={isRefetching}
            onMarkNoShow={handleMarkNoShow}
            onUndoNoShow={handleUndoNoShow}
            onCheckIn={handleCheckIn}
            onCheckOut={handleCheckOut}
            pendingLifecycleAction={pendingBookingAction}
            onAssignTable={handleAssignTable}
            onUnassignTable={handleUnassignTable}
            tableActionState={tableActionState}
          />
        </div>
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
