'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { motion, useReducedMotion } from 'motion/react';
import { memo, useEffect, useMemo, useRef } from 'react';

import { OpsBookingCard } from '@/components/features/dashboard/cards/OpsBookingCard';
import { buildOpsBookingCardViewModel } from '@/components/features/dashboard/cards/opsBookingCardUtils';
import { mapOpsDashboardBookingItemToBookingDTO } from '@/utils/ops/mapOpsDashboardBookingItemToBookingDTO';

import { getDashboardPerfStart, recordDashboardPerfMetric } from './performance';

import type { DashboardBookingActionHandlers } from '../types';
import type { DashboardPendingLifecycleAction } from '../types';
import type { OpsTodayBooking, OpsTodayBookingsSummary } from '@/types/ops';

const VIRTUALIZE_MIN_ITEMS = 24;
const ROW_GAP = 12;
const ROW_ESTIMATE = 140 + ROW_GAP;
const VIRTUALIZED_OVERSCAN = 5;

export type BookingsListVirtualizedProps = {
  sorted: OpsTodayBooking[];
  summary: OpsTodayBookingsSummary;
  nowDate: Date;
  restaurantSlug?: string | null;
  bookingActions: DashboardBookingActionHandlers;
};

export const BookingsListVirtualized = memo(function BookingsListVirtualized({
  sorted,
  summary,
  nowDate,
  restaurantSlug,
  bookingActions,
}: BookingsListVirtualizedProps) {
  const prefersReducedMotion = useReducedMotion();
  const hasAnimatedRef = useRef(false);
  const parentRef = useRef<HTMLDivElement | null>(null);
  const renderStartedAtRef = useRef(getDashboardPerfStart());
  renderStartedAtRef.current = getDashboardPerfStart();

  const shouldVirtualize = sorted.length >= VIRTUALIZE_MIN_ITEMS;
  const rowVirtualizer = useVirtualizer({
    count: shouldVirtualize ? sorted.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_ESTIMATE,
    overscan: VIRTUALIZED_OVERSCAN,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();

  const shouldAnimate = !prefersReducedMotion && !hasAnimatedRef.current && sorted.length > 0;

  useEffect(() => {
    if (sorted.length > 0) {
      hasAnimatedRef.current = true;
    }
  }, [sorted.length]);

  useEffect(() => {
    recordDashboardPerfMetric('ops-dashboard.list.commit', renderStartedAtRef.current, {
      totalCount: sorted.length,
      visibleCount: shouldVirtualize ? virtualRows.length : sorted.length,
      virtualized: shouldVirtualize,
    });
  });

  // Warm the booking-dialog code chunks on first idle so that the first card
  // click does not pay a JS compile/parse penalty (~3.6 s observed in dev).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ric: (cb: () => void) => number =
      (window as Window & { requestIdleCallback?: (cb: () => void) => number })
        .requestIdleCallback ?? ((cb) => window.setTimeout(cb, 1000));
    const cic: (id: number) => void =
      (window as Window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback ??
      ((id) => window.clearTimeout(id));
    const id = ric(() => {
      void import('@/components/features/bookings/BookingDetailsDialogWrapper');
      void import('@/components/features/dashboard/booking-details/components/TableAssignmentPanel');
    });
    return () => cic(id);
  }, []);

  if (!shouldVirtualize) {
    return (
      <motion.div
        className="space-y-3 sm:space-y-4"
        initial={shouldAnimate ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={shouldAnimate ? { duration: 0.2, ease: 'easeOut' } : undefined}
      >
        {sorted.map((booking) => (
          <div key={booking.id}>
            <BookingsListRow
              booking={booking}
              nowDate={nowDate}
              restaurantId={summary.restaurantId}
              restaurantSlug={restaurantSlug}
              summaryDate={summary.date}
              timezone={summary.timezone}
              pendingLifecycleAction={bookingActions.pendingLifecycleActions?.[booking.id] ?? null}
              onCheckIn={bookingActions.onCheckIn}
              onCheckOut={bookingActions.onCheckOut}
              onMarkNoShow={bookingActions.onMarkNoShow}
              onDetails={bookingActions.onDetails}
              onEdit={bookingActions.onEdit}
              onCancel={bookingActions.onCancel}
            />
          </div>
        ))}
      </motion.div>
    );
  }

  return (
    <motion.div
      className="relative"
      initial={shouldAnimate ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      transition={shouldAnimate ? { duration: 0.2, ease: 'easeOut' } : undefined}
    >
      <section
        ref={parentRef}
        className="max-h-[70vh] overflow-y-auto pr-1"
        aria-label="Bookings list"
      >
        <div className="relative" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
          {virtualRows.map((virtualRow) => {
            const booking = sorted[virtualRow.index];
            if (!booking) return null;

            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                className="absolute left-0 top-0 w-full pb-3 will-change-transform sm:pb-4"
                style={{ transform: `translate3d(0, ${virtualRow.start}px, 0)` }}
              >
                <BookingsListRow
                  booking={booking}
                  nowDate={nowDate}
                  restaurantId={summary.restaurantId}
                  restaurantSlug={restaurantSlug}
                  summaryDate={summary.date}
                  timezone={summary.timezone}
                  pendingLifecycleAction={bookingActions.pendingLifecycleActions?.[booking.id] ?? null}
                  onCheckIn={bookingActions.onCheckIn}
                  onCheckOut={bookingActions.onCheckOut}
                  onMarkNoShow={bookingActions.onMarkNoShow}
                  onDetails={bookingActions.onDetails}
                  onEdit={bookingActions.onEdit}
                  onCancel={bookingActions.onCancel}
                />
              </div>
            );
          })}
        </div>
      </section>
    </motion.div>
  );
});

BookingsListVirtualized.displayName = 'BookingsListVirtualized';

type BookingsListRowProps = {
  booking: OpsTodayBooking;
  nowDate: Date;
  restaurantId: string;
  restaurantSlug?: string | null;
  summaryDate: string;
  timezone: string;
  pendingLifecycleAction?: DashboardPendingLifecycleAction;
  onEdit?: (bookingId: string) => void;
  onCancel?: (bookingId: string) => void;
  onDetails?: (bookingId: string) => void;
  onCheckIn?: (bookingId: string) => Promise<void>;
  onCheckOut?: (bookingId: string) => Promise<void>;
  onMarkNoShow?: (
    bookingId: string,
    options?: { performedAt?: string | null; reason?: string | null },
  ) => Promise<void>;
};

const BookingsListRow = memo(function BookingsListRow({
  booking,
  nowDate,
  restaurantId,
  restaurantSlug,
  summaryDate,
  timezone,
  pendingLifecycleAction,
  onCheckIn,
  onCheckOut,
  onMarkNoShow,
  onDetails,
  onEdit,
  onCancel,
}: BookingsListRowProps) {
  const viewModel = useMemo(() => {
    const startedAt = getDashboardPerfStart();
    const bookingDTO = mapOpsDashboardBookingItemToBookingDTO(booking, {
      restaurantId,
      restaurantName: 'Restaurant',
      restaurantSlug: restaurantSlug ?? null,
      restaurantTimezone: timezone,
      summaryDate,
    });
    const pendingAction =
      pendingLifecycleAction?.bookingId === booking.id ? pendingLifecycleAction.action : null;
    const result = buildOpsBookingCardViewModel({
      booking: bookingDTO,
      timezone,
      now: nowDate,
      pendingAction,
      actionsDisabled: pendingAction !== null,
      highlightUrgency: Boolean(booking.startTime),
      timeLabelOverride: booking.startTime ? null : 'Time TBD',
    });
    recordDashboardPerfMetric('ops-dashboard.list.row-view-model', startedAt, {
      bookingId: booking.id,
      pending: Boolean(pendingAction),
    });
    return result;
  }, [
    booking,
    nowDate,
    pendingLifecycleAction,
    restaurantId,
    restaurantSlug,
    summaryDate,
    timezone,
  ]);

  return (
    <OpsBookingCard
      viewModel={viewModel}
      onCheckIn={onCheckIn}
      onCheckOut={onCheckOut}
      onMarkNoShow={onMarkNoShow}
      onDetails={onDetails}
      onEdit={onEdit}
      onCancel={onCancel}
    />
  );
});

BookingsListRow.displayName = 'BookingsListRow';
