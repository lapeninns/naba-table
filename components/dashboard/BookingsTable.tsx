'use client';

import { useCallback, useMemo } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { OpsBookingCard } from './OpsBookingCard';
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
  onEdit?: (booking: BookingDTO) => void;
  onCancel?: (booking: BookingDTO) => void;
  onDetails?: (booking: BookingDTO) => void;
  variant?: 'guest' | 'ops';
  statusOptions?: { value: StatusFilter; label: string }[];
  opsActionMode?: 'full' | 'details-only';
  opsLifecycle?: {
    pendingBookingId: string | null;
    pendingAction: BookingAction | null;
    onCheckIn: (booking: BookingDTO) => Promise<void>;
    onCheckOut: (booking: BookingDTO) => Promise<void>;
    onMarkNoShow: (booking: BookingDTO, options?: { performedAt?: string | null; reason?: string | null }) => Promise<void>;
    onUndoNoShow: (booking: BookingDTO, reason?: string | null) => Promise<void>;
  };
  showHeaderTitle?: boolean;
  timezone?: string;
};

const DEFAULT_STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'recent', label: 'Recent' },
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
  onDetails,
  variant = 'guest',
  statusOptions,
  opsActionMode = 'full',
  opsLifecycle,
  showHeaderTitle = true,
  timezone,
}: BookingsTableProps) {
  const showSkeleton = isLoading;
  const showEmpty = !isLoading && !error && bookings.length === 0;
  const isPastView = statusFilter === 'past';
  const trimmedSearch = searchTerm.trim();
  const isOpsVariant = variant === 'ops';

  const emptyState = useMemo(() => {
    if (trimmedSearch) {
      return {
        title: isOpsVariant ? 'No bookings match your search' : 'No bookings match your search',
        description: isOpsVariant
          ? 'Try a different guest name or email, or broaden the date/status filters.'
          : 'Try searching for a different guest name or email.',
        ctaHref: isOpsVariant ? '/walk-in' : '/',
        ctaLabel: isOpsVariant ? 'Log a walk-in' : 'Start a new booking',
        analyticsEvent: 'dashboard_empty_search',
      } as const;
    }

    switch (statusFilter) {
      case 'upcoming':
        return {
          title: isOpsVariant ? 'No upcoming bookings' : 'No upcoming bookings',
          description: isOpsVariant
            ? 'New reservations will appear here as they’re created. You can also log walk-ins for today’s service.'
            : 'Ready for your next night out? Secure a table in just a few taps.',
          ctaHref: isOpsVariant ? '/walk-in' : '/',
          ctaLabel: isOpsVariant ? 'Log a walk-in' : 'Start a new booking',
          analyticsEvent: 'dashboard_empty_upcoming',
        } as const;
      case 'past':
        return {
          title: isOpsVariant ? 'No past service records' : 'No past visits recorded',
          description: isOpsVariant
            ? 'Completed and no-show reservations will appear here once they’re processed.'
            : 'Completed or no-show reservations will appear here for your records.',
          ctaHref: isOpsVariant ? '/bookings' : '/',
          ctaLabel: isOpsVariant ? 'View today' : 'Start a new booking',
          analyticsEvent: 'dashboard_empty_past',
        } as const;
      case 'cancelled':
        return {
          title: isOpsVariant ? 'No cancelled bookings' : 'No cancelled bookings',
          description: isOpsVariant
            ? 'Cancelled reservations will show up here so your team can track changes.'
            : 'Great news—you haven’t had to cancel any reservations.',
          ctaHref: isOpsVariant ? '/bookings' : '/',
          ctaLabel: isOpsVariant ? 'View all bookings' : 'Start a new booking',
          analyticsEvent: 'dashboard_empty_cancelled',
        } as const;
      default:
        return {
          title: isOpsVariant ? 'No bookings yet' : 'No bookings yet',
          description: isOpsVariant
            ? 'Reservations and walk-ins for this restaurant will appear here as they’re created.'
            : 'Once you make a reservation, it will appear here. Ready to secure your next table?',
          ctaHref: isOpsVariant ? '/walk-in' : '/',
          ctaLabel: isOpsVariant ? 'Log a walk-in' : 'Start a new booking',
          analyticsEvent: 'dashboard_empty_all',
        } as const;
    }
  }, [isOpsVariant, statusFilter, trimmedSearch]);

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
    <div className="space-y-3">
      <BookingsHeader
        title={isOpsVariant ? 'Booking queue' : 'Bookings'}
        subtitle={isOpsVariant ? 'Search, filter, and paginate without losing your place.' : undefined}
        total={total}
        showTitle={showHeaderTitle}
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

      <div className="space-y-3">
        {/* Mobile View */}
        <div className="md:hidden">
          <BookingsListMobile
            bookings={bookings}
            isLoading={isLoading}
            formatDate={formatDate}
            formatTime={formatTime}
            onEdit={onEdit}
            onCancel={onCancel}
            onDetails={onDetails}
            opsActionMode={opsActionMode}
            emptyState={mobileEmptyState}
            isPastView={isPastView}
            variant={variant}
          />
        </div>

        {/* Desktop View - Now using List of Cards */}
        <div className="hidden md:block space-y-3">
          {showSkeleton
            ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-24 w-full rounded-xl border border-border bg-card/50 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-12 w-20 rounded-md" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                  <Skeleton className="h-9 w-24 rounded-md" />
                </div>
              </div>
            ))
            : bookings.map((booking) => (
              <div key={booking.id} className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <OpsBookingCard
                  booking={booking}
                  // Default to UTC if not provided (should be provided by parent)
                  timezone={timezone || 'UTC'}
                  onEdit={onEdit}
                  onCancel={onCancel}
                  onDetails={onDetails}
                  onCheckIn={opsLifecycle ? (id: string) => opsLifecycle.onCheckIn(booking) : undefined}
                  onCheckOut={opsLifecycle ? (id: string) => opsLifecycle.onCheckOut(booking) : undefined}
                  onMarkNoShow={opsLifecycle ? (id: string) => opsLifecycle.onMarkNoShow(booking) : undefined}
                  onUndoNoShow={opsLifecycle ? (id: string) => opsLifecycle.onUndoNoShow(booking) : undefined}
                  pendingAction={
                    opsLifecycle?.pendingBookingId === booking.id
                      ? (opsLifecycle.pendingAction as any)
                      : null
                  }
                  allowTableAssignments={true}
                />
              </div>
            ))}
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
