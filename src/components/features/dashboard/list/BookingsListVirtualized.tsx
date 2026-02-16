'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { OpsBookingCard } from '@/components/features/dashboard/cards/OpsBookingCard';
import { useBookingRealtime } from '@/hooks/ops/useBookingRealtime';
import { isTableAssignmentStatusAllowed } from '@/lib/ops/table-assignment-policy';
import { getOpsBookingTemporalInfo } from '@/utils/ops/todayBookingsAttention';

import { toIsoTime } from './utils';

import type { BookingDTO } from '@/hooks/useBookings';
import type { OpsTodayBooking, OpsTodayBookingsSummary } from '@/types/ops';
import type { DateTime } from 'luxon';

export type BookingsListVirtualizedProps = {
  bookings: OpsTodayBooking[];
  sorted: OpsTodayBooking[];
  summary: OpsTodayBookingsSummary;
  now: DateTime<boolean>;
  nowDate: Date;
  allowTableAssignments: boolean;
  restaurantSlug?: string | null;
  isRefetching: boolean;
  onDetails?: (booking: BookingDTO) => void;
  onEdit?: (booking: BookingDTO) => void;
  onCancel?: (booking: BookingDTO) => void;
  onMarkNoShow: (
    bookingId: string,
    options?: { performedAt?: string | null; reason?: string | null },
  ) => Promise<void>;
  onUndoNoShow: (bookingId: string, reason?: string | null) => Promise<void>;
  onCheckIn: (bookingId: string) => Promise<void>;
  onCheckOut: (bookingId: string) => Promise<void>;
  pendingLifecycleAction?: {
    bookingId: string | null;
    action: 'check-in' | 'check-out' | 'no-show' | 'undo-no-show';
    snapshot?: Pick<OpsTodayBooking, 'status' | 'startTime' | 'endTime'> | null;
  } | null;
  onAssignTable?: (
    bookingId: string,
    tableId: string,
  ) => Promise<OpsTodayBooking['tableAssignments']>;
  onUnassignTable?: (
    bookingId: string,
    tableId: string,
  ) => Promise<OpsTodayBooking['tableAssignments']>;
};

