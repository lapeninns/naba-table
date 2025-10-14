'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { BookingsTable } from '@/components/dashboard/BookingsTable';
import { CancelBookingDialog } from '@/components/dashboard/CancelBookingDialog';
import { DASHBOARD_DEFAULT_PAGE_SIZE } from '@/components/dashboard/constants';
import { EditBookingDialog } from '@/components/dashboard/EditBookingDialog';
import { Button } from '@/components/ui/button';
import { useOpsActiveMembership, useOpsSession } from '@/contexts/ops-session';
import { useOpsBookingsTableState, type OpsStatusFilter, useOpsBookingsList } from '@/hooks';
import { useOpsCancelBooking } from '@/hooks/useOpsCancelBooking';
import { useOpsUpdateBooking } from '@/hooks/useOpsUpdateBooking';

import type { BookingDTO } from '@/hooks/useBookings';
import type { StatusFilter } from '@/hooks/useBookingsTableState';
import type { OpsBookingListItem } from '@/types/ops';

const DEFAULT_FILTER: OpsStatusFilter = 'upcoming';
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = DASHBOARD_DEFAULT_PAGE_SIZE;

export type OpsBookingsClientProps = {
  initialFilter?: OpsStatusFilter | null;
  initialPage?: number | null;
  initialRestaurantId?: string | null;
  initialQuery?: string | null;
};

export function OpsBookingsClient({ initialFilter, initialPage, initialRestaurantId, initialQuery }: OpsBookingsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { memberships, activeRestaurantId, setActiveRestaurantId, accountSnapshot } = useOpsSession();
  const activeMembership = useOpsActiveMembership();

  const effectiveFilter = initialFilter ?? DEFAULT_FILTER;
  const effectivePage = initialPage ?? DEFAULT_PAGE;

  const tableState = useOpsBookingsTableState({
    initialStatus: effectiveFilter,
    initialPage: effectivePage,
    pageSize: DEFAULT_PAGE_SIZE,
    initialQuery: initialQuery ?? '',
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
    router.replace(`/ops/bookings${query ? `?${query}` : ''}`, { scroll: false });
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
      router.replace(`/ops/bookings${query ? `?${query}` : ''}`, { scroll: false });
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

  const mapToBookingDTO = useCallback((booking: OpsBookingListItem): BookingDTO => ({
    id: booking.id,
    restaurantName: booking.restaurantName,
    partySize: booking.partySize,
    startIso: booking.startIso,
    endIso: booking.endIso,
    status: booking.status,
    notes: booking.notes ?? null,
    customerName: booking.customerName ?? null,
    customerEmail: booking.customerEmail ?? null,
  }), []);

  const bookings = useMemo(() => bookingsPage.items.map(mapToBookingDTO), [bookingsPage.items, mapToBookingDTO]);

  const handleEdit = useCallback((booking: BookingDTO) => {
    setEditBooking(booking);
    setIsEditOpen(true);
  }, []);

  const handleEditOpenChange = useCallback((open: boolean) => {
    setIsEditOpen(open);
    if (!open) {
      setEditBooking(null);
    }
  }, []);

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
    <section className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-lg md:text-xl lg:text-2xl font-semibold tracking-tight text-foreground">Manage bookings</h2>
        <p className="text-sm text-muted-foreground">
          Review reservations for {currentRestaurantName}. Adjust details or cancel on behalf of guests.
        </p>
      </header>

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
      />

      <EditBookingDialog
        booking={editBooking}
        open={isEditOpen}
        onOpenChange={handleEditOpenChange}
        mutationHook={useOpsUpdateBooking}
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
    <section className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border/60 bg-muted/20 p-8 text-center">
      <h2 className="text-xl font-semibold text-foreground">No restaurant access yet</h2>
      <p className="text-sm text-muted-foreground">
        Ask an owner or manager to send you an invitation so you can manage bookings.
      </p>
      <Button asChild variant="secondary">
        <Link href="/ops">Back to dashboard</Link>
      </Button>
    </section>
  );
}

function SelectingRestaurantFallback() {
  return (
    <section className="mx-auto flex min-h-[40vh] max-w-2xl flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border/60 bg-muted/20 p-8 text-center">
      <h2 className="text-lg font-semibold text-foreground">Loading restaurant access…</h2>
      <p className="text-sm text-muted-foreground">We’re preparing your bookings. This will only take a moment.</p>
    </section>
  );
}
