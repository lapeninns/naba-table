'use client';

import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { Loader2 } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { OpsBookingCard } from '@/components/features/dashboard/cards/OpsBookingCard';
import { OpsBookingCardSkeleton } from '@/components/features/dashboard/cards/OpsBookingCardSkeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

import { BookingsHeader } from './BookingsHeader';
import { EmptyState, type EmptyStateProps } from './EmptyState';

import type { BookingAction } from '@/components/features/booking-state-machine';
import type { BookingDTO, BookingsPage } from '@/hooks/useBookings';
import type { StatusFilter } from '@/hooks/useBookingsTableState';
import type { HttpError } from '@/lib/http/errors';

export type BookingsTableProps = {
  bookings: BookingDTO[];
  total: BookingsPage['pageInfo']['total'];
  statusFilter: StatusFilter;
  isLoading: boolean;
  isFetching: boolean;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  error: HttpError | null;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (status: StatusFilter) => void;
  onLoadMore?: () => void;
  onRetry: () => void;
  onEdit?: (booking: BookingDTO) => void;
  onCancel?: (booking: BookingDTO) => void;
  onDetails?: (booking: BookingDTO) => void;
  variant?: 'guest' | 'ops';
  statusOptions?: { value: StatusFilter; label: string }[];
  opsActionMode?: 'full' | 'details-only';
  opsLifecycle?: {
    pendingActionsByBookingId: Record<string, BookingAction | null>;
    onCheckIn: (bookingId: string) => Promise<void>;
    onCheckOut: (bookingId: string) => Promise<void>;
    onMarkNoShow: (bookingId: string, options?: { performedAt?: string | null; reason?: string | null }) => Promise<void>;
    onUndoNoShow: (bookingId: string, reason?: string | null) => Promise<void>;
  };
  showHeaderTitle?: boolean;
  hideHeader?: boolean;
  timezone?: string;
  /**
   * Ops routes can be served at `/bookings` (app subdomain) or `/app/bookings` (single-host mode).
   * Pass `/app` in single-host mode so empty-state CTAs navigate correctly.
   */
  opsBasePath?: string;
};

