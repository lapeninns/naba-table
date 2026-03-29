'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { OpsBookingCard } from '@/components/features/dashboard/cards/OpsBookingCard';
import { buildOpsBookingCardViewModel } from '@/components/features/dashboard/cards/opsBookingCardUtils';
import { mapOpsDashboardBookingItemToBookingDTO } from '@/utils/ops/mapOpsDashboardBookingItemToBookingDTO';

import type { DashboardBookingActionHandlers } from '../types';
import type { OpsTodayBooking, OpsTodayBookingsSummary } from '@/types/ops';

export type BookingsListVirtualizedProps = {
  sorted: OpsTodayBooking[];
  summary: OpsTodayBookingsSummary;
  nowDate: Date;
  restaurantSlug?: string | null;
  bookingActions: DashboardBookingActionHandlers;
};

export function BookingsListVirtualized({
  sorted,
  summary,
  nowDate,
  restaurantSlug,
  bookingActions,
}: BookingsListVirtualizedProps) {
  const VIRTUALIZE_MIN_ITEMS = 20;
  const ROW_GAP = 12;
  const ROW_ESTIMATE = 140 + ROW_GAP;
  const prefersReducedMotion = useReducedMotion();
  const hasAnimatedRef = useRef(false);
  const parentRef = useRef<HTMLDivElement | null>(null);

  const shouldVirtualize = sorted.length >= VIRTUALIZE_MIN_ITEMS;
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual manages internal refs safely for virtualization.
  const rowVirtualizer = useVirtualizer({
    count: shouldVirtualize ? sorted.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_ESTIMATE,
    overscan: 6,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();

  const shouldAnimate = !prefersReducedMotion && !hasAnimatedRef.current && sorted.length > 0;

  useEffect(() => {
    if (sorted.length > 0) {
      hasAnimatedRef.current = true;
    }
  }, [sorted.length]);

  const bookingViewModels = useMemo(
    () =>
      sorted.map((booking) => {
        const bookingDTO = mapOpsDashboardBookingItemToBookingDTO(booking, {
          restaurantId: summary.restaurantId,
          restaurantName: 'Restaurant',
          restaurantSlug: restaurantSlug ?? null,
          restaurantTimezone: summary.timezone,
          summaryDate: summary.date,
        });
        const pendingAction =
          bookingActions.pendingLifecycleAction?.bookingId === booking.id
            ? bookingActions.pendingLifecycleAction.action
            : null;
        return buildOpsBookingCardViewModel({
          booking: bookingDTO,
          timezone: summary.timezone,
          now: nowDate,
          pendingAction,
          actionsDisabled: pendingAction !== null,
          highlightUrgency: Boolean(booking.startTime),
          timeLabelOverride: booking.startTime ? null : 'Time TBD',
        });
      }),
    [
      bookingActions.pendingLifecycleAction?.action,
      bookingActions.pendingLifecycleAction?.bookingId,
      nowDate,
      restaurantSlug,
      sorted,
      summary,
    ],
  );

  const renderCard = useCallback(
    (viewModel: (typeof bookingViewModels)[number]) => {
      return (
        <OpsBookingCard
          viewModel={viewModel}
          onCheckIn={bookingActions.onCheckIn}
          onCheckOut={bookingActions.onCheckOut}
          onMarkNoShow={bookingActions.onMarkNoShow}
          onDetails={bookingActions.onDetails}
          onEdit={bookingActions.onEdit}
          onCancel={bookingActions.onCancel}
        />
      );
    },
    [
      bookingActions.onCancel,
      bookingActions.onCheckIn,
      bookingActions.onCheckOut,
      bookingActions.onDetails,
      bookingActions.onEdit,
      bookingActions.onMarkNoShow,
    ],
  );

  if (!shouldVirtualize) {
    return (
      <motion.div
        className="space-y-3 sm:space-y-4"
        initial={shouldAnimate ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={shouldAnimate ? { duration: 0.2, ease: 'easeOut' } : undefined}
      >
        {bookingViewModels.map((viewModel) => (
          <div key={viewModel.booking.id}>{renderCard(viewModel)}</div>
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
            const viewModel = bookingViewModels[virtualRow.index];
            if (!viewModel) return null;

            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                className="absolute left-0 top-0 w-full pb-3 will-change-transform sm:pb-4"
                style={{ transform: `translate3d(0, ${virtualRow.start}px, 0)` }}
              >
                {renderCard(viewModel)}
              </div>
            );
          })}
        </div>
      </section>
    </motion.div>
  );
}
