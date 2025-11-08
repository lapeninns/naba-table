'use client';

import { useCallback, useMemo } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';


import { BookingRow } from './BookingRow';
import { BookingsHeader } from './BookingsHeader';
import { BookingsListMobile } from './BookingsListMobile';
import { EmptyState, type EmptyStateProps } from './EmptyState';
import { Pagination } from './Pagination';

import type { BookingAction } from '@/components/features/booking-state-machine';
import type { BookingDTO, BookingsPage } from '@/hooks/useBookings';
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
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (status: StatusFilter) => void;
  onPageChange: (page: number) => void;
  onRetry: () => void;
  onEdit: (booking: BookingDTO) => void;
  onCancel: (booking: BookingDTO) => void;
  variant?: 'guest' | 'ops';
  statusOptions?: { value: StatusFilter; label: string }[];
  opsLifecycle?: {
    pendingBookingId: string | null;
    pendingAction: BookingAction | null;
    onCheckIn: (booking: BookingDTO) => Promise<void>;
    onCheckOut: (booking: BookingDTO) => Promise<void>;
    onMarkNoShow: (booking: BookingDTO, options?: { performedAt?: string | null; reason?: string | null }) => Promise<void>;
    onUndoNoShow: (booking: BookingDTO, reason?: string | null) => Promise<void>;
  };
};

const DEFAULT_STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
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
  searchTerm,
  onSearchChange,
  onStatusFilterChange,
  onPageChange,
  onRetry,
  onEdit,
  onCancel,
  variant = 'guest',
  statusOptions,
  opsLifecycle,
}: BookingsTableProps) {
  const showSkeleton = isLoading;
  const showEmpty = !isLoading && !error && bookings.length === 0;
  const isPastView = statusFilter === 'past';
  const trimmedSearch = searchTerm.trim();
  const isOpsVariant = variant === 'ops';

  const emptyState = useMemo(() => {
    if (trimmedSearch) {
      return {
        title: 'No bookings match your search',
        description: 'Try searching for a different guest name or email.',
        analyticsEvent: 'dashboard_empty_search',
      } as const;
    }

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
  }, [statusFilter, trimmedSearch]);

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

  const mobileEmptyState: EmptyStateProps | undefined = emptyState
    ? {
        ...emptyState,
        analyticsEvent: `${emptyState.analyticsEvent ?? 'dashboard_empty_state_viewed'}_mobile`,
      }
    : undefined;

  const desktopEmptyState: EmptyStateProps | undefined = emptyState
    ? {
        ...emptyState,
        analyticsEvent: `${emptyState.analyticsEvent ?? 'dashboard_empty_state_viewed'}_desktop`,
      }
    : undefined;

  return (
    <div className="space-y-4">
      <BookingsHeader
        statusFilter={statusFilter}
        onStatusFilterChange={onStatusFilterChange}
        statusOptions={statusOptions ?? DEFAULT_STATUS_OPTIONS}
        searchTerm={searchTerm}
        onSearchChange={onSearchChange}
        isSearching={isFetching}
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

      <div className="space-y-4">
        <div className="md:hidden">
          <BookingsListMobile
            bookings={bookings}
            isLoading={isLoading}
            formatDate={formatDate}
            formatTime={formatTime}
            onEdit={onEdit}
            onCancel={onCancel}
            emptyState={mobileEmptyState}
            isPastView={isPastView}
            variant={variant}
          />
        </div>

        <div className="hidden md:block">
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
                  {isOpsVariant ? (
                    <>
                      <th
                        scope="col"
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        Customer
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        Notes
                      </th>
                    </>
                  ) : (
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      Restaurant
                    </th>
                  )}
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
                        <td className="px-4 py-4">
                          <Skeleton className="h-4 w-24" />
                        </td>
                        <td className="px-4 py-4">
                          <Skeleton className="h-4 w-16" />
                        </td>
                        <td className="px-4 py-4">
                          <Skeleton className="h-4 w-12" />
                        </td>
                        {isOpsVariant ? (
                          <>
                            <td className="px-4 py-4">
                              <Skeleton className="h-4 w-40" />
                            </td>
                            <td className="px-4 py-4">
                              <Skeleton className="h-4 w-56" />
                            </td>
                          </>
                        ) : (
                          <td className="px-4 py-4">
                            <Skeleton className="h-4 w-40" />
                          </td>
                        )}
                        <td className="px-4 py-4">
                          <Skeleton className="h-5 w-28" />
                        </td>
                        <td className="px-4 py-4 text-right">
                          <Skeleton className="ml-auto h-9 w-24" />
                        </td>
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
                        isPastView={isPastView}
                        variant={variant}
                        opsLifecycle={isOpsVariant ? opsLifecycle : undefined}
                      />
                    ))}
              </tbody>
            </table>
          </div>

          {showEmpty ? <EmptyState {...desktopEmptyState} /> : null}
        </div>
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
