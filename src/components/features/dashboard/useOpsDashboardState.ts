'use client';

import { useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useDeferredValue, useEffect, useMemo, useState, useTransition } from 'react';

import { useOpsActiveMembership } from '@/contexts/ops-session';
import { useOpsBookingHeatmap } from '@/hooks/ops/useOpsBookingHeatmap';
import { useOpsBookingLifecycleActions } from '@/hooks/ops/useOpsBookingStatusActions';
import { useOpsCancelBooking } from '@/hooks/ops/useOpsCancelBooking';
import { useOpsRestaurantDetails } from '@/hooks/ops/useOpsRestaurantDetails';
import { useOpsTableAssignmentActions } from '@/hooks/ops/useOpsTableAssignments';
import { useOpsTodaySummary } from '@/hooks/ops/useOpsTodaySummary';
import { useDateSwipe } from '@/hooks/useDateSwipe';
import { queryKeys } from '@/lib/query/keys';
import { formatDateKey, getDateInTimezone, getTodayInTimezone } from '@/lib/utils/datetime';
import { computeCalendarRange, sanitizeDateParam } from '@/utils/ops/dashboard';

import type { BookingFilter } from './BookingsFilterBar';
import type { BookingDTO } from '@/hooks/useBookings';
import type { ChangeEvent } from 'react';

const DEFAULT_FILTER: BookingFilter = 'upcoming';
const FILTER_PARAMS: BookingFilter[] = [
  'all',
  'upcoming',
  'seated',
  'finished',
  'completed',
  'no_show',
  'attention',
];
const SORT_KEYS = ['time', 'party', 'name'] as const;
const SORT_DIRS = ['asc', 'desc'] as const;

const parseFilterParam = (value: string | null): BookingFilter | null => {
  if (!value) return null;
  return FILTER_PARAMS.includes(value as BookingFilter) ? (value as BookingFilter) : null;
};

const parseSortKeyParam = (value: string | null): (typeof SORT_KEYS)[number] => {
  if (!value) return 'time';
  return (SORT_KEYS as readonly string[]).includes(value) ? (value as (typeof SORT_KEYS)[number]) : 'time';
};

const parseSortDirParam = (value: string | null): (typeof SORT_DIRS)[number] => {
  if (!value) return 'asc';
  return (SORT_DIRS as readonly string[]).includes(value) ? (value as (typeof SORT_DIRS)[number]) : 'asc';
};

type UseOpsDashboardStateProps = {
  initialDate: string | null;
};

