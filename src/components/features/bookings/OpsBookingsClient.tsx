'use client';

import debounce from 'lodash/debounce';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { BookingsTable } from '@/components/dashboard/BookingsTable';
import { DASHBOARD_DEFAULT_PAGE_SIZE } from '@/components/dashboard/constants';
import { BookingOfflineBanner } from '@/components/features/booking-state-machine';
import { BookingDetailsDialogWrapper } from '@/components/features/bookings/BookingDetailsDialogWrapper';
import { OpsStatusFilter as OpsStatusFilterPopover } from '@/components/features/bookings/OpsStatusFilter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { BookingStateMachineProvider, useBookingStateMachine } from '@/contexts/booking-state-machine';
import { useOpsActiveMembership, useOpsSession } from '@/contexts/ops-session';
import { useOpsBooking } from '@/hooks/ops/useOpsBooking';
import { useOpsBookingsList } from '@/hooks/ops/useOpsBookingsList';
import { useOpsBookingsTableState, type OpsStatusFilter } from '@/hooks/ops/useOpsBookingsTableState';
import { useOpsBookingLifecycleActions } from '@/hooks/ops/useOpsBookingStatusActions';
import { useOpsBookingStatusSummary } from '@/hooks/ops/useOpsBookingStatusSummary';
import { useOpsRestaurantDetails } from '@/hooks/ops/useOpsRestaurantDetails';
import { useToast } from '@/hooks/use-toast';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import {
  DEFAULT_OPS_BOOKINGS_WINDOW_MINUTES,
  buildOpsDateRange,
  buildOpsTimeWindowRange,
  sanitizeTimeParam,
} from '@/utils/ops/bookings';

import type { StatusOption } from '@/components/dashboard/StatusFilterGroup';
import type { BookingDTO } from '@/hooks/useBookings';
import type { StatusFilter } from '@/hooks/useBookingsTableState';
import type { OpsBookingListItem, OpsBookingStatus, OpsBookingsFilters } from '@/types/ops';

const DEFAULT_FILTER: OpsStatusFilter = 'recent';
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = DASHBOARD_DEFAULT_PAGE_SIZE;
const MIN_WINDOW_MINUTES = 15;
const MAX_WINDOW_MINUTES = 240;

export type OpsBookingsWindowMode = 'day' | 'window';

const OPS_STATUS_TABS: StatusOption[] = [
  { value: 'recent', label: 'Recent' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'all', label: 'All' },
  { value: 'past', label: 'Past' },
  { value: 'cancelled', label: 'Cancelled' },
];

const OPS_LISTABLE_STATUSES: OpsBookingStatus[] = [
  'pending',
  'pending_allocation',
  'confirmed',
  'checked_in',
  'completed',
  'no_show',
  'cancelled',
];

export type OpsBookingsClientProps = {
  initialFilter?: OpsStatusFilter | null;
  initialPage?: number | null;
  initialRestaurantId?: string | null;
  initialQuery?: string | null;
  initialStatuses?: OpsBookingStatus[] | null;
  initialDate?: string | null;
  initialTableId?: string | null;
  initialTableLabel?: string | null;
  initialTime?: string | null;
  initialWindowMode?: OpsBookingsWindowMode | null;
  initialWindowMinutes?: number | null;
};

function BookingStateRegistrar({ bookings }: { bookings: BookingDTO[] }) {
  const { registerBookings } = useBookingStateMachine();
  useEffect(() => {
    registerBookings(
      bookings.map((booking) => ({
        id: booking.id,
        status: booking.status as OpsBookingStatus,
        updatedAt: null,
      })),
    );
  }, [bookings, registerBookings]);
  return null;
}