const DEFAULT_STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'recent', label: 'Recent' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'all', label: 'All' },
  { value: 'past', label: 'Past' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function BookingsTable({
  bookings,
  total,
  statusFilter,
  isLoading,
  isFetching,
  isFetchingNextPage = false,
  hasNextPage = false,
  error,
  searchTerm,
  onSearchChange,
  onStatusFilterChange,
  onLoadMore,
  onRetry,
  onEdit,
  onCancel,
  onDetails,
  variant = 'guest',
  statusOptions,
  opsActionMode: _opsActionMode = 'full',
  opsLifecycle,
  showHeaderTitle = true,
  hideHeader = false,
  timezone,
  opsBasePath = '',
}: BookingsTableProps) {
  const VIRTUALIZE_MIN_ITEMS = 20;
  const hasBookings = bookings.length > 0;
  const showSkeleton = isLoading && !hasBookings;
  const showUpdating = isFetching && !showSkeleton && !error;
  const showEmpty = !showSkeleton && !error && bookings.length === 0;
  const trimmedSearch = searchTerm.trim();
  const isOpsVariant = variant === 'ops';
  const prefersReducedMotion = useReducedMotion();
  const hasAnimatedRef = useRef(false);
  const measureFrameRef = useRef<number | null>(null);

  const emptyState = useMemo(() => {
    const opsPath = (path: string) => `${opsBasePath}${path}`;

    if (trimmedSearch) {
      return {
        title: isOpsVariant ? 'No bookings match your search' : 'No bookings match your search',
        description: isOpsVariant
          ? 'Try a different guest name or email, or broaden the date/status filters.'
          : 'Try searching for a different guest name or email.',
        ctaHref: isOpsVariant ? opsPath('/new-bookings') : '/',
        ctaLabel: isOpsVariant ? 'New booking' : 'Start a new booking',
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
          ctaHref: isOpsVariant ? opsPath('/new-bookings') : '/',
          ctaLabel: isOpsVariant ? 'New booking' : 'Start a new booking',
          analyticsEvent: 'dashboard_empty_upcoming',
        } as const;
      case 'past':
        return {
          title: isOpsVariant ? 'No past service records' : 'No past visits recorded',
          description: isOpsVariant
            ? 'Completed and no-show reservations will appear here once they’re processed.'
            : 'Completed or no-show reservations will appear here for your records.',
          ctaHref: isOpsVariant ? opsPath('/bookings') : '/',
          ctaLabel: isOpsVariant ? 'View today' : 'Start a new booking',
          analyticsEvent: 'dashboard_empty_past',
        } as const;
      case 'cancelled':
        return {
          title: isOpsVariant ? 'No cancelled bookings' : 'No cancelled bookings',
          description: isOpsVariant
            ? 'Cancelled reservations will show up here so your team can track changes.'
            : 'Great news—you haven’t had to cancel any reservations.',
          ctaHref: isOpsVariant ? opsPath('/bookings') : '/',
          ctaLabel: isOpsVariant ? 'View all bookings' : 'Start a new booking',
          analyticsEvent: 'dashboard_empty_cancelled',
        } as const;
      default:
        // This default case should ideally not be reached if 'all' is handled explicitly
        // and other filters are exhaustive. Keeping it as a fallback.
        return {
          title: isOpsVariant ? 'No bookings yet' : 'No bookings yet',
          description: isOpsVariant
            ? 'Reservations and walk-ins for this restaurant will appear here as they’re created.'
            : 'Once you make a reservation, it will appear here. Ready to secure your next table?',
          ctaHref: isOpsVariant ? opsPath('/new-bookings') : '/',
          ctaLabel: isOpsVariant ? 'New booking' : 'Start a new booking',
          analyticsEvent: 'dashboard_empty_all',
        } as const;
    }
  }, [isOpsVariant, opsBasePath, statusFilter, trimmedSearch]);

  const totalLabel =
    typeof total === 'number'
      ? `${total} booking${total === 1 ? '' : 's'}`
      : `${bookings.length} booking${bookings.length === 1 ? '' : 's'}`;

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

  const rowMeasureCacheRef = useRef(new Map<string, number>());
  const rowStatusCacheRef = useRef(new Map<string, BookingDTO['status']>());
  const totalItems = hasNextPage ? bookings.length + 1 : bookings.length;
  const shouldVirtualize = bookings.length >= VIRTUALIZE_MIN_ITEMS || hasNextPage;
  const rowVirtualizer = useWindowVirtualizer({
    count: shouldVirtualize ? totalItems : 0,
    estimateSize: (index) => {
      if (index >= bookings.length) {
        return 72;
      }
      const id = bookings[index]?.id;
      if (!id) return 140;
      return rowMeasureCacheRef.current.get(id) ?? 140;
    },
    overscan: 6,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();

  const scheduleMeasure = useCallback(() => {
    if (!shouldVirtualize || measureFrameRef.current !== null) return;
    measureFrameRef.current = requestAnimationFrame(() => {
      measureFrameRef.current = null;
      rowVirtualizer.measure();
    });
  }, [rowVirtualizer, shouldVirtualize]);

  useEffect(() => {
    return () => {
      if (measureFrameRef.current !== null) {
        cancelAnimationFrame(measureFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!shouldVirtualize) return;
    const statusCache = rowStatusCacheRef.current;
    const measureCache = rowMeasureCacheRef.current;
    const seen = new Set<string>();
    let invalidated = false;

    for (const booking of bookings) {
      seen.add(booking.id);
      const previousStatus = statusCache.get(booking.id);
      if (previousStatus && previousStatus !== booking.status) {
        measureCache.delete(booking.id);
        invalidated = true;
      }
      statusCache.set(booking.id, booking.status);
    }

    for (const id of statusCache.keys()) {
      if (!seen.has(id)) {
        statusCache.delete(id);
        measureCache.delete(id);
        invalidated = true;
      }
    }

    if (invalidated) {
      scheduleMeasure();
    }
  }, [bookings, scheduleMeasure, shouldVirtualize]);

  const shouldAnimate = !prefersReducedMotion && !hasAnimatedRef.current && bookings.length > 0;

  useEffect(() => {
    if (bookings.length > 0) {
      hasAnimatedRef.current = true;
    }
  }, [bookings.length]);

  useEffect(() => {
    if (!shouldVirtualize) return;
    if (!onLoadMore || !hasNextPage || isFetchingNextPage) {
      return;
    }
    if (bookings.length === 0) return;
    const lastItem = virtualRows[virtualRows.length - 1];
    if (!lastItem) return;
    if (lastItem.index >= bookings.length - 1) {
      onLoadMore();
    }
  }, [bookings.length, hasNextPage, isFetchingNextPage, onLoadMore, shouldVirtualize, virtualRows]);

  return (
    <div
      id={isOpsVariant ? 'ops-bookings-list' : undefined}
      tabIndex={isOpsVariant ? -1 : undefined}
      role={isOpsVariant ? 'region' : undefined}
      aria-label={isOpsVariant ? 'Bookings list' : undefined}
      className="space-y-3"
    >
      {/* Screen reader summary for list changes (filters/search/pagination). */}
      {isOpsVariant ? (
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          Showing {totalLabel}.
        </div>
      ) : null}
      {!hideHeader && (
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
      )}

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

      {showUpdating ? (
        <div
          className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Updating bookings...
        </div>
      ) : null}

      <div className="space-y-3">
        {showSkeleton ? (
          <>
            <div className="grid grid-cols-1 gap-3 md:hidden">
              {Array.from({ length: 3 }).map((_, i) => (
                <OpsBookingCardSkeleton key={i} />
              ))}
            </div>
            <div className="hidden grid-cols-1 gap-3 md:grid">
              {Array.from({ length: 5 }).map((_, i) => (
                <OpsBookingCardSkeleton key={i} />
              ))}
            </div>
          </>
        ) : showEmpty ? (
          <>
            <div className="md:hidden">
              <EmptyState {...mobileEmptyState} />
            </div>
            <div className="hidden md:block">
              <EmptyState {...desktopEmptyState} />
            </div>
          </>
        ) : shouldVirtualize ? (
          <motion.div
            className="relative"
            initial={shouldAnimate ? { opacity: 0 } : false}
            animate={{ opacity: 1 }}
            transition={shouldAnimate ? { duration: 0.2, ease: 'easeOut' } : undefined}
          >
            <div className="relative" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
              {virtualRows.map((virtualRow) => {
                if (virtualRow.index >= bookings.length) {
                  return (
                    <div
                      key={virtualRow.key}
                      data-index={virtualRow.index}
                      ref={rowVirtualizer.measureElement}
                      className="absolute left-0 top-0 w-full"
                      style={{ transform: `translateY(${virtualRow.start}px)` }}
                    >
                      <div className="flex items-center justify-center gap-2 py-3 text-xs font-medium text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        Loading more bookings...
                      </div>
                    </div>
                  );
                }

                const booking = bookings[virtualRow.index];
                if (!booking) return null;

                const pendingAction =
                  opsLifecycle?.pendingActionsByBookingId?.[booking.id] ?? null;

                return (
                  <div
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    data-booking-id={booking.id}
                    ref={(node) => {
                      rowVirtualizer.measureElement(node);
                      if (node) {
                        const height = node.getBoundingClientRect().height;
                        const cached = rowMeasureCacheRef.current.get(booking.id);
                        if (!cached || Math.abs(cached - height) > 1) {
                          rowMeasureCacheRef.current.set(booking.id, height);
                        }
                      }
                    }}
                    className="absolute left-0 top-0 w-full pb-3 will-change-transform"
                    style={{ transform: `translate3d(0, ${virtualRow.start}px, 0)` }}
                  >
                    <OpsBookingCard
                      booking={booking}
                      timezone={timezone || 'UTC'}
                      onEdit={onEdit}
                      onCancel={onCancel}
                      onDetails={onDetails}
                      onCheckIn={opsLifecycle?.onCheckIn}
                      onCheckOut={opsLifecycle?.onCheckOut}
                      onMarkNoShow={opsLifecycle?.onMarkNoShow}
                      onUndoNoShow={opsLifecycle?.onUndoNoShow}
                      pendingAction={pendingAction}
                      actionsDisabled={false}
                      allowTableAssignments={true}
                    />
                  </div>
                );
              })}
            </div>
          </motion.div>
        ) : (
          <motion.div
            className="space-y-3"
            initial={shouldAnimate ? { opacity: 0 } : false}
            animate={{ opacity: 1 }}
            transition={shouldAnimate ? { duration: 0.2, ease: 'easeOut' } : undefined}
          >
            {bookings.map((booking) => {
              const pendingAction =
                opsLifecycle?.pendingActionsByBookingId?.[booking.id] ?? null;
              return (
                <div
                  key={booking.id}
                  data-booking-id={booking.id}
                  className="pb-3"
                >
                  <OpsBookingCard
                    booking={booking}
                    timezone={timezone || 'UTC'}
                    onEdit={onEdit}
                    onCancel={onCancel}
                    onDetails={onDetails}
                    onCheckIn={opsLifecycle?.onCheckIn}
                    onCheckOut={opsLifecycle?.onCheckOut}
                    onMarkNoShow={opsLifecycle?.onMarkNoShow}
                    onUndoNoShow={opsLifecycle?.onUndoNoShow}
                    pendingAction={pendingAction}
                    actionsDisabled={false}
                    allowTableAssignments={true}
                  />
                </div>
              );
            })}
          </motion.div>
        )}
      </div>
    </div>
  );
}