export function useOpsDashboardState({ initialDate }: UseOpsDashboardStateProps) {
  const membership = useOpsActiveMembership();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<BookingFilter>(() => {
    const initial = parseFilterParam(searchParams?.get('filter') ?? null);
    return initial ?? DEFAULT_FILTER;
  });
  const [searchQuery, setSearchQuery] = useState(() => searchParams?.get('search') ?? '');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [selectedDate, setSelectedDate] = useState<string | null>(
    sanitizeDateParam(initialDate ?? undefined),
  );
  const [sortKey, setSortKeyState] = useState<'time' | 'party' | 'name'>(() =>
    parseSortKeyParam(searchParams?.get('sortKey') ?? null),
  );
  const [sortDir, setSortDirState] = useState<'asc' | 'desc'>(() =>
    parseSortDirParam(searchParams?.get('sortDir') ?? null),
  );
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

  const updateQueryParams = useCallback(
    (updates: {
      date?: string | null;
      filter?: BookingFilter | null;
      search?: string | null;
      sortKey?: 'time' | 'party' | 'name' | null;
      sortDir?: 'asc' | 'desc' | null;
    }) => {
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      const apply = (key: string, value?: string | null) => {
        if (value === null || value === undefined || value === '') {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      };

      if ('date' in updates) apply('date', updates.date ?? null);
      if ('filter' in updates) apply('filter', updates.filter ?? null);
      if ('search' in updates) apply('search', updates.search ?? null);
      if ('sortKey' in updates) apply('sortKey', updates.sortKey ?? null);
      if ('sortDir' in updates) apply('sortDir', updates.sortDir ?? null);

      const nextQuery = params.toString();
      const currentQuery = searchParams?.toString() ?? '';
      if (nextQuery === currentQuery) return;

      startTransition(() => {
        const query = nextQuery ? `?${nextQuery}` : '';
        router.replace(`${pathname}${query}`);
      });
    },
    [pathname, router, searchParams, startTransition],
  );

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
  const restaurantName = membership?.restaurantName ?? 'Restaurant';

  useEffect(() => {
    if (!summary) return;
    if (selectedDate) return;
    if (summary.date !== selectedDate) {
      if (restaurantId) {
        const nextKey = queryKeys.opsDashboard.summary(restaurantId, summary.date);
        queryClient.setQueryData(nextKey, summary);
      }
      setSelectedDate(summary.date);
    }
  }, [queryClient, restaurantId, selectedDate, summary]);

  const searchParamsKey = searchParams?.toString() ?? '';

  useEffect(() => {
    const params = new URLSearchParams(searchParamsKey);
    const nextFilter = parseFilterParam(params.get('filter')) ?? DEFAULT_FILTER;
    const nextSearch = params.get('search') ?? '';
    const nextSortKey = parseSortKeyParam(params.get('sortKey'));
    const nextSortDir = parseSortDirParam(params.get('sortDir'));
    const nextDate = sanitizeDateParam(params.get('date') ?? undefined);

    setFilter((current) => (current === nextFilter ? current : nextFilter));
    setSearchQuery((current) => (current === nextSearch ? current : nextSearch));
    setSortKeyState((current) => (current === nextSortKey ? current : nextSortKey));
    setSortDirState((current) => (current === nextSortDir ? current : nextSortDir));
    setSelectedDate((current) => (current === nextDate ? current : nextDate));
  }, [searchParamsKey]);

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

  const handleSelectFilter = useCallback(
    (nextFilter: BookingFilter) => {
      setFilter(nextFilter);
      updateQueryParams({ filter: nextFilter === DEFAULT_FILTER ? null : nextFilter });
    },
    [updateQueryParams],
  );

  const handleSelectDate = useCallback(
    (date: string) => {
      setSelectedDate(date);
      updateQueryParams({ date });
    },
    [updateQueryParams],
  );

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

  const handleSortKeyChange = useCallback(
    (value: 'time' | 'party' | 'name') => {
      setSortKeyState(value);
      updateQueryParams({
        sortKey: value === 'time' ? null : value,
        sortDir: sortDir === 'asc' ? null : sortDir,
      });
    },
    [sortDir, updateQueryParams],
  );

  const handleSortDirChange = useCallback(
    (value: 'asc' | 'desc') => {
      setSortDirState(value);
      updateQueryParams({
        sortKey: sortKey === 'time' ? null : sortKey,
        sortDir: value === 'asc' ? null : value,
      });
    },
    [sortKey, updateQueryParams],
  );

  useEffect(() => {
    const trimmed = deferredSearchQuery.trim();
    updateQueryParams({ search: trimmed ? trimmed : null });
  }, [deferredSearchQuery, updateQueryParams]);

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

  const handleAssignTable = useCallback(async (
    bookingId: string,
    tableId: string,
    tableName?: string,
  ) => {
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

  const headerSwipeRef = useDateSwipe<HTMLElement>({
    onSwipeLeft: handleNextDate,
    onSwipeRight: handlePrevDate,
    threshold: 50,
  });

  const isInitialLoading = isSummaryLoading && !summary;
  const isRefetching = isSummaryFetching && !!summary;
  const hasError = isSummaryError && !summary;

  return {
    membership,
    restaurantId,
    restaurantSlug,
    restaurantTimezone,
    restaurantName,
    summary,
    summaryQuery,
    heatmapQuery,
    isCalendarOpen,
    setIsCalendarOpen,
    filter,
    searchQuery,
    deferredSearchQuery,
    selectedDate,
    sortKey,
    sortDir,
    setSortKey: handleSortKeyChange,
    setSortDir: handleSortDirChange,
    guestStats,
    tabCounts,
    allowTableAssignments,
    pendingBookingAction,
    tableActionState,
    detailsBooking,
    isDetailsOpen,
    editBooking,
    isEditOpen,
    cancelBooking,
    isCancelOpen,
    isInitialLoading,
    isRefetching,
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
    handleMarkNoShow,
    handleUndoNoShow,
    handleCheckIn,
    handleCheckOut,
    handleAssignTable,
    handleUnassignTable,
    handleRetry,
    cancelBookingPending: cancelBookingMutation.isPending,
  };
}
