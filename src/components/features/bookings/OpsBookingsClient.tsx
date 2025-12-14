'use client';

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
import { BookingStateMachineProvider, useBookingStateMachine } from '@/contexts/booking-state-machine';
import { useOpsActiveMembership, useOpsSession } from '@/contexts/ops-session';
import {
  useOpsBookingsTableState,
  type OpsStatusFilter,
  useOpsBookingStatusSummary,
  useOpsBookingsList,
  useOpsRestaurantDetails,
} from '@/hooks';
import { useOpsBooking } from '@/hooks/ops/useOpsBooking';
import { buildOpsDateRange } from '@/utils/ops/bookings';

import type { StatusOption } from '@/components/dashboard/StatusFilterGroup';
import type { BookingDTO } from '@/hooks/useBookings';
import type { StatusFilter } from '@/hooks/useBookingsTableState';
import type { OpsBookingListItem, OpsBookingStatus } from '@/types/ops';

const DEFAULT_FILTER: OpsStatusFilter = 'recent';
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = DASHBOARD_DEFAULT_PAGE_SIZE;

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

export function OpsBookingsClient({ initialFilter, initialPage, initialRestaurantId, initialQuery, initialStatuses, initialDate }: OpsBookingsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { memberships, activeRestaurantId, setActiveRestaurantId, accountSnapshot } = useOpsSession();
  const activeMembership = useOpsActiveMembership();
  const restaurantDetails = useOpsRestaurantDetails(activeRestaurantId ?? null);
  const focusBookingId = searchParams?.get('focus') ?? null;

  const restaurantTimezone = restaurantDetails.data?.timezone ?? null;
  const appliedDateRange = useMemo(() => buildOpsDateRange(initialDate, restaurantTimezone), [initialDate, restaurantTimezone]);

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
    if (!router || !searchParams) {
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
  }, [activeRestaurantId]);

  useEffect(() => {
    if (!activeRestaurantId) {
      return;
    }
    setPage(1);
  }, [activeRestaurantId, setPage]);

  const filters = useMemo(() => {
    if (!activeRestaurantId) return null;
    const base = {
      restaurantId: activeRestaurantId,
      ...queryFilters,
    };
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
  }, [activeRestaurantId, appliedDateRange, queryFilters]);

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
    return OPS_LISTABLE_STATUSES.map((status) => ({
      status,
      count: totals ? (totals[status] ?? 0) : 0,
    }));
  }, [statusSummaryQuery.data?.totals]);

  const [detailsBooking, setDetailsBooking] = useState<BookingDTO | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const updateSearchParams = useCallback(
    (updates: Record<string, string | null>) => {
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
    [pathname, router, searchParams],
  );

  const handleStatusChange = useCallback(
    (nextStatus: OpsStatusFilter) => {
      handleStatusFilterChange(nextStatus);
      updateSearchParams({ filter: nextStatus === DEFAULT_FILTER ? null : nextStatus, page: null });
    },
    [handleStatusFilterChange, updateSearchParams],
  );

  const handlePageRequest = useCallback(
    (nextPage: number) => {
      const total = bookingsPage.pageInfo.total ?? 0;
      handlePageChange(nextPage, total);
      const targetPage = Number.isNaN(nextPage) ? null : String(nextPage);
      updateSearchParams({ page: targetPage === String(DEFAULT_PAGE) ? null : targetPage });
    },
    [bookingsPage.pageInfo.total, handlePageChange, updateSearchParams],
  );

  const handleSearchInput = useCallback(
    (value: string) => {
      handleSearchChange(value);
      const trimmed = value.trim();
      updateSearchParams({ query: trimmed.length > 0 ? trimmed : null, page: null });
    },
    [handleSearchChange, updateSearchParams],
  );

  const handleToggleStatus = useCallback(
    (status: OpsBookingStatus) => {
      toggleSelectedStatus(status);
      const exists = visibleSelectedStatuses.includes(status);
      const next = exists
        ? visibleSelectedStatuses.filter((value) => value !== status)
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
      <section className="space-y-6 lg:space-y-8">
        <div className="overflow-hidden rounded-2xl border bg-card/60 p-5 shadow-sm sm:p-6 lg:p-7">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1.5">
              <h2 className="text-xl font-semibold leading-tight text-foreground sm:text-2xl">Manage bookings</h2>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="rounded-full">
                  {currentRestaurantName}
                </Badge>
                {appliedDateRange ? (
                  <Badge
                    variant="outline"
                    className="rounded-full"
                    title={restaurantTimezone ? `Service timezone: ${restaurantTimezone}` : undefined}
                  >
                    {appliedDateRange.date}
                    {restaurantTimezone ? ` · ${restaurantTimezone}` : ''}
                  </Badge>
                ) : null}
              </div>
            </div>
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
              <Button asChild size="sm" className="h-9 px-4">
                <Link href="/walk-in">Log walk-in</Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="h-9 px-4">
                <Link href="/dashboard">Back to dashboard</Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-card shadow-sm">
          <div className="space-y-4 px-2 py-4 sm:px-4 sm:py-5 lg:px-6">
            <BookingOfflineBanner />
            <OpsStatusFilterPopover
              options={statusFilterOptions}
              selected={visibleSelectedStatuses}
              onToggle={handleToggleStatus}
              onClear={handleClearStatuses}
              isLoading={statusSummaryQuery.isLoading}
              order={OPS_LISTABLE_STATUSES}
            />
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
              variant="ops"
              statusOptions={OPS_STATUS_TABS}
              opsActionMode="details-only"
              showHeaderTitle={false}
              timezone={restaurantTimezone || 'UTC'}
            />
          </div>
        </div>

        <BookingDetailsDialogWrapper
          bookingId={detailsBooking?.id ?? null}
          initialData={detailsBooking}
          open={isDetailsOpen}
          onOpenChange={handleDetailsOpenChange}
        />
      </section>
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