export function OpsBookingsClient({
  initialFilter,
  initialPage,
  initialRestaurantId,
  initialQuery,
  initialStatuses,
  initialDate,
  initialTableId,
  initialTableLabel,
  initialTime,
  initialWindowMode,
  initialWindowMinutes,
}: OpsBookingsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { memberships, activeRestaurantId, setActiveRestaurantId, accountSnapshot } = useOpsSession();
  const activeMembership = useOpsActiveMembership();
  const restaurantDetails = useOpsRestaurantDetails(activeRestaurantId ?? null);
  const isOnline = useOnlineStatus();
  const { toast } = useToast();
  const focusBookingId = searchParams?.get('focus') ?? null;
  const resolvedTableId = searchParams?.get('tableId') ?? initialTableId ?? null;
  const resolvedTableLabel = searchParams?.get('tableLabel') ?? initialTableLabel ?? null;
  const resolvedTime = sanitizeTimeParam(searchParams?.get('time') ?? initialTime) ?? null;

  const resolvedWindowMode = useMemo<OpsBookingsWindowMode>(() => {
    const raw = searchParams?.get('windowMode');
    if (raw === 'day' || raw === 'window') return raw;
    if (initialWindowMode === 'day' || initialWindowMode === 'window') return initialWindowMode;
    return resolvedTableId && resolvedTime ? 'window' : 'day';
  }, [initialWindowMode, resolvedTableId, resolvedTime, searchParams]);

  const resolvedWindowMinutes = useMemo(() => {
    const fallback = typeof initialWindowMinutes === 'number'
      ? initialWindowMinutes
      : DEFAULT_OPS_BOOKINGS_WINDOW_MINUTES;
    const raw = searchParams?.get('windowMinutes');
    if (!raw) return fallback;
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed)) return fallback;
    if (parsed < MIN_WINDOW_MINUTES || parsed > MAX_WINDOW_MINUTES) return fallback;
    return parsed;
  }, [initialWindowMinutes, searchParams]);

  const restaurantTimezone = restaurantDetails.data?.timezone ?? null;
  const appliedDateRange = useMemo(() => {
    if (resolvedWindowMode === 'window' && resolvedTime) {
      const windowRange = buildOpsTimeWindowRange(initialDate, resolvedTime, resolvedWindowMinutes, restaurantTimezone);
      if (windowRange) return windowRange;
    }
    return buildOpsDateRange(initialDate, restaurantTimezone);
  }, [initialDate, restaurantTimezone, resolvedTime, resolvedWindowMinutes, resolvedWindowMode]);

  const effectiveFilter = initialFilter ?? (initialDate ? 'all' : DEFAULT_FILTER);
  const effectivePage = initialPage ?? DEFAULT_PAGE;
  const sanitizedInitialStatuses = useMemo(
    () => (initialStatuses ?? []).filter((status) => OPS_LISTABLE_STATUSES.includes(status)),
    [initialStatuses],
  );

  const tableState = useOpsBookingsTableState({
    initialStatus: effectiveFilter,
    initialPage: effectivePage,
    pageSize: DEFAULT_PAGE_SIZE,
    initialQuery: initialQuery ?? '',
    initialSelectedStatuses: sanitizedInitialStatuses,
  });

  const {
    statusFilter,
    page,
    pageSize,
    queryFilters,
    handleStatusFilterChange,
    handlePageChange,
    handleSearchChange,
    setPage,
    search,
    selectedStatuses,
    toggleSelectedStatus,
    clearSelectedStatuses,
  } = tableState;

  useEffect(() => {
    if (initialRestaurantId && initialRestaurantId !== activeRestaurantId) {
      setActiveRestaurantId(initialRestaurantId);
    }
    // we only want to run this on mount or when the initial value changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRestaurantId]);

  useEffect(() => {
    if (!router || !searchParams || !isOnline) {
      return;
    }

    const currentParam = searchParams.get('restaurantId');
    const target = activeRestaurantId ?? null;

    if (currentParam === target || (!currentParam && !target)) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    if (target) {
      params.set('restaurantId', target);
      params.delete('page');
    } else {
      params.delete('restaurantId');
      params.delete('page');
    }

    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ''}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRestaurantId, isOnline]);

  useEffect(() => {
    if (!activeRestaurantId) {
      return;
    }
    setPage(1);
  }, [activeRestaurantId, setPage]);

  const filters = useMemo(() => {
    if (!activeRestaurantId) return null;
    const base: OpsBookingsFilters = {
      restaurantId: activeRestaurantId,
      ...queryFilters,
    };
    if (resolvedTableId) {
      base.tableId = resolvedTableId;
    }
    if (appliedDateRange) {
      return {
        ...base,
        from: appliedDateRange.from,
        to: appliedDateRange.to,
        sort: 'asc' as const,
        sortBy: 'start_at' as const,
      };
    }
    return base;
  }, [activeRestaurantId, appliedDateRange, queryFilters, resolvedTableId]);

  const bookingsQuery = useOpsBookingsList(filters);
  const bookingsPage = bookingsQuery.data ?? {
    items: [],
    pageInfo: { page, pageSize, total: 0, hasNext: false },
  };

  const visibleSelectedStatuses = useMemo(
    () => selectedStatuses.filter((status) => OPS_LISTABLE_STATUSES.includes(status)),
    [selectedStatuses],
  );

  const statusSummaryQuery = useOpsBookingStatusSummary({
    restaurantId: activeRestaurantId,
    from: appliedDateRange?.from ?? null,
    to: appliedDateRange?.to ?? null,
    enabled: Boolean(activeRestaurantId),
  });

  const statusFilterOptions = useMemo(() => {
    const totals = statusSummaryQuery.data?.totals;
    return OPS_LISTABLE_STATUSES.map((status: OpsBookingStatus) => ({
      status,
      count: totals ? (totals[status] ?? 0) : 0,
    }));
  }, [statusSummaryQuery.data?.totals]);

  const [detailsBooking, setDetailsBooking] = useState<BookingDTO | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const updateSearchParams = useCallback(
    (updates: Record<string, string | null>) => {
      if (!isOnline) {
        return;
      }
      const params = new URLSearchParams(searchParams?.toString() || '');
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === '') {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });
      const query = params.toString();
      router.replace(`${pathname}${query ? `?${query}` : ''}`, { scroll: false });
    },
    [isOnline, pathname, router, searchParams],
  );

  const handleStatusChange = useCallback(
    (nextStatus: OpsStatusFilter) => {
      handleStatusFilterChange(nextStatus);
      updateSearchParams({ filter: nextStatus === DEFAULT_FILTER ? null : nextStatus, page: null });
    },
    [handleStatusFilterChange, updateSearchParams],
  );

  const handleWindowModeChange = useCallback(
    (value: string) => {
      if (!value) return;
      if (value !== 'day' && value !== 'window') return;
      updateSearchParams({
        windowMode: value,
        windowMinutes: value === 'window' ? String(resolvedWindowMinutes) : null,
        page: null,
      });
    },
    [resolvedWindowMinutes, updateSearchParams],
  );

  const handleClearTableFilter = useCallback(() => {
    updateSearchParams({
      tableId: null,
      tableLabel: null,
      time: null,
      windowMode: null,
      windowMinutes: null,
      page: null,
    });
  }, [updateSearchParams]);

  const handlePageRequest = useCallback(
    (nextPage: number) => {
      if (!isOnline) {
        toast({
          title: "You're offline",
          description: 'Reconnect to load more bookings.',
        });
        return;
      }
      const total = bookingsPage.pageInfo.total ?? 0;
      handlePageChange(nextPage, total);
      const targetPage = Number.isNaN(nextPage) ? null : String(nextPage);
      updateSearchParams({ page: targetPage === String(DEFAULT_PAGE) ? null : targetPage });
      // Scroll to top of list for better UX on mobile/desktop
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [bookingsPage.pageInfo.total, handlePageChange, isOnline, toast, updateSearchParams],
  );

  const [pendingBookingAction, setPendingBookingAction] = useState<{ bookingId: string; action: 'check-in' | 'check-out' | 'no-show' | 'undo-no-show' } | null>(null);

  const bookingLifecycleMutations = useOpsBookingLifecycleActions();

  const handleMarkNoShow = async (booking: BookingDTO, options?: { performedAt?: string | null; reason?: string | null }) => {
    if (!activeRestaurantId) return;
    setPendingBookingAction({ bookingId: booking.id, action: 'no-show' });
    try {
      await bookingLifecycleMutations.markNoShow.mutateAsync({
        restaurantId: activeRestaurantId,
        bookingId: booking.id,
        performedAt: options?.performedAt ?? null,
        reason: options?.reason ?? null,
        targetDate: appliedDateRange?.date,
      });
    } finally {
      setPendingBookingAction(null);
    }
  };

  const handleUndoNoShow = async (booking: BookingDTO, reason?: string | null) => {
    if (!activeRestaurantId) return;
    setPendingBookingAction({ bookingId: booking.id, action: 'undo-no-show' });
    try {
      await bookingLifecycleMutations.undoNoShow.mutateAsync({
        restaurantId: activeRestaurantId,
        bookingId: booking.id,
        reason: reason ?? null,
        targetDate: appliedDateRange?.date,
      });
    } finally {
      setPendingBookingAction(null);
    }
  };

  const handleCheckIn = async (booking: BookingDTO) => {
    if (!activeRestaurantId) return;
    setPendingBookingAction({ bookingId: booking.id, action: 'check-in' });
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await bookingLifecycleMutations.checkIn.mutateAsync({
        restaurantId: activeRestaurantId,
        bookingId: booking.id,
        targetDate: appliedDateRange?.date,
      });
    } finally {
      setPendingBookingAction(null);
    }
  };

  const handleCheckOut = async (booking: BookingDTO) => {
    if (!activeRestaurantId) return;
    setPendingBookingAction({ bookingId: booking.id, action: 'check-out' });
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await bookingLifecycleMutations.checkOut.mutateAsync({
        restaurantId: activeRestaurantId,
        bookingId: booking.id,
        targetDate: appliedDateRange?.date,
      });
    } finally {
      setPendingBookingAction(null);
    }
  };

  const debouncedSearchUpdate = useMemo(
    () =>
      debounce((value: string) => {
        const trimmed = value.trim();
        updateSearchParams({ query: trimmed.length > 0 ? trimmed : null, page: null });
      }, 500),
    [updateSearchParams]
  );

  const handleSearchInput = useCallback(
    (value: string) => {
      handleSearchChange(value);
      debouncedSearchUpdate(value);
    },
    [handleSearchChange, debouncedSearchUpdate],
  );

  const handleToggleStatus = useCallback(
    (status: OpsBookingStatus) => {
      toggleSelectedStatus(status);
      const exists = visibleSelectedStatuses.includes(status);
      const next = exists
        ? visibleSelectedStatuses.filter((value: OpsBookingStatus) => value !== status)
        : [...visibleSelectedStatuses, status];

      const normalized = Array.from(new Set(next));
      updateSearchParams({ statuses: normalized.length > 0 ? normalized.join(',') : null, page: null });
    },
    [toggleSelectedStatus, updateSearchParams, visibleSelectedStatuses],
  );

  const handleClearStatuses = useCallback(() => {
    clearSelectedStatuses();
    updateSearchParams({ statuses: null, page: null });
  }, [clearSelectedStatuses, updateSearchParams]);

  const mapToBookingDTO = useCallback(
    (booking: OpsBookingListItem): BookingDTO => ({
      id: booking.id,
      restaurantId: booking.restaurantId ?? null,
      restaurantName: booking.restaurantName,
      restaurantSlug: booking.restaurantSlug ?? activeMembership?.restaurantSlug ?? null,
      restaurantTimezone: booking.restaurantTimezone ?? null,
      partySize: booking.partySize,
      startIso: booking.startIso,
      endIso: booking.endIso,
      status: booking.status,
      notes: booking.notes ?? null,
      customerName: booking.customerName ?? null,
      customerEmail: booking.customerEmail ?? null,
      customerPhone: booking.customerPhone ?? null,
      reservationIntervalMinutes: booking.reservationIntervalMinutes ?? null,
      reference: booking.reference ?? null,
      source: booking.source ?? null,
      loyaltyTier: booking.loyaltyTier ?? null,
      loyaltyPoints: booking.loyaltyPoints ?? null,
      seatingPreference: booking.seatingPreference ?? null,
      allergies: booking.allergies ?? null,
      dietaryRestrictions: booking.dietaryRestrictions ?? null,
      tableAssignments: booking.tableAssignments ?? undefined,
      requiresTableAssignment: booking.requiresTableAssignment ?? undefined,
      checkedInAt: booking.checkedInAt ?? null,
      checkedOutAt: booking.checkedOutAt ?? null,
    }),
    [activeMembership?.restaurantSlug],
  );

  const bookings = useMemo(() => bookingsPage.items.map(mapToBookingDTO), [bookingsPage.items, mapToBookingDTO]);

  const initialSnapshots = useMemo(
    () =>
      bookings.map((booking) => ({
        id: booking.id,
        status: booking.status as OpsBookingStatus,
        updatedAt: null,
      })),
    [bookings],
  );

  // Fetch focused booking if it exists (in case it's not in the current list)
  const { data: focusedBookingData } = useOpsBooking(focusBookingId);
  const focusedBooking = useMemo(
    () => (focusedBookingData ? mapToBookingDTO(focusedBookingData) : null),
    [focusedBookingData, mapToBookingDTO],
  );

  useEffect(() => {
    if (!focusBookingId) return;

    // Check if it's in the list
    const foundInList = bookings.find((b) => b.id === focusBookingId);
    const target = foundInList || focusedBooking;

    if (target) {
      setDetailsBooking(target);
      setIsDetailsOpen(true);

      // Also scroll to row as backup/context if it exists in the DOM
      // Use setTimeout to allow render cycle to complete if needed
      setTimeout(() => {
        const row = document.querySelector<HTMLElement>(`[data-booking-id="${focusBookingId}"]`);
        if (row) {
          row.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      }, 100);
    }
  }, [bookings, focusBookingId, focusedBooking]);

  const handleDetails = useCallback((booking: BookingDTO) => {
    setDetailsBooking(booking);
    setIsDetailsOpen(true);
  }, []);

  const handleDetailsOpenChange = useCallback((open: boolean) => {
    setIsDetailsOpen(open);
    if (!open) {
      setDetailsBooking(null);
      if (focusBookingId) {
        updateSearchParams({ focus: null });
      }
    }
  }, [focusBookingId, updateSearchParams]);

  if (memberships.length === 0) {
    return <NoRestaurantAccess />;
  }

  if (!activeRestaurantId) {
    return <SelectingRestaurantFallback />;
  }

  const currentRestaurantName =
    activeMembership?.restaurantName ?? accountSnapshot.restaurantName ?? 'This restaurant';

  return (
    <BookingStateMachineProvider initialBookings={initialSnapshots}>
      <BookingStateRegistrar bookings={bookings} />
      <div className="min-h-screen bg-background font-sans text-foreground">
        <main className="mx-auto w-full max-w-6xl space-y-4 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
          {/* HEADER SECTION - Matches Dashboard Style */}
          <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Manage bookings</h1>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground sm:text-base">
                <Badge variant="secondary" className="rounded-md font-medium">
                  {currentRestaurantName}
                </Badge>
                {appliedDateRange ? (
                  <span className="flex items-center gap-1.5">
                    <span className="text-muted-foreground/40">•</span>
                    <span>
                      {appliedDateRange.date}
                      {restaurantTimezone ? ` (${restaurantTimezone})` : ''}
                    </span>
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button asChild size="sm" variant="outline" className="h-11 sm:h-9">
                <Link href="/dashboard">Back to dashboard</Link>
              </Button>
              <Button asChild size="sm" className="h-11 sm:h-9">
                <Link href="/new-bookings">New booking</Link>
              </Button>
            </div>
          </header>

          {/* STICKY TOOLBAR - Matches Dashboard Style */}
          <div className="sticky top-0 z-10 -mx-4 bg-background/80 px-4 py-2.5 backdrop-blur-md transition-all sm:-mx-6 sm:px-6 md:mx-0 md:rounded-xl md:border md:border-border/60 md:bg-card/80 md:px-3 md:shadow-sm">
            <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">

              {/* FILTERS */}
              <div className="flex-1 overflow-x-auto scrollbar-hide">
                <OpsStatusFilterPopover
                  options={statusFilterOptions}
                  selected={visibleSelectedStatuses}
                  onToggle={handleToggleStatus}
                  onClear={handleClearStatuses}
                  isLoading={statusSummaryQuery.isLoading}
                  order={OPS_LISTABLE_STATUSES}
                />
              </div>

              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                {resolvedTime ? (
                  <ToggleGroup
                    type="single"
                    value={resolvedWindowMode}
                    onValueChange={handleWindowModeChange}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start md:w-auto"
                    aria-label="Booking window"
                  >
                    <ToggleGroupItem value="window">Nearby</ToggleGroupItem>
                    <ToggleGroupItem value="day">All day</ToggleGroupItem>
                  </ToggleGroup>
                ) : null}

                {/* SEARCH */}
                <div className="relative w-full md:w-60 md:flex-none">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search guests..."
                    value={search}
                    onChange={(e) => handleSearchInput(e.target.value)}
                    className="h-9 w-full rounded-lg border border-border bg-background pl-10 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 touch-manipulation"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* TABLE SECTION */}
          <section className="space-y-3">
            {resolvedTableId ? (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="rounded-md text-xs font-medium text-foreground">
                  {resolvedTableLabel ? resolvedTableLabel : 'Table filter'}
                </Badge>
                {resolvedTime ? (
                  <Badge variant="secondary" className="rounded-md text-xs font-medium">
                    {resolvedTime}
                  </Badge>
                ) : null}
                <Badge variant="secondary" className="rounded-md text-xs font-medium">
                  {resolvedWindowMode === 'window'
                    ? `Nearby ±${resolvedWindowMinutes}m`
                    : 'All day'}
                </Badge>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleClearTableFilter}>
                  Clear filter
                </Button>
              </div>
            ) : null}
            <BookingOfflineBanner />
            <BookingsTable
              bookings={bookings}
              page={bookingsPage.pageInfo.page}
              pageSize={bookingsPage.pageInfo.pageSize}
              total={bookingsPage.pageInfo.total}
              statusFilter={statusFilter as StatusFilter}
              isLoading={bookingsQuery.isLoading}
              isFetching={bookingsQuery.isFetching}
              error={bookingsQuery.error ?? null}
              searchTerm={search}
              onSearchChange={handleSearchInput}
              onStatusFilterChange={(next) => handleStatusChange(next as OpsStatusFilter)}
              onPageChange={handlePageRequest}
              onRetry={() => bookingsQuery.refetch()}
              onDetails={handleDetails}
              onEdit={handleDetails}
              onCancel={handleDetails}
              variant="ops"
              statusOptions={OPS_STATUS_TABS}
              opsActionMode="full"
              opsLifecycle={{
                pendingBookingId: pendingBookingAction?.bookingId ?? null,
                pendingAction: pendingBookingAction?.action ?? null,
                onCheckIn: handleCheckIn,
                onCheckOut: handleCheckOut,
                onMarkNoShow: handleMarkNoShow,
                onUndoNoShow: handleUndoNoShow,
              }}
              showHeaderTitle={false}
              hideHeader={true}
              timezone={restaurantTimezone || 'UTC'}
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
    </BookingStateMachineProvider>
  );
}

function NoRestaurantAccess() {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border/60 bg-muted/20 p-8 text-center shadow-sm">
      <h2 className="text-xl font-semibold text-foreground">No restaurant access yet</h2>
      <p className="text-sm text-muted-foreground">
        Ask an owner or manager to send you an invitation so you can manage bookings.
      </p>
      <Button asChild variant="secondary">
        <Link href="/guest/dashboard">Back to dashboard</Link>
      </Button>
    </section>
  );
}

function SelectingRestaurantFallback() {
  return (
    <section className="mx-auto flex min-h-[40vh] max-w-2xl flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border/60 bg-muted/30 p-8 text-center shadow-sm">
      <h2 className="text-lg font-semibold text-foreground">Loading restaurant access…</h2>
      <p className="text-sm text-muted-foreground">We’re preparing your bookings. This will only take a moment.</p>
    </section>
  );
}
