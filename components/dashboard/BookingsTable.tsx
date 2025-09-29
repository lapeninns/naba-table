'use client';

import { useMemo } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusChip } from './StatusChip';
import { Pagination } from './Pagination';
import { EmptyState } from './EmptyState';
import type { BookingDTO, BookingStatus, BookingsPage } from '@/hooks/useBookings';
import type { HttpError } from '@/lib/http/errors';

export type StatusFilter = BookingStatus | 'all' | 'active';

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
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'pending', label: 'Pending' },
  { value: 'pending_allocation', label: 'Pending allocation' },
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

  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }), []);
  const timeFormatter = useMemo(() => new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }), []);

  const formatDate = (iso: string) => {
    if (!iso) return '—';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '—';
    return dateFormatter.format(date);
  };

  const formatTime = (iso: string) => {
    if (!iso) return '—';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '—';
    return timeFormatter.format(date);
  };

  const statusChips = useMemo(
    () =>
      STATUS_OPTIONS.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={option.value === statusFilter ? 'default' : 'outline'}
          onClick={() => onStatusFilterChange(option.value)}
          aria-pressed={option.value === statusFilter}
        >
          {option.label}
        </Button>
      )),
    [statusFilter, onStatusFilterChange],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-medium text-base-content">Bookings</h2>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by status">
          {statusChips}
        </div>
      </div>

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

      <div className="overflow-x-auto rounded-xl border border-base-300 bg-base-100">
        <table className="min-w-full divide-y divide-base-300" role="grid">
          <thead className="bg-base-200">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-base-content/70">
                Date
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-base-content/70">
                Time
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-base-content/70">
                Party
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-base-content/70">
                Restaurant
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-base-content/70">
                Status
              </th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-base-content/70">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-base-200">
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
                  <tr key={booking.id} className="align-middle">
                    <td className="px-4 py-4 text-sm text-base-content">{formatDate(booking.startIso)}</td>
                    <td className="px-4 py-4 text-sm text-base-content">{formatTime(booking.startIso)}</td>
                    <td className="px-4 py-4 text-sm text-base-content">{booking.partySize}</td>
                    <td className="px-4 py-4 text-sm text-base-content">{booking.restaurantName}</td>
                    <td className="px-4 py-4 text-sm text-base-content">
                      <StatusChip status={booking.status} />
                    </td>
                    <td className="px-4 py-4 text-right text-sm text-base-content">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-primary"
                          disabled={booking.status === 'cancelled'}
                          onClick={() => onEdit(booking)}
                          aria-disabled={booking.status === 'cancelled'}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-rose-600 hover:text-rose-700"
                          disabled={booking.status === 'cancelled'}
                          onClick={() => onCancel(booking)}
                          aria-disabled={booking.status === 'cancelled'}
                        >
                          Cancel
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>

        {showEmpty ? <EmptyState /> : null}
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
