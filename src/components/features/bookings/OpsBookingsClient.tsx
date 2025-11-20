'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { BookingsTable } from '@/components/dashboard/BookingsTable';
import { CancelBookingDialog } from '@/components/dashboard/CancelBookingDialog';
import { DASHBOARD_DEFAULT_PAGE_SIZE } from '@/components/dashboard/constants';
import { EditBookingDialog } from '@/components/dashboard/EditBookingDialog';
import { BookingOfflineBanner } from '@/components/features/booking-state-machine';
import { OpsStatusFilter as OpsStatusesControl } from '@/components/features/bookings/OpsStatusFilter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useOpsActiveMembership, useOpsSession } from '@/contexts/ops-session';
import {
  useOpsBookingsTableState,
  type OpsStatusFilter,
  useOpsBookingsList,
  useOpsBookingStatusSummary,
} from '@/hooks';
import { useOpsBookingLifecycleActions } from '@/hooks/ops/useOpsBookingStatusActions';
import { useOpsCancelBooking } from '@/hooks/useOpsCancelBooking';
import { useOpsUpdateBooking } from '@/hooks/useOpsUpdateBooking';
import { useOpsBooking } from '@/hooks/ops/useOpsBooking';

import type { StatusOption } from '@/components/dashboard/StatusFilterGroup';
import type { BookingAction } from '@/components/features/booking-state-machine';
import type { BookingDTO } from '@/hooks/useBookings';
import type { StatusFilter } from '@/hooks/useBookingsTableState';
import type { OpsBookingListItem, OpsBookingStatus } from '@/types/ops';

const DEFAULT_FILTER: OpsStatusFilter = 'recent';
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = DASHBOARD_DEFAULT_PAGE_SIZE;

const OPS_STATUS_TABS: StatusOption[] = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'all', label: 'All' },
  { value: 'past', label: 'Past' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'recent', label: 'Recent' },
];

export type OpsBookingsClientProps = {
  initialFilter?: OpsStatusFilter | null;
  initialPage?: number | null;
  initialRestaurantId?: string | null;
  initialQuery?: string | null;
  initialStatuses?: OpsBookingStatus[] | null;
};

const OPS_STATUS_ORDER: OpsBookingStatus[] = [
  'confirmed',
  'checked_in',
  'completed',
  'pending',
  'pending_allocation',
  'no_show',
  'cancelled',
  'PRIORITY_WAITLIST',
];

