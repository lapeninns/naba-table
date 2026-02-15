'use client';

import debounce from 'lodash/debounce';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { BookingsTable } from '@/components/dashboard/BookingsTable';
import { StatusFilterGroup } from '@/components/dashboard/StatusFilterGroup';
import { BookingOfflineBanner } from '@/components/features/booking-state-machine';
import { BookingDetailsDialogWrapper } from '@/components/features/bookings/BookingDetailsDialogWrapper';
import { OpsBookingsDatePicker } from '@/components/features/bookings/components/OpsBookingsDatePicker';
import {
  BookingStateRegistrar,
  NoRestaurantAccess,
  SelectingRestaurantFallback,
} from '@/components/features/bookings/components/OpsBookingsPageStates';
import { OpsBookingsSearchInput } from '@/components/features/bookings/components/OpsBookingsSearchInput';
import { OpsCancelBookingAlertDialog } from '@/components/features/bookings/components/OpsCancelBookingAlertDialog';
import { OPS_LISTABLE_STATUSES, OPS_STATUS_TABS } from '@/components/features/bookings/opsBookingsConstants';
import { OpsStatusFilter as OpsStatusFilterPopover } from '@/components/features/bookings/OpsStatusFilter';
import { OpsPageHeader } from '@/components/features/ops-shell/patterns/OpsPageHeader';
import { OpsPageToolbar } from '@/components/features/ops-shell/patterns/OpsPageToolbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  BookingStateMachineProvider,
} from '@/contexts/booking-state-machine';
import { useOpsActiveMembership, useOpsSession } from '@/contexts/ops-session';
import { useOpsBookingsDialogs } from '@/hooks/ops/useOpsBookingsDialogs';
import { useOpsBookingsLifecycleHandlers } from '@/hooks/ops/useOpsBookingsLifecycleHandlers';
import { useOpsBookingsList } from '@/hooks/ops/useOpsBookingsList';
import {
  useOpsBookingsTableState,
  type OpsStatusFilter,
} from '@/hooks/ops/useOpsBookingsTableState';
import { useOpsBookingStatusSummary } from '@/hooks/ops/useOpsBookingStatusSummary';
import { useOpsRestaurantDetails } from '@/hooks/ops/useOpsRestaurantDetails';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import { getTodayInTimezone } from '@/lib/utils/datetime';
import {
  DEFAULT_OPS_BOOKINGS_WINDOW_MINUTES,
  buildOpsDateRange,
  buildOpsTimeWindowRange,
  sanitizeTimeParam,
} from '@/utils/ops/bookings';
import { buildOpsBookingsFilters, type OpsBookingsView } from '@/utils/ops/buildOpsBookingsFilters';
import { sanitizeDateParam } from '@/utils/ops/dashboard';
import { mapOpsBookingListItemToBookingDTO } from '@/utils/ops/mapOpsBookingListItemToBookingDTO';


import type { BookingDTO } from '@/hooks/useBookings';
import type { StatusFilter } from '@/hooks/useBookingsTableState';
import type { OpsBookingListItem, OpsBookingStatus } from '@/types/ops';

const EditBookingDialog = dynamic(
  () => import('@/components/dashboard/EditBookingDialog').then((m) => m.EditBookingDialog),
  {
    loading: () => <div className="h-10" />,
  },
);

const DEFAULT_FILTER: OpsStatusFilter = 'upcoming';
const MIN_WINDOW_MINUTES = 15;
const MAX_WINDOW_MINUTES = 240;
export type OpsBookingsWindowMode = 'day' | 'window';

