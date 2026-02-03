'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  Printer,
  Search,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useDeferredValue, useEffect, useMemo, useState, useTransition } from 'react';

import { BookingOfflineBanner } from '@/components/features/booking-state-machine';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { BookingStateMachineProvider } from '@/contexts/booking-state-machine';
import { useOpsActiveMembership } from '@/contexts/ops-session';
import { useOpsBookingHeatmap } from '@/hooks/ops/useOpsBookingHeatmap';
import { useOpsBookingLifecycleActions } from '@/hooks/ops/useOpsBookingStatusActions';
import { useOpsCancelBooking } from '@/hooks/ops/useOpsCancelBooking';
import { useOpsRestaurantDetails } from '@/hooks/ops/useOpsRestaurantDetails';
import { useOpsTableAssignmentActions } from '@/hooks/ops/useOpsTableAssignments';
import { useOpsTodaySummary } from '@/hooks/ops/useOpsTodaySummary';
import { useDateSwipe } from '@/hooks/useDateSwipe';
import { queryKeys } from '@/lib/query/keys';
import { cn } from '@/lib/utils';
import { formatDateKey, getDateInTimezone, getTodayInTimezone } from '@/lib/utils/datetime';
import { computeCalendarRange, sanitizeDateParam } from '@/utils/ops/dashboard';

import { BookingsFilterBar } from './BookingsFilterBar';
import { ConnectionStatusBeacon } from './ConnectionStatusBeacon';
import { DashboardErrorState } from './DashboardErrorState';
import { DashboardSkeleton } from './DashboardSkeleton';
import { DashboardSummaryCard } from './DashboardSummaryCard';
import { HeatmapCalendar } from './HeatmapCalendar';

import type { BookingFilter } from './BookingsFilterBar';
import type { BookingDTO } from '@/hooks/useBookings';
import type { ChangeEvent } from 'react';

const EditBookingDialog = dynamic(
  () => import('@/components/dashboard/EditBookingDialog').then((m) => m.EditBookingDialog),
  {
    loading: () => <div className="h-10" />,
  },
);
const BookingDetailsDialogWrapper = dynamic(
  () =>
    import('@/components/features/bookings/BookingDetailsDialogWrapper').then(
      (m) => m.BookingDetailsDialogWrapper,
    ),
  {
    loading: () => null,
  },
);

