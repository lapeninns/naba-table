'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import { BookingsTable } from '@/components/dashboard/BookingsTable';
import { DASHBOARD_DEFAULT_PAGE_SIZE } from '@/components/dashboard/constants';
import { CancelBookingDialog } from '@/components/dashboard/CancelBookingDialog';
import { EditBookingDialog } from '@/components/dashboard/EditBookingDialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { BookingDTO } from '@/hooks/useBookings';
import { useBookingsTableState } from '@/hooks/useBookingsTableState';
import { useOpsBookings } from '@/hooks/useOpsBookings';
import { useOpsCancelBooking } from '@/hooks/useOpsCancelBooking';
import { useOpsUpdateBooking } from '@/hooks/useOpsUpdateBooking';

export type OpsRestaurantOption = {
  id: string;
  name: string;
};

type OpsBookingsClientProps = {
  restaurants: OpsRestaurantOption[];
  defaultRestaurantId: string | null;
};

export function OpsBookingsClient({ restaurants, defaultRestaurantId }: OpsBookingsClientProps) {
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(defaultRestaurantId);

  useEffect(() => {
    if (!selectedRestaurantId && restaurants.length > 0) {
      setSelectedRestaurantId(restaurants[0]?.id ?? null);
    }
  }, [restaurants, selectedRestaurantId]);

  const tableState = useBookingsTableState({ pageSize: DASHBOARD_DEFAULT_PAGE_SIZE });
  const { statusFilter, page, pageSize, queryFilters, handleStatusFilterChange } = tableState;

  const filters = useMemo(() => {
    if (!selectedRestaurantId) return null;
    return {
      restaurantId: selectedRestaurantId,
      ...queryFilters,
    };
  }, [queryFilters, selectedRestaurantId]);

  const { data, error, isLoading, isFetching, refetch } = useOpsBookings(
    filters ?? {
      restaurantId: selectedRestaurantId ?? '',
      page,
      pageSize,
    },
  );

  const [editBooking, setEditBooking] = useState<BookingDTO | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [cancelBooking, setCancelBooking] = useState<BookingDTO | null>(null);
  const [isCancelOpen, setIsCancelOpen] = useState(false);

  const handlePageChange = useCallback(
    (nextPage: number) => {
      const total = data?.pageInfo.total ?? 0;
      tableState.handlePageChange(nextPage, total);
    },
    [data?.pageInfo.total, tableState],
  );

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

  const pageInfo = data?.pageInfo ?? {
    page,
    pageSize,
    total: 0,
    hasNext: false,
  };

  const currentRestaurantName =
    restaurants.find((restaurant) => restaurant.id === selectedRestaurantId)?.name ?? 'This restaurant';

  if (!selectedRestaurantId) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border/60 bg-muted/20 p-8 text-center">
        <h2 className="text-xl font-semibold text-foreground">No restaurant selected</h2>
        <p className="text-sm text-muted-foreground">Your account doesn’t have access to any restaurants yet.</p>
        <Button asChild variant="secondary">
          <Link href="/ops">Back to dashboard</Link>
        </Button>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Manage bookings</h2>
        <p className="text-sm text-muted-foreground">
          Review reservations for {currentRestaurantName}. Adjust details or cancel on behalf of guests.
        </p>
      </div>

      {restaurants.length > 1 ? (
        <div className="w-full max-w-xs space-y-2">
          <Label htmlFor="ops-bookings-restaurant" className="text-sm font-medium text-foreground">
            Restaurant
          </Label>
          <select
            id="ops-bookings-restaurant"
            value={selectedRestaurantId ?? ''}
            onChange={(event) => setSelectedRestaurantId(event.target.value)}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {restaurants.map((restaurant) => (
              <option key={restaurant.id} value={restaurant.id}>
                {restaurant.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <BookingsTable
        bookings={data?.items ?? []}
        page={pageInfo.page}
        pageSize={pageInfo.pageSize}
        total={pageInfo.total}
        statusFilter={statusFilter}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error ?? null}
        onStatusFilterChange={handleStatusFilterChange}
        onPageChange={handlePageChange}
        onRetry={refetch}
        onEdit={handleEdit}
        onCancel={handleCancel}
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