export type OpsBookingsClientProps = {
  initialFilter?: OpsStatusFilter | null;
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

export function OpsBookingsClient({
  initialFilter,
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
  const opsBasePath = pathname?.startsWith('/app') ? '/app' : '';
  const opsPath = (path: string) => `${opsBasePath}${path}`;
  const { memberships, activeRestaurantId, setActiveRestaurantId, accountSnapshot } =
    useOpsSession();
  const activeMembership = useOpsActiveMembership();
  const restaurantDetails = useOpsRestaurantDetails(activeRestaurantId ?? null);
  const isOnline = useOnlineStatus();
  const focusBookingId = searchParams?.get('focus') ?? null;
  const resolvedTableId = searchParams?.get('tableId') ?? initialTableId ?? null;
  const resolvedTableLabel = searchParams?.get('tableLabel') ?? initialTableLabel ?? null;
  const urlDate = sanitizeDateParam(searchParams ? searchParams.get('date') : initialDate);
  const [selectedDate, setSelectedDate] = useState<string | null>(() => urlDate);
  const resolvedTime = sanitizeTimeParam(searchParams?.get('time') ?? initialTime) ?? null;
  const [hasHydrated, setHasHydrated] = useState(false);
  const hydratedFocusBookingId = hasHydrated ? focusBookingId : null;

  useEffect(() => {
    setSelectedDate(urlDate);
  }, [urlDate]);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const resolvedWindowMode = useMemo<OpsBookingsWindowMode>(() => {
    const raw = searchParams?.get('windowMode');
    if (raw === 'day' || raw === 'window') return raw;
    if (initialWindowMode === 'day' || initialWindowMode === 'window') return initialWindowMode;
    return resolvedTableId && resolvedTime ? 'window' : 'day';
  }, [initialWindowMode, resolvedTableId, resolvedTime, searchParams]);

  const resolvedWindowMinutes = useMemo(() => {
    const fallback =
      typeof initialWindowMinutes === 'number'
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
  const restaurantSlug = restaurantDetails.data?.slug ?? activeMembership?.restaurantSlug ?? null;
  const appliedDateRange = useMemo(() => {
    if (resolvedWindowMode === 'window' && resolvedTime) {
      const windowRange = buildOpsTimeWindowRange(
        selectedDate,
        resolvedTime,
        resolvedWindowMinutes,
        restaurantTimezone,
      );
      if (windowRange) return windowRange;
    }
    return buildOpsDateRange(selectedDate, restaurantTimezone);
  }, [restaurantTimezone, resolvedTime, resolvedWindowMinutes, resolvedWindowMode, selectedDate]);

  const effectiveFilter = initialFilter ?? (initialDate ? 'all' : DEFAULT_FILTER);
  const sanitizedInitialStatuses = useMemo(
    () => (initialStatuses ?? []).filter((status) => OPS_LISTABLE_STATUSES.includes(status)),
    [initialStatuses],
  );

  const tableState = useOpsBookingsTableState({
    initialStatus: effectiveFilter,
    initialQuery: initialQuery ?? '',
    initialSelectedStatuses: sanitizedInitialStatuses,
  });

  const {
    statusFilter,
    handleStatusFilterChange,
    handleSearchChange,
    setStatusFilter,
    search,
    setSearch,
    deferredSearch,
    selectedStatuses,
    toggleSelectedStatus,
    clearSelectedStatuses,
  } = tableState;

  const defaultView: OpsBookingsView = selectedDate ? 'all' : 'upcoming';

  const view = useMemo<OpsBookingsView>(() => {
    switch (statusFilter) {
      case 'recent':
      case 'upcoming':
      case 'all':
      case 'past':
      case 'cancelled':
        return statusFilter;
      default:
        return defaultView;
    }
  }, [defaultView, statusFilter]);

  const visibleSelectedStatuses = useMemo(
    () => selectedStatuses.filter((status) => OPS_LISTABLE_STATUSES.includes(status)),
    [selectedStatuses],
  );

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
    } else {
      params.delete('restaurantId');
    }

    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ''}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRestaurantId, isOnline]);

  const filters = useMemo(() => {
    if (!activeRestaurantId) return null;
    return buildOpsBookingsFilters({
      restaurantId: activeRestaurantId,
      view,
      scope: appliedDateRange ? { from: appliedDateRange.from, to: appliedDateRange.to } : null,
      now: new Date(),
      query: deferredSearch,
      selectedStatuses: visibleSelectedStatuses,
      tableId: resolvedTableId,
    });
  }, [activeRestaurantId, appliedDateRange, deferredSearch, resolvedTableId, view, visibleSelectedStatuses]);

  const bookingsQuery = useOpsBookingsList(filters);
  const {
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isFetching,
    error,
    refetch,
  } = bookingsQuery;
  const bookingsPages = useMemo(() => bookingsQuery.data?.pages ?? [], [bookingsQuery.data?.pages]);
  const bookingsItems = useMemo(
    () => bookingsPages.flatMap((page) => page.items),
    [bookingsPages],
  );
  const bookingsTotal = bookingsPages[0]?.pageInfo.total ?? 0;

  const bookingLabelById = useMemo(() => {
    const map = new Map<string, string>();
    bookingsItems.forEach((booking) => {
      const label = booking.customerName?.trim();
      if (label) {
        map.set(booking.id, label);
      }
    });
    return map;
  }, [bookingsItems]);

  const getBookingLabel = useCallback(
    (bookingId: string) => bookingLabelById.get(bookingId) || 'Walk-in Guest',
    [bookingLabelById],
  );

  const { pendingActionsByBookingId, onCheckIn, onCheckOut, onMarkNoShow, onUndoNoShow } =
    useOpsBookingsLifecycleHandlers({
    restaurantId: activeRestaurantId,
    targetDate: appliedDateRange?.date ?? null,
    isOnline,
    getBookingLabel,
    });

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

  const updateSearchParams = useCallback(
    (updates: Record<string, string | null>) => {
      if (!isOnline) {
        return;
      }
      const params = new URLSearchParams(searchParams?.toString() || '');
      // Canonicalize away legacy pagination + alias params (infinite scrolling is canonical).
      params.delete('page');
      params.delete('pageSize');
      params.delete('status');
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

  useEffect(() => {
    if (!isOnline || !searchParams) return;
    if (searchParams.get('page') || searchParams.get('pageSize') || searchParams.get('status')) {
      updateSearchParams({});
    }
  }, [isOnline, searchParams, updateSearchParams]);

  const defaultStatusFilter: OpsStatusFilter = selectedDate ? 'all' : DEFAULT_FILTER;

  const handleViewChange = useCallback(
    (nextView: OpsBookingsView) => {
      handleStatusFilterChange(nextView);
      updateSearchParams({
        filter: nextView === defaultStatusFilter ? null : nextView,
      });
    },
    [defaultStatusFilter, handleStatusFilterChange, updateSearchParams],
  );

  const handleWindowModeChange = useCallback(
    (value: string) => {
      if (!value) return;
      if (value !== 'day' && value !== 'window') return;
      updateSearchParams({
        windowMode: value,
        windowMinutes: value === 'window' ? String(resolvedWindowMinutes) : null,
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
    });
  }, [updateSearchParams]);

  const handleSelectServiceDate = useCallback(
    (nextDate: string) => {
      setSelectedDate(nextDate);
      setStatusFilter('all');
      updateSearchParams({
        date: nextDate,
        filter: null,
      });
    },
    [setSelectedDate, setStatusFilter, updateSearchParams],
  );

  const handleTodayServiceDate = useCallback(() => {
    const tz = restaurantTimezone ?? 'UTC';
    handleSelectServiceDate(getTodayInTimezone(tz));
  }, [handleSelectServiceDate, restaurantTimezone]);

  const handleClearServiceDate = useCallback(() => {
    setSelectedDate(null);
    setStatusFilter(DEFAULT_FILTER);
    updateSearchParams({
      date: null,
      filter: null,
      time: null,
      windowMode: null,
      windowMinutes: null,
    });
  }, [setSelectedDate, setStatusFilter, updateSearchParams]);

  const handleLoadMore = useCallback(() => {
    if (!isOnline) {
      return;
    }
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, isOnline]);

  const debouncedSearchUpdate = useMemo(
    () =>
      debounce((value: string) => {
        const trimmed = value.trim();
        updateSearchParams({ query: trimmed.length > 0 ? trimmed : null });
      }, 200),
    [updateSearchParams],
  );

  useEffect(() => {
    return () => {
      debouncedSearchUpdate.cancel();
    };
  }, [debouncedSearchUpdate]);

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
      updateSearchParams({
        statuses: normalized.length > 0 ? normalized.join(',') : null,
      });
    },
    [toggleSelectedStatus, updateSearchParams, visibleSelectedStatuses],
  );

  const handleClearStatuses = useCallback(() => {
    clearSelectedStatuses();
    updateSearchParams({ statuses: null });
  }, [clearSelectedStatuses, updateSearchParams]);

  const shouldShowReset =
    search.trim().length > 0 ||
    visibleSelectedStatuses.length > 0 ||
    Boolean(selectedDate) ||
    Boolean(resolvedTableId) ||
    Boolean(resolvedTime) ||
    Boolean(hydratedFocusBookingId) ||
    statusFilter !== defaultStatusFilter;

  const handleReset = useCallback(() => {
    debouncedSearchUpdate.cancel();
    setSearch('');
    setStatusFilter(DEFAULT_FILTER);
    clearSelectedStatuses();
    setSelectedDate(null);

    updateSearchParams({
      filter: null,
      statuses: null,
      query: null,
      date: null,
      tableId: null,
      tableLabel: null,
      time: null,
      windowMode: null,
      windowMinutes: null,
      focus: null,
    });
  }, [
    clearSelectedStatuses,
    debouncedSearchUpdate,
    setSearch,
    setSelectedDate,
    setStatusFilter,
    updateSearchParams,
  ]);

  const handleStatusFilterSelect = useCallback(
    (next: StatusFilter) => handleViewChange(next as OpsBookingsView),
    [handleViewChange],
  );

  const handleRetry = useCallback(() => refetch(), [refetch]);

  const mapToBookingDTO = useCallback(
    (booking: OpsBookingListItem): BookingDTO =>
      mapOpsBookingListItemToBookingDTO(booking, restaurantSlug),
    [restaurantSlug],
  );

  const bookings = useMemo(
    () => bookingsItems.map(mapToBookingDTO),
    [bookingsItems, mapToBookingDTO],
  );

  const initialSnapshots = useMemo(
    () =>
      bookings.map((booking) => ({
        id: booking.id,
        status: booking.status as OpsBookingStatus,
        updatedAt: null,
      })),
    [bookings],
  );

  const clearFocusParam = useCallback(() => updateSearchParams({ focus: null }), [updateSearchParams]);

  const {
    detailsBooking,
    isDetailsOpen,
    onDetailsOpenChange: handleDetailsOpenChange,
    onDetails: handleDetails,
    editBooking,
    isEditOpen,
    onEditOpenChange: handleEditOpenChange,
    onEdit: handleEdit,
    cancelBooking,
    isCancelOpen,
    onCancelOpenChange: handleCancelOpenChange,
    onCancelRequest: handleCancelRequest,
    onConfirmCancel: handleConfirmCancel,
    isCancelling: isCancelPending,
  } = useOpsBookingsDialogs({
    bookings,
    focusBookingId: hydratedFocusBookingId,
    activeRestaurantId,
    restaurantTimezone,
    appliedDate: appliedDateRange?.date ?? null,
    mapToBookingDTO,
    clearFocusParam,
  });

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
          <a
            href="#ops-bookings-list"
            className="sr-only focus:not-sr-only focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            Skip to bookings list
          </a>
          <OpsPageHeader
            title="Manage bookings"
            meta={
              <>
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
              </>
            }
            secondaryActions={
              <Button asChild size="sm" variant="outline" className="h-11 sm:h-9">
                <Link href={opsPath('/dashboard')}>Back to dashboard</Link>
              </Button>
            }
            primaryAction={
              <Button asChild size="sm" className="h-11 sm:h-9">
                <Link href={opsPath('/new-bookings')}>New booking</Link>
              </Button>
            }
          />

          <OpsPageToolbar
            sticky
            filters={
              <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto scrollbar-hide">
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">View</span>
                  <StatusFilterGroup
                    value={view as StatusFilter}
                    options={OPS_STATUS_TABS}
                    onChange={(next) => handleViewChange(next as OpsBookingsView)}
                    ariaLabel="View bookings"
                  />
                </div>
                <OpsBookingsDatePicker
                  value={selectedDate}
                  timezone={restaurantTimezone || 'UTC'}
                  onSelectDate={handleSelectServiceDate}
                  onClear={handleClearServiceDate}
                  onToday={handleTodayServiceDate}
                />
                <OpsStatusFilterPopover
                  options={statusFilterOptions}
                  selected={visibleSelectedStatuses}
                  onToggle={handleToggleStatus}
                  onClear={handleClearStatuses}
                  isLoading={statusSummaryQuery.isLoading}
                  order={OPS_LISTABLE_STATUSES}
                />
              </div>
            }
            actions={
              <div className="flex flex-wrap items-center gap-2">
                {shouldShowReset ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-11 sm:h-9"
                    onClick={handleReset}
                  >
                    Reset
                  </Button>
                ) : null}
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
              </div>
            }
            search={
              <OpsBookingsSearchInput
                value={search}
                onChange={handleSearchInput}
                onClear={() => handleSearchInput('')}
                isSearching={isFetching && !isFetchingNextPage}
                placeholder="Search guests…"
                ariaLabel="Search guests"
                size="toolbar"
              />
            }
          >
            <BookingOfflineBanner />
          </OpsPageToolbar>

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
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={handleClearTableFilter}
                >
                  Clear filter
                </Button>
              </div>
            ) : null}
            <BookingsTable
              bookings={bookings}
              total={bookingsTotal}
              statusFilter={statusFilter as StatusFilter}
              isLoading={isLoading}
              isFetching={isFetching && !isFetchingNextPage}
              error={error ?? null}
              searchTerm={search}
              onSearchChange={handleSearchInput}
              onStatusFilterChange={handleStatusFilterSelect}
              onLoadMore={handleLoadMore}
              hasNextPage={hasNextPage ?? false}
              isFetchingNextPage={isFetchingNextPage ?? false}
              onRetry={handleRetry}
              onDetails={handleDetails}
              onEdit={handleEdit}
              onCancel={handleCancelRequest}
              variant="ops"
              statusOptions={OPS_STATUS_TABS}
              opsBasePath={opsBasePath}
              opsActionMode="full"
              opsLifecycle={{
                pendingActionsByBookingId,
                onCheckIn,
                onCheckOut,
                onMarkNoShow,
                onUndoNoShow,
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
          <EditBookingDialog
            booking={editBooking}
            open={isEditOpen}
            onOpenChange={handleEditOpenChange}
            restaurantSlug={restaurantSlug ?? editBooking?.restaurantSlug ?? null}
            restaurantTimezone={restaurantTimezone ?? editBooking?.restaurantTimezone ?? null}
            mode="ops"
          />
          <OpsCancelBookingAlertDialog
            open={isCancelOpen}
            onOpenChange={handleCancelOpenChange}
            customerName={cancelBooking?.customerName ?? null}
            partySize={cancelBooking?.partySize ?? null}
            whenLabel={null}
            onConfirm={handleConfirmCancel}
            isPending={isCancelPending}
          />
        </main>
      </div>
    </BookingStateMachineProvider>
  );
}