/*
  Default to upcoming to avoid showing completed bookings by default.
*/
const DEFAULT_FILTER: BookingFilter = 'upcoming';

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
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [selectedDate, setSelectedDate] = useState<string | null>(
    sanitizeDateParam(initialDate ?? undefined),
  );
  const [sortKey, setSortKey] = useState<'time' | 'party' | 'name'>('time');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [pendingBookingAction, setPendingBookingAction] = useState<{
    bookingId: string;
    action: 'check-in' | 'check-out' | 'no-show' | 'undo-no-show';
  } | null>(null);
  const [detailsBooking, setDetailsBooking] = useState<BookingDTO | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [editBooking, setEditBooking] = useState<BookingDTO | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [cancelBooking, setCancelBooking] = useState<BookingDTO | null>(null);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const cancelBookingMutation = useOpsCancelBooking();

  const [, startTransition] = useTransition();

  const restaurantId = membership?.restaurantId ?? null;
  const restaurantDetails = useOpsRestaurantDetails(restaurantId ?? null);

  const summaryQuery = useOpsTodaySummary({ restaurantId, targetDate: selectedDate });
  const {
    data: summaryData,
    isLoading: isSummaryLoading,
    isFetching: isSummaryFetching,
    isError: isSummaryError,
    refetch: refetchSummary,
  } = summaryQuery;
  const summary = summaryData ?? null;
  const restaurantSlug = restaurantDetails.data?.slug ?? membership?.restaurantSlug ?? null;
  const restaurantTimezone = summary?.timezone ?? restaurantDetails.data?.timezone ?? null;

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
  const heatmapRange = useMemo(
    () => (summary ? computeCalendarRange(summary.date) : null),
    [summary],
  );
  const heatmapQuery = useOpsBookingHeatmap({
    restaurantId,
    startDate: heatmapRange?.start ?? null,
    endDate: heatmapRange?.end ?? null,
    enabled: Boolean(restaurantId && heatmapRange && isCalendarOpen),
  });

  const bookingLifecycleMutations = useOpsBookingLifecycleActions();
  const assignmentDate = selectedDate;
  const tableAssignmentActions = useOpsTableAssignmentActions({
    restaurantId,
    date: assignmentDate,
  });
  const allowTableAssignments = useMemo(() => {
    const targetDate = selectedDate ?? summary?.date ?? null;
    if (!targetDate) return true;

    const timezone = summary?.timezone ?? 'UTC';
    const today = getTodayInTimezone(timezone);
    return targetDate >= today;
  }, [selectedDate, summary?.date, summary?.timezone]);

  // Handle Tab switching
  const handleSelectFilter = useCallback((nextFilter: BookingFilter) => {
    setFilter(nextFilter);
  }, []);

  const handleSelectDate = useCallback((date: string) => {
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
  }, [pathname, router, searchParams, startTransition]);

  const handleShiftDate = useCallback((days: number) => {
    const baseDate = selectedDate ?? summary?.date ?? null;
    if (!baseDate) return;
    const nextDate = new Date(`${baseDate}T00:00:00`);
    if (Number.isNaN(nextDate.getTime())) return;
    nextDate.setDate(nextDate.getDate() + days);
    handleSelectDate(formatDateKey(nextDate));
  }, [handleSelectDate, selectedDate, summary?.date]);

  const handlePrevDate = useCallback(() => {
    handleShiftDate(-1);
  }, [handleShiftDate]);

  const handleNextDate = useCallback(() => {
    handleShiftDate(1);
  }, [handleShiftDate]);

  const handleDetails = useCallback((booking: BookingDTO) => {
    setIsEditOpen(false);
    setEditBooking(null);
    setDetailsBooking(booking);
    setIsDetailsOpen(true);
  }, []);

  const handleEdit = useCallback((booking: BookingDTO) => {
    setIsDetailsOpen(false);
    setDetailsBooking(null);
    setEditBooking(booking);
    setIsEditOpen(true);
  }, []);

  const handleDetailsOpenChange = useCallback((open: boolean) => {
    setIsDetailsOpen(open);
    if (!open) {
      setDetailsBooking(null);
    }
  }, []);

  const handleEditOpenChange = useCallback((open: boolean) => {
    setIsEditOpen(open);
    if (!open) {
      setEditBooking(null);
    }
  }, []);

  const resolveCancelTargetDate = useCallback(
    (booking: BookingDTO, timezone: string) => {
      if (booking.startIso) {
        const startDate = new Date(booking.startIso);
        if (!Number.isNaN(startDate.getTime())) {
          return getDateInTimezone(startDate, timezone);
        }
      }
      if (summary?.date) {
        return summary.date;
      }
      if (selectedDate) {
        return selectedDate;
      }
      return getTodayInTimezone(timezone);
    },
    [selectedDate, summary?.date],
  );

  const handleCancelRequest = useCallback((booking: BookingDTO) => {
    setIsDetailsOpen(false);
    setDetailsBooking(null);
    setIsEditOpen(false);
    setEditBooking(null);
    setCancelBooking(booking);
    setIsCancelOpen(true);
  }, []);

  const handleCancelOpenChange = useCallback((open: boolean) => {
    setIsCancelOpen(open);
    if (!open) {
      setCancelBooking(null);
    }
  }, []);

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
    const date = selectedDate ?? summary.date;
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
  }, [filter, pathname, searchQuery, selectedDate, sortDir, sortKey, summary]);

  const handleSearchChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  }, []);

  const { guestStats, tabCounts } = useMemo(() => {
    const empty = {
      guestStats: { upcoming: 0, seated: 0 },
      tabCounts: { all: 0, upcoming: 0, seated: 0, finished: 0, no_show: 0 },
    };
    if (!summary) return empty;

    let all = 0;
    let upcoming = 0;
    let seatedCount = 0;
    let finished = 0;
    let noShow = 0;
    let guestUpcoming = 0;
    let guestSeated = 0;

    for (const booking of summary.bookings) {
      all += 1;
      const status = booking.status;

      if (
        status === 'confirmed' ||
        status === 'PRIORITY_WAITLIST' ||
        status === 'pending' ||
        status === 'pending_allocation'
      ) {
        upcoming += 1;
      }

      if (status === 'checked_in') {
        seatedCount += 1;
        guestSeated += booking.partySize;
      }

      if (status === 'no_show') {
        noShow += 1;
      }

      if (status === 'completed' || status === 'cancelled' || status === 'no_show') {
        finished += 1;
      }

      if (status === 'confirmed' || status === 'PRIORITY_WAITLIST') {
        guestUpcoming += booking.partySize;
      }
    }

    return {
      guestStats: { upcoming: guestUpcoming, seated: guestSeated },
      tabCounts: { all, upcoming, seated: seatedCount, finished, no_show: noShow },
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
  const handleMarkNoShow = useCallback(async (
    bookingId: string,
    options?: { performedAt?: string | null; reason?: string | null },
  ) => {
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
  }, [bookingLifecycleMutations.markNoShow, restaurantId, selectedDate]);

  const handleUndoNoShow = useCallback(async (bookingId: string, reason?: string | null) => {
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
  }, [bookingLifecycleMutations.undoNoShow, restaurantId, selectedDate]);

  const handleCheckIn = useCallback(async (bookingId: string) => {
    if (!restaurantId) return;
    setPendingBookingAction({ bookingId, action: 'check-in' });
    try {
      await bookingLifecycleMutations.checkIn.mutateAsync({
        restaurantId,
        bookingId,
        targetDate: selectedDate,
      });
      void refetchSummary();
    } finally {
      setPendingBookingAction(null);
    }
  }, [bookingLifecycleMutations.checkIn, refetchSummary, restaurantId, selectedDate]);

  const handleCheckOut = useCallback(async (bookingId: string) => {
    if (!restaurantId) return;
    setPendingBookingAction({ bookingId, action: 'check-out' });
    try {
      await bookingLifecycleMutations.checkOut.mutateAsync({
        restaurantId,
        bookingId,
        targetDate: selectedDate,
      });
      void refetchSummary();
    } finally {
      setPendingBookingAction(null);
    }
  }, [bookingLifecycleMutations.checkOut, refetchSummary, restaurantId, selectedDate]);

  const handleAssignTable = useCallback(async (bookingId: string, tableId: string, tableName?: string) => {
    const result = await tableAssignmentActions.assignTable.mutateAsync({
      bookingId,
      tableId,
      tableName,
    });
    return result.tableAssignments;
  }, [tableAssignmentActions.assignTable]);

  const handleUnassignTable = useCallback(async (bookingId: string, tableId: string) => {
    const result = await tableAssignmentActions.unassignTable.mutateAsync({ bookingId, tableId });
    return result.tableAssignments;
  }, [tableAssignmentActions.unassignTable]);

  const handleRetry = useCallback(() => refetchSummary(), [refetchSummary]);

  // ALL HOOKS MUST BE CALLED BEFORE EARLY RETURNS
  // Swipe gesture for touch devices
  const headerSwipeRef = useDateSwipe<HTMLElement>({
    onSwipeLeft: handleNextDate, // Swipe left = next day
    onSwipeRight: handlePrevDate, // Swipe right = previous day
    threshold: 50,
  });

  // Early returns must come after all hooks
  if (!restaurantId) {
    return <NoAccessState />;
  }

  // Only show full page skeleton on INITIAL load (no cached data yet)
  // For date changes/refetches, we keep the page visible with list-only skeletons
  const isInitialLoading = isSummaryLoading && !summary;
  const isRefetching = isSummaryFetching && !!summary;

  if (isInitialLoading) {
    return <DashboardSkeleton />;
  }

  // ONLY return error state if there is a REAL error AND no cached summary data.
  // This prevents transient error UI during reloads or navigation when stale data is available.
  const hasError = isSummaryError && !summary;
  if (hasError) {
    return <DashboardErrorState onRetry={handleRetry} />;
  }

  // Safety fallback: if for any reason summary is missing but we're not loading or showing error,
  // we might still be initializing session/memberships. Show skeleton.
  if (!summary) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="w-full min-w-0 bg-background font-sans text-foreground">
      <div className="mx-auto w-full min-w-0 max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* HEADER SECTION - Mobile-First Responsive with Swipe Support */}
        {/* HEADER SECTION - Fully Responsive (Mobile Center -> Tablet Left -> Desktop Row) */}
        {/* Changed split to xl (1280px) to prevent cramping on tablet/small laptop */}
        <header
          ref={headerSwipeRef}
          className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between"
        >
          {/* Title Section - Always full width */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                Operations
              </h1>
              <ConnectionStatusBeacon />
            </div>
            <p
              className={cn(
                'text-sm text-muted-foreground sm:text-base transition-opacity duration-300',
                isRefetching && 'opacity-50',
              )}
            >
              <span className="font-semibold text-foreground">{guestStats.upcoming} guests</span>{' '}
              expecting arrival
              <span className="mx-1.5 text-muted-foreground/50">·</span>
              <span className="font-semibold text-foreground">{guestStats.seated} seated</span> now
              {isRefetching && (
                <span className="ml-2 text-xs text-amber-600 animate-pulse">(Updating...)</span>
              )}
            </p>
          </div>

          {/* Right Side: Date Controls Wrapper */}
          <div className="flex flex-col gap-4 xl:items-end">
            {/* Service Date Info (Badges) */}
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start xl:justify-end">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-muted/70 px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground transition-all duration-200 ease-out hover:bg-muted motion-reduce:transition-none">
                Service Date
              </div>
              {summary &&
                (() => {
                  const totalBookings = summary.totals.total;
                  const totalCovers = summary.totals.covers;
                  return totalBookings > 0 ? (
                    <>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition-all duration-200 ease-out hover:scale-105 hover:shadow-md active:scale-95 dark:bg-blue-900/30 dark:text-blue-300 motion-reduce:transition-none motion-reduce:hover:scale-100">
                        {totalBookings} {totalBookings === 1 ? 'booking' : 'bookings'}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-all duration-200 ease-out hover:scale-105 hover:shadow-md active:scale-95 dark:bg-emerald-900/30 dark:text-emerald-300 motion-reduce:transition-none motion-reduce:hover:scale-100">
                        {totalCovers} {totalCovers === 1 ? 'cover' : 'covers'}
                      </span>
                    </>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
                      No bookings
                    </span>
                  );
                })()}
            </div>

            {/* Unified Date Navigation Control */}
            <div className="relative flex items-center justify-center gap-2 sm:justify-start xl:justify-end">
              {/* Swipe hint - left */}
              <div
                className="pointer-events-none absolute left-0 flex items-center opacity-30 animate-pulse xl:hidden"
                aria-hidden="true"
              >
                <ChevronsLeft className="h-4 w-4 text-muted-foreground" />
              </div>

              {/* Single Unified Navigation Control */}
              <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card/80 p-1.5 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md">
                {/* Previous button */}
                <button
                  type="button"
                  onClick={handlePrevDate}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring active:scale-95 motion-reduce:active:scale-100"
                  aria-label="Previous day"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                </button>

                {/* Clickable date that opens calendar */}
                <HeatmapCalendar
                  summary={summary}
                  heatmap={heatmapQuery.data}
                  selectedDate={summary.date}
                  onSelectDate={handleSelectDate}
                  onShiftDate={handleShiftDate}
                  isLoading={heatmapQuery.isLoading}
                  onOpenChange={setIsCalendarOpen}
                />

                {/* Next button */}
                <button
                  type="button"
                  onClick={handleNextDate}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring active:scale-95 motion-reduce:active:scale-100"
                  aria-label="Next day"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              </div>

              {/* Swipe hint - right */}
              <div
                className="pointer-events-none absolute right-0 flex items-center opacity-30 animate-pulse xl:hidden"
                aria-hidden="true"
              >
                <ChevronsRight className="h-4 w-4 text-muted-foreground" />
              </div>
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
                <BookingsFilterBar
                  value={filter}
                  onChange={handleSelectFilter}
                  counts={tabCounts}
                />
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
                  onChange={handleSearchChange}
                  autoComplete="off"
                  className="h-10 w-full rounded-lg border border-border bg-background pl-10 pr-4 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 touch-manipulation"
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0 h-10 w-10 bg-card touch-manipulation"
              >
                <Filter className="h-4 w-4 text-muted-foreground" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-10 gap-2 bg-card px-3 text-sm"
                onClick={handlePrint}
                aria-label="Print bookings"
              >
                <Printer className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">Print</span>
              </Button>
            </div>
          </div>
        </div>

        {/* RESPONSIVE LAYOUT (Booking List - Full Width) */}
        <div className="space-y-6">
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
            searchQuery={deferredSearchQuery}
            sortKey={sortKey}
            sortDir={sortDir}
            onSortKeyChange={setSortKey}
            onSortDirChange={setSortDir}
            isRefetching={isRefetching}
            showFilterBar={false}
            showHeatmap={false}
            allowTableAssignments={allowTableAssignments}
            restaurantSlug={restaurantSlug}
            onDetails={handleDetails}
            onEdit={handleEdit}
            onCancel={handleCancelRequest}
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
        {isDetailsOpen ? (
          <BookingDetailsDialogWrapper
            bookingId={detailsBooking?.id ?? null}
            initialData={detailsBooking}
            open={isDetailsOpen}
            onOpenChange={handleDetailsOpenChange}
          />
        ) : null}
        <EditBookingDialog
          booking={editBooking}
          open={isEditOpen}
          onOpenChange={handleEditOpenChange}
          restaurantSlug={restaurantSlug}
          restaurantTimezone={restaurantTimezone}
          mode="ops"
        />
        <AlertDialog open={isCancelOpen} onOpenChange={handleCancelOpenChange}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
              <AlertDialogDescription>
                {cancelBooking
                  ? `You’re about to cancel ${cancelBooking.customerName ?? 'this booking'} for ${cancelBooking.partySize} covers. This action cannot be undone.`
                  : 'This action cannot be undone.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={cancelBookingMutation.isPending}>
                Keep booking
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmCancel}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={cancelBookingMutation.isPending}
              >
                Confirm cancellation
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
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