export function OpsBookingsClient({ initialFilter, initialPage, initialRestaurantId, initialQuery, initialStatuses }: OpsBookingsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { memberships, activeRestaurantId, setActiveRestaurantId, accountSnapshot } = useOpsSession();
  const activeMembership = useOpsActiveMembership();
  const focusBookingId = searchParams?.get('focus') ?? null;

  const effectiveFilter = initialFilter ?? DEFAULT_FILTER;
  const effectivePage = initialPage ?? DEFAULT_PAGE;

  const tableState = useOpsBookingsTableState({
    initialStatus: effectiveFilter,
    initialPage: effectivePage,
    pageSize: DEFAULT_PAGE_SIZE,
    initialQuery: initialQuery ?? '',
    initialSelectedStatuses: initialStatuses ?? [],
  });

  const { checkIn, checkOut, markNoShow, undoNoShow } = useOpsBookingLifecycleActions();

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
    setSelectedStatuses,
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
    router.replace(`/bookings${query ? `?${query}` : ''}`, { scroll: false });
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
    return {
      restaurantId: activeRestaurantId,
      ...queryFilters,
    };
  }, [activeRestaurantId, queryFilters]);

  const statusSummaryQuery = useOpsBookingStatusSummary({
    restaurantId: activeRestaurantId ?? null,
    from: queryFilters.from ?? null,
    to: queryFilters.to ?? null,
    statuses: selectedStatuses,
    enabled: Boolean(activeRestaurantId),
  });

  const bookingsQuery = useOpsBookingsList(filters);
  const bookingsPage = bookingsQuery.data ?? {
    items: [],
    pageInfo: { page, pageSize, total: 0, hasNext: false },
  };

  const [editBooking, setEditBooking] = useState<BookingDTO | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [cancelBooking, setCancelBooking] = useState<BookingDTO | null>(null);
  const [isCancelOpen, setIsCancelOpen] = useState(false);

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
      router.replace(`/bookings${query ? `?${query}` : ''}`, { scroll: false });
    },
    [router, searchParams],
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

  const syncStatusesToQuery = useCallback(
    (statuses: OpsBookingStatus[]) => {
      const value = statuses.length > 0 ? statuses.join(',') : null;
      updateSearchParams({ statuses: value, page: null });
    },
    [updateSearchParams],
  );

  const handleToggleStatusFilter = useCallback(
    (status: OpsBookingStatus) => {
      const exists = selectedStatuses.includes(status);
      const next = exists ? selectedStatuses.filter((value) => value !== status) : [...selectedStatuses, status];
      setSelectedStatuses(next);
      syncStatusesToQuery(next);
    },
    [selectedStatuses, setSelectedStatuses, syncStatusesToQuery],
  );

  const handleClearStatusFilters = useCallback(() => {
    clearSelectedStatuses();
    syncStatusesToQuery([]);
  }, [clearSelectedStatuses, syncStatusesToQuery]);

  const mapToBookingDTO = useCallback(
    (booking: OpsBookingListItem): BookingDTO => ({
      id: booking.id,
      restaurantId: booking.restaurantId ?? null,
      restaurantName: booking.restaurantName,
      restaurantSlug: activeMembership?.restaurantSlug ?? null,
      restaurantTimezone: null,
      partySize: booking.partySize,
      startIso: booking.startIso,
      endIso: booking.endIso,
      status: booking.status,
      notes: booking.notes ?? null,
      customerName: booking.customerName ?? null,
      customerEmail: booking.customerEmail ?? null,
      customerPhone: booking.customerPhone ?? null,
    }),
    [activeMembership?.restaurantSlug],
  );

  const bookings = useMemo(() => bookingsPage.items.map(mapToBookingDTO), [bookingsPage.items, mapToBookingDTO]);

  // Fetch focused booking if it exists (in case it's not in the current list)
  const { data: focusedBookingData } = useOpsBooking(focusBookingId);
  const focusedBooking = useMemo(() =>
    focusedBookingData ? mapToBookingDTO(focusedBookingData) : null
    , [focusedBookingData, mapToBookingDTO]);

  useEffect(() => {
    if (!focusBookingId) return;

    // Check if it's in the list
    const foundInList = bookings.find((b) => b.id === focusBookingId);
    const target = foundInList || focusedBooking;

    if (target) {
      // Open the dialog immediately
      setEditBooking(target);
      setIsEditOpen(true);

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

  const statusOptions = useMemo(() => {
    const totals = statusSummaryQuery.data?.totals ?? null;
    return OPS_STATUS_ORDER.map((status) => ({
      status,
      count: totals ? totals[status] ?? 0 : 0,
    }));
  }, [statusSummaryQuery.data]);

  const resolveRestaurantId = useCallback(
    (booking: BookingDTO): string | null => booking.restaurantId ?? activeRestaurantId ?? null,
    [activeRestaurantId],
  );

  const handleLifecycleCheckIn = useCallback(
    async (booking: BookingDTO) => {
      const restaurantId = resolveRestaurantId(booking);
      if (!restaurantId) return;
      await checkIn.mutateAsync({ restaurantId, bookingId: booking.id, targetDate: null });
    },
    [checkIn, resolveRestaurantId],
  );

  const handleLifecycleCheckOut = useCallback(
    async (booking: BookingDTO) => {
      const restaurantId = resolveRestaurantId(booking);
      if (!restaurantId) return;
      await checkOut.mutateAsync({ restaurantId, bookingId: booking.id, targetDate: null });
    },
    [checkOut, resolveRestaurantId],
  );

  const handleLifecycleMarkNoShow = useCallback(
    async (booking: BookingDTO, options?: { performedAt?: string | null; reason?: string | null }) => {
      const restaurantId = resolveRestaurantId(booking);
      if (!restaurantId) return;
      await markNoShow.mutateAsync({
        restaurantId,
        bookingId: booking.id,
        targetDate: null,
        performedAt: options?.performedAt ?? null,
        reason: options?.reason ?? null,
      });
    },
    [markNoShow, resolveRestaurantId],
  );

  const handleLifecycleUndoNoShow = useCallback(
    async (booking: BookingDTO, reason?: string | null) => {
      const restaurantId = resolveRestaurantId(booking);
      if (!restaurantId) return;
      await undoNoShow.mutateAsync({
        restaurantId,
        bookingId: booking.id,
        targetDate: null,
        reason: reason ?? null,
      });
    },
    [resolveRestaurantId, undoNoShow],
  );

  const pendingLifecycle = useMemo(() => {
    if (checkIn.isPending && checkIn.variables) {
      return { bookingId: checkIn.variables.bookingId, action: 'check-in' as BookingAction };
    }
    if (checkOut.isPending && checkOut.variables) {
      return { bookingId: checkOut.variables.bookingId, action: 'check-out' as BookingAction };
    }
    if (markNoShow.isPending && markNoShow.variables) {
      return { bookingId: markNoShow.variables.bookingId, action: 'no-show' as BookingAction };
    }
    if (undoNoShow.isPending && undoNoShow.variables) {
      return { bookingId: undoNoShow.variables.bookingId, action: 'undo-no-show' as BookingAction };
    }
    return { bookingId: null, action: null as BookingAction | null };
  }, [checkIn.isPending, checkIn.variables, checkOut.isPending, checkOut.variables, markNoShow.isPending, markNoShow.variables, undoNoShow.isPending, undoNoShow.variables]);

  const handleEdit = useCallback((booking: BookingDTO) => {
    setEditBooking(booking);
    setIsEditOpen(true);
  }, []);

  const handleEditOpenChange = useCallback((open: boolean) => {
    setIsEditOpen(open);
    if (!open) {
      setEditBooking(null);
      // Clear focus param if it exists
      if (focusBookingId) {
        updateSearchParams({ focus: null });
      }
    }
  }, [focusBookingId, updateSearchParams]);

  const handleCancel = useCallback((booking: BookingDTO) => {
    setCancelBooking(booking);
    setIsCancelOpen(true);
  }, []);

  const handleCancelOpenChange = useCallback((open: boolean) => {
    setIsCancelOpen(open);
    if (!open) {
      setCancelBooking(null);
    }
  }, []);

  if (memberships.length === 0) {
    return <NoRestaurantAccess />;
  }

  if (!activeRestaurantId) {
    return <SelectingRestaurantFallback />;
  }

  const currentRestaurantName =
    activeMembership?.restaurantName ?? accountSnapshot.restaurantName ?? 'This restaurant';

  return (
    <section className="space-y-6 lg:space-y-8">
      <div className="overflow-hidden rounded-2xl border bg-gradient-to-br from-background via-background to-muted/40 p-5 shadow-sm sm:p-6 lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold leading-tight text-foreground sm:text-2xl">Manage bookings</h2>
            <p className="text-sm text-muted-foreground sm:max-w-2xl">
              Review and act on reservations without losing context. Mobile-friendly controls keep filters, search, and status
              changes usable on the floor.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="rounded-full">
                {currentRestaurantName}
              </Badge>
              <Badge variant="outline" className="rounded-full">Ops console</Badge>
              {pendingLifecycle.bookingId ? (
                <Badge variant="default" className="rounded-full">
                  Updating {pendingLifecycle.action?.replace('-', ' ')}
                </Badge>
              ) : null}
            </div>
        </div>
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
            <Button asChild size="sm" className="h-9 px-4">
              <Link href="/app/walk-in">Log walk-in</Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="h-9 px-4">
              <Link href="/app">Back to dashboard</Link>
            </Button>
          </div>
        </div>

        <Separator className="my-4" />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)]">
          <BookingOfflineBanner />
          <div className="rounded-xl border bg-card/60 p-4 shadow-sm backdrop-blur">
            <div className="flex items-start justify-between gap-3 pb-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Status visibility</p>
                <p className="text-xs text-muted-foreground">
                  Combine status chips for precise triage. Clear with one tap.
                </p>
              </div>
              <Badge variant="outline" className="rounded-full text-xs">
                Live count
              </Badge>
            </div>
            <OpsStatusesControl
              options={statusOptions}
              selected={selectedStatuses}
              onToggle={handleToggleStatusFilter}
              onClear={handleClearStatusFilters}
              isLoading={statusSummaryQuery.isLoading}
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <h3 className="text-base font-semibold text-foreground sm:text-lg">Booking queue</h3>
              <p className="text-sm text-muted-foreground">
                Search, filter, and paginate without losing your place. Status toggles stay in sync with the list.
              </p>
            </div>
            <Badge variant="secondary" className="self-start rounded-full">
              {bookingsPage.pageInfo.total ?? 0} results
            </Badge>
          </div>
        </div>

        <div className="px-2 pb-4 pt-2 sm:px-4 sm:pb-6 sm:pt-3 lg:px-6">
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
            onEdit={handleEdit}
            onCancel={handleCancel}
            variant="ops"
            statusOptions={OPS_STATUS_TABS}
            opsLifecycle={{
              pendingBookingId: pendingLifecycle.bookingId,
              pendingAction: pendingLifecycle.action,
              onCheckIn: handleLifecycleCheckIn,
              onCheckOut: handleLifecycleCheckOut,
              onMarkNoShow: handleLifecycleMarkNoShow,
              onUndoNoShow: handleLifecycleUndoNoShow,
            }}
          />
        </div>
      </div>

      <EditBookingDialog
        booking={editBooking}
        open={isEditOpen}
        onOpenChange={handleEditOpenChange}
        mutationHook={useOpsUpdateBooking}
        restaurantSlug={activeMembership?.restaurantSlug ?? null}
      />

      <CancelBookingDialog
        booking={cancelBooking}
        open={isCancelOpen}
        onOpenChange={handleCancelOpenChange}
        mutationHook={useOpsCancelBooking}
      />
    </section>
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
        <Link href="/">Back to dashboard</Link>
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