export function BookingsListVirtualized({
  bookings,
  sorted,
  summary,
  now,
  nowDate,
  allowTableAssignments,
  restaurantSlug,
  isRefetching,
  onDetails,
  onEdit,
  onCancel,
  onMarkNoShow,
  onUndoNoShow,
  onCheckIn,
  onCheckOut,
  pendingLifecycleAction,
  onAssignTable,
  onUnassignTable,
}: BookingsListVirtualizedProps) {
  const VIRTUALIZE_MIN_ITEMS = 20;
  const ROW_GAP = 12;
  const ROW_ESTIMATE = 140 + ROW_GAP;
  const bookingIds = useMemo(() => bookings.map((booking) => booking.id), [bookings]);
  const dtoCacheRef = useRef(new Map<string, BookingDTO>());
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
  const visibleBookingIds = useMemo(() => {
    if (!shouldVirtualize) {
      return bookingIds;
    }
    return virtualRows
      .map((row) => sorted[row.index]?.id)
      .filter((id): id is string => Boolean(id));
  }, [bookingIds, shouldVirtualize, sorted, virtualRows]);

  useBookingRealtime({
    restaurantId: summary.restaurantId,
    targetDate: summary.date,
    bookingIds,
    visibleBookingIds,
    summary,
    isSummaryFetching: isRefetching,
    enabled: bookings.length > 0,
  });

  const shouldAnimate = !prefersReducedMotion && !hasAnimatedRef.current && sorted.length > 0;

  useEffect(() => {
    if (sorted.length > 0) {
      hasAnimatedRef.current = true;
    }
  }, [sorted.length]);

  const getBookingDTO = useCallback(
    (booking: OpsTodayBooking) => {
      const assignmentKey = (booking.tableAssignments ?? [])
        .map((group) => {
          const groupId = group.groupId ?? 'none';
          const membersKey = (group.members ?? [])
            .map((member) => `${member.tableId}:${member.tableNumber}:${member.section ?? ''}`)
            .join(',');
          return `${groupId}:${membersKey}`;
        })
        .join('|');
      const signature = [
        booking.status,
        booking.startTime ?? '',
        booking.endTime ?? '',
        booking.partySize,
        booking.customerName,
        booking.customerEmail ?? '',
        booking.customerPhone ?? '',
        booking.notes ?? '',
        booking.allergies ?? '',
        booking.dietaryRestrictions ?? '',
        booking.seatingPreference ?? '',
        booking.reference ?? '',
        booking.checkedInAt ?? '',
        booking.checkedOutAt ?? '',
        assignmentKey,
        booking.requiresTableAssignment ? '1' : '0',
        summary.restaurantId,
        summary.timezone,
        summary.date,
        restaurantSlug ?? '',
      ].join('|');

      const cacheKey = `${booking.id}:${signature}`;
      const existing = dtoCacheRef.current.get(cacheKey);
      if (existing) return existing;

      const startIso = toIsoTime(summary.date, booking.startTime ?? null, summary.timezone);
      const endIso = toIsoTime(summary.date, booking.endTime ?? null, summary.timezone);
      const bookingDTO: BookingDTO = {
        id: booking.id,
        restaurantId: summary.restaurantId,
        reference: booking.reference ?? null,
        status: booking.status,
        startIso,
        endIso: endIso || startIso,
        partySize: booking.partySize,
        customerName: booking.customerName,
        customerEmail: booking.customerEmail ?? null,
        customerPhone: booking.customerPhone ?? null,
        restaurantName: 'Restaurant',
        restaurantSlug: restaurantSlug ?? null,
        restaurantTimezone: summary.timezone,
        notes: booking.notes ?? null,
        allergies: booking.allergies ?? null,
        dietaryRestrictions: booking.dietaryRestrictions ?? null,
        seatingPreference: booking.seatingPreference ?? null,
        tableAssignments: booking.tableAssignments,
        requiresTableAssignment: booking.requiresTableAssignment,
      };

      dtoCacheRef.current.set(cacheKey, bookingDTO);
      return bookingDTO;
    },
    [restaurantSlug, summary.date, summary.restaurantId, summary.timezone],
  );

  const hasAssignmentHandlers = Boolean(onAssignTable && onUnassignTable);

  const renderCard = useCallback(
    (booking: OpsTodayBooking) => {
      const hasStartTime = Boolean(booking.startTime);
      const bookingDTO = getBookingDTO(booking);
      const temporalInfo = getOpsBookingTemporalInfo(booking, summary, now);
      const allowAssignmentsForBooking =
        allowTableAssignments &&
        hasAssignmentHandlers &&
        temporalInfo.state !== 'past' &&
        isTableAssignmentStatusAllowed(booking.status);

      const pendingAction =
        pendingLifecycleAction?.bookingId === booking.id ? pendingLifecycleAction.action : null;
      const actionsDisabled = pendingAction !== null;

      return (
        <OpsBookingCard
          booking={bookingDTO}
          timezone={summary.timezone}
          now={nowDate}
          onCheckIn={onCheckIn}
          onCheckOut={onCheckOut}
          onMarkNoShow={onMarkNoShow}
          onUndoNoShow={onUndoNoShow}
          onDetails={onDetails}
          onEdit={onEdit}
          onCancel={onCancel}
          onAssignTable={onAssignTable}
          onUnassignTable={onUnassignTable}
          pendingAction={pendingAction}
          actionsDisabled={actionsDisabled}
          allowTableAssignments={allowAssignmentsForBooking}
          timeLabelOverride={hasStartTime ? null : 'Time TBD'}
          highlightUrgency={hasStartTime}
        />
      );
    },
    [
      allowTableAssignments,
      now,
      getBookingDTO,
      hasAssignmentHandlers,
      onAssignTable,
      onCancel,
      onCheckIn,
      onCheckOut,
      onDetails,
      onEdit,
      onMarkNoShow,
      onUndoNoShow,
      onUnassignTable,
      pendingLifecycleAction?.action,
      pendingLifecycleAction?.bookingId,
      summary,
      nowDate,
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
        {sorted.map((booking) => (
          <div key={booking.id}>{renderCard(booking)}</div>
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
                {renderCard(booking)}
              </div>
            );
          })}
        </div>
      </section>
    </motion.div>
  );
}
