'use client';

import { useCallback, useMemo } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BookingsHeader } from './BookingsHeader';
import { BookingRow } from './BookingRow';
import { EmptyState } from './EmptyState';
import { Pagination } from './Pagination';
import type { BookingDTO, BookingStatus, BookingsPage } from '@/hooks/useBookings';
import type { StatusFilter } from '@/hooks/useBookingsTableState';
import type { HttpError } from '@/lib/http/errors';

export type BookingsTableProps = {
  bookings: BookingDTO[];
  page: BookingsPage['pageInfo']['page'];
  pageSize: BookingsPage['pageInfo']['pageSize'];
  total: BookingsPage['pageInfo']['total'];
  statusFilter: StatusFilter;
  isLoading: boolean;
  isFetching: boolean;
  error: HttpError | null;
  onStatusFilterChange: (status: StatusFilter) => void;
  onPageChange: (page: number) => void;
  onRetry: () => void;
  onEdit: (booking: BookingDTO) => void;
  onCancel: (booking: BookingDTO) => void;
};

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'all', label: 'All' },
  { value: 'past', label: 'Past' },
  { value: 'cancelled', label: 'Cancelled' },
];

const skeletonRows = Array.from({ length: 5 }, (_, index) => index);

export function BookingsTable({
  bookings,
  page,
  pageSize,
  total,
  statusFilter,
  isLoading,
  isFetching,
  error,
  onStatusFilterChange,
  onPageChange,
  onRetry,
  onEdit,
  onCancel,
}: BookingsTableProps) {
  const showSkeleton = isLoading;
  const showEmpty = !isLoading && !error && bookings.length === 0;

  const emptyState = useMemo(() => {
    switch (statusFilter) {
      case 'upcoming':
        return {
          title: 'No upcoming bookings',
          description: 'Ready for your next night out? Secure a table in just a few taps.',
          analyticsEvent: 'dashboard_empty_upcoming',
        } as const;
      case 'past':
        return {
          title: 'No past visits recorded',
          description: 'Completed or no-show reservations will appear here for your records.',
          analyticsEvent: 'dashboard_empty_past',
        } as const;
      case 'cancelled':
        return {
          title: 'No cancelled bookings',
          description: 'Great news—you haven’t had to cancel any reservations.',
          analyticsEvent: 'dashboard_empty_cancelled',
        } as const;
      default:
        return {
          title: 'No bookings yet',
          description: 'Once you make a reservation, it will appear here. Ready to secure your next table?',
          analyticsEvent: 'dashboard_empty_all',
        } as const;
    }
  }, [statusFilter]);

  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }), []);
  const formatDate = useCallback(
    (iso: string) => {
      if (!iso) return '—';
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return '—';
      return dateFormatter.format(date);
    },
    [dateFormatter],
  );

  const timeFormatter = useMemo(() => new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }), []);
  const formatTime = useCallback(
    (iso: string) => {
      if (!iso) return '—';
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return '—';
      return timeFormatter.format(date);
    },
    [timeFormatter],
  );

  return (
    <div className="space-y-4">
      <BookingsHeader
        statusFilter={statusFilter}
        onStatusFilterChange={onStatusFilterChange}
        statusOptions={STATUS_OPTIONS}
      />

      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Unable to load bookings</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{error.message}</span>
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="min-w-full divide-y divide-border" role="grid">
          <thead className="bg-muted">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Date
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Time
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Party
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Restaurant
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Status
              </th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {showSkeleton
              ? skeletonRows.map((row) => (
                  <tr key={`skeleton-${row}`}>
                    <td className="px-4 py-4"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-4 py-4"><Skeleton className="h-4 w-16" /></td>
                    <td className="px-4 py-4"><Skeleton className="h-4 w-12" /></td>
                    <td className="px-4 py-4"><Skeleton className="h-4 w-40" /></td>
                    <td className="px-4 py-4"><Skeleton className="h-5 w-28" /></td>
                    <td className="px-4 py-4 text-right"><Skeleton className="h-9 w-24 ml-auto" /></td>
                  </tr>
                ))
              : bookings.map((booking) => (
                  <BookingRow
                    key={booking.id}
                    booking={booking}
                    formatDate={formatDate}
                    formatTime={formatTime}
                    onEdit={onEdit}
                    onCancel={onCancel}
                    isPastView={statusFilter === 'past'}
                  />
                ))}
          </tbody>
        </table>

        {showEmpty ? <EmptyState {...emptyState} /> : null}
      </div>

      {total > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          isLoading={isFetching}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}
