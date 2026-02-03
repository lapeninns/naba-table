'use client';

import { useWindowVirtualizer } from '@tanstack/react-virtual';
import {
  Loader2,
  Search,
} from 'lucide-react';
import { DateTime } from 'luxon';
import { motion, useReducedMotion } from 'motion/react';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { OpsBookingCard } from '@/components/dashboard/OpsBookingCard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BookingStateMachineProvider,
  useBookingStateMachine,
  useOptionalBookingStateMachine,
} from '@/contexts/booking-state-machine';
import { useBookingRealtime } from '@/hooks/ops/useBookingRealtime';
import { getOpsBookingActionRequirements, getOpsBookingTemporalInfo } from '@/utils/ops/todayBookingsAttention';

const BookingDetailsDialog = dynamic(() => import('./BookingDetailsDialog').then((m) => m.BookingDetailsDialog), {
  loading: () => (
    <Button
      id="booking-details-loading"
      variant="outline"
      size="sm"
      className="h-11 min-w-[120px]"
      disabled
      aria-busy
    >
      Loading…
    </Button>
  ),
});

void BookingDetailsDialog;

import type { BookingFilter } from './BookingsFilterBar';
import type { BookingDTO } from '@/hooks/useBookings';
import type { OpsTodayBooking, OpsTodayBookingsSummary } from '@/types/ops';

// --- HELPER TYPES & COMPONENTS ---

type BookingsListProps = {
  bookings: OpsTodayBooking[];
  filter: BookingFilter;
  searchQuery?: string;
  summary: OpsTodayBookingsSummary;
  allowTableAssignments: boolean;
  restaurantSlug?: string | null;
  sortKey: BookingSortKey;
  sortDir: BookingSortDir;
  onSortKeyChange: (value: BookingSortKey) => void;
  onSortDirChange: (value: BookingSortDir) => void;
  isRefetching?: boolean; // Show list skeletons while data is being refetched
  onDetails?: (booking: BookingDTO) => void;
  onEdit?: (booking: BookingDTO) => void;
  onMarkNoShow: (bookingId: string, options?: { performedAt?: string | null; reason?: string | null }) => Promise<void>;
  onUndoNoShow: (bookingId: string, reason?: string | null) => Promise<void>;
  onCheckIn: (bookingId: string) => Promise<void>;
  onCheckOut: (bookingId: string) => Promise<void>;
  pendingLifecycleAction?: {
    bookingId: string | null;
    action: 'check-in' | 'check-out' | 'no-show' | 'undo-no-show';
  } | null;
  onAssignTable?: (bookingId: string, tableId: string) => Promise<OpsTodayBooking['tableAssignments']>;
  onUnassignTable?: (bookingId: string, tableId: string) => Promise<OpsTodayBooking['tableAssignments']>;
  tableActionState?: {
    type: 'assign' | 'unassign';
    bookingId: string | null;
    tableId?: string | null;
  } | null;
};

type BookingSortKey = 'time' | 'party' | 'name';
type BookingSortDir = 'asc' | 'desc';


const UPCOMING_STATUSES = new Set<OpsTodayBooking['status']>([
  'confirmed',
  'PRIORITY_WAITLIST',
  'pending',
  'pending_allocation',
]);

const COMPLETED_STATUSES = new Set<OpsTodayBooking['status']>([
  'completed',
  'cancelled',
  'no_show',
]);

function compareBookings(
  a: OpsTodayBooking,
  b: OpsTodayBooking,
  sortKey: BookingSortKey,
  sortDir: BookingSortDir,
) {
  let comparison = 0;

  if (sortKey === 'time') {
    const tA = a.startTime ? new Date(`1970-01-01T${a.startTime}`).getTime() : Number.MAX_SAFE_INTEGER;
    const tB = b.startTime ? new Date(`1970-01-01T${b.startTime}`).getTime() : Number.MAX_SAFE_INTEGER;
    comparison = tA - tB;
  } else if (sortKey === 'party') {
    comparison = a.partySize - b.partySize;
  } else if (sortKey === 'name') {
    comparison = a.customerName.localeCompare(b.customerName);
  }

  return sortDir === 'asc' ? comparison : -comparison;
}

function sortBookings(
  bookings: OpsTodayBooking[],
  sortKey: BookingSortKey,
  sortDir: BookingSortDir,
) {
  return [...bookings].sort((a, b) => compareBookings(a, b, sortKey, sortDir));
}

function getStatusGroup(status: OpsTodayBooking['status']) {
  if (status === 'checked_in') return 0;
  if (UPCOMING_STATUSES.has(status)) return 1;
  if (COMPLETED_STATUSES.has(status)) return 2;
  return 1;
}

function sortBookingsGrouped(
  bookings: OpsTodayBooking[],
  sortKey: BookingSortKey,
  sortDir: BookingSortDir,
) {
  return [...bookings].sort((a, b) => {
    const groupA = getStatusGroup(a.status);
    const groupB = getStatusGroup(b.status);
    if (groupA !== groupB) {
      return groupA - groupB;
    }
    return compareBookings(a, b, sortKey, sortDir);
  });
}

function toIsoTime(date: string, time: string | null) {
  if (!time) return `${date}T00:00:00`;
  const match = time.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) {
    return `${date}T${time}`;
  }
  const hours = match[1]?.padStart(2, '0') ?? '00';
  const minutes = match[2] ?? '00';
  const seconds = match[3] ?? '00';
  return `${date}T${hours}:${minutes}:${seconds}`;
}

export function BookingsList(props: BookingsListProps) {
  const existingStateMachine = useOptionalBookingStateMachine();
  const initialSnapshots = useMemo(
    () =>
      props.bookings.map((booking) => ({
        id: booking.id,
        status: booking.status,
        updatedAt: null,
      })),
    [props.bookings],
  );

  if (existingStateMachine) {
    return <BookingsListContent {...props} />;
  }

  return (
    <BookingStateMachineProvider initialBookings={initialSnapshots}>
      <BookingsListContent {...props} />
    </BookingStateMachineProvider>
  );
}

function BookingsListContent({
  bookings,
  filter,
  searchQuery,
  summary,
  allowTableAssignments,
  restaurantSlug,
  sortKey,
  sortDir,
  onSortKeyChange,
  onSortDirChange,
  isRefetching = false,
  onDetails,
  onEdit,
  onMarkNoShow,
  onUndoNoShow,
  onCheckIn,
  onCheckOut,
  pendingLifecycleAction,
  onAssignTable,
  onUnassignTable,
  tableActionState: _tableActionState,
}: BookingsListProps) {
  const { registerBookings } = useBookingStateMachine();
  const [now, setNow] = useState(() => DateTime.now().setZone(summary.timezone));
  const nowDate = useMemo(() => now.toJSDate(), [now]);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    registerBookings(
      bookings.map((booking) => ({
        id: booking.id,
        status: booking.status,
        updatedAt: null,
      })),
    );
  }, [bookings, registerBookings]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleVisibility = () => setIsVisible(document.visibilityState === 'visible');
    handleVisibility();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    setNow(DateTime.now().setZone(summary.timezone));
    const interval = setInterval(() => {
      setNow(DateTime.now().setZone(summary.timezone));
    }, 60_000);
    return () => clearInterval(interval);
  }, [summary.timezone, summary.date, isVisible]);

  const normalizedSearch = useMemo(
    () => (searchQuery ?? '').trim().toLowerCase(),
    [searchQuery],
  );
  const searchIndex = useMemo(() => {
    const index = new Map<string, string>();
    for (const booking of bookings) {
      const haystack = `${booking.customerName ?? ''} ${booking.reference ?? ''}`.toLowerCase();
      index.set(booking.id, haystack);
    }
    return index;
  }, [bookings]);
  const attentionNow = filter === 'attention' ? now : null;

  const hasAssignmentHandlers = Boolean(onAssignTable && onUnassignTable);
  const isLifecycleLockActive =
    pendingLifecycleAction?.action === 'check-in' || pendingLifecycleAction?.action === 'check-out';

  const filtered = useMemo(() => {
    let result = bookings;

    // Search Filter
    if (normalizedSearch) {
      const q = normalizedSearch;
      result = result.filter((b) => (searchIndex.get(b.id) ?? '').includes(q));
    }

    if (filter === 'all') return result;

    // IMPORTANT: Use actual booking status (not optimistic) so cards stay in place
    // during loading. Cards only move after server confirms the change.
    if (filter === 'upcoming') {
      return result.filter((b) => b.status === 'confirmed' || b.status === 'PRIORITY_WAITLIST' || b.status === 'pending' || b.status === 'pending_allocation');
    }
    if (filter === 'seated') {
      return result.filter((b) => b.status === 'checked_in');
    }
    if (filter === 'finished' || filter === 'completed') {
      return result.filter((b) => ['completed', 'cancelled', 'no_show'].includes(b.status));
    }
    if (filter === 'no_show') {
      return result.filter((b) => b.status === 'no_show');
    }

    // Default 'attention' logic - uses actual status
    if (!attentionNow) {
      return result;
    }

    return result.filter((booking) => {
      const temporalInfo = getOpsBookingTemporalInfo(booking, summary, attentionNow);
      const requirements = getOpsBookingActionRequirements({
        booking,
        temporalInfo,
        now: attentionNow,
        statusForActions: booking.status,
        allowTableAssignments,
        hasAssignmentHandlers,
      });
      return requirements.needsAttention;
    });
  }, [bookings, filter, summary, attentionNow, allowTableAssignments, hasAssignmentHandlers, normalizedSearch, searchIndex]);

  const sorted = useMemo(() => {
    if (filter === 'all') {
      return sortBookingsGrouped(filtered, sortKey, sortDir);
    }
    return sortBookings(filtered, sortKey, sortDir);
  }, [filter, filtered, sortKey, sortDir]);

  const VIRTUALIZE_MIN_ITEMS = 20;
  const bookingIds = useMemo(() => bookings.map((booking) => booking.id), [bookings]);
  const rowMeasureCacheRef = useRef(new Map<string, number>());
  const rowStatusCacheRef = useRef(new Map<string, OpsTodayBooking['status']>());
  const dtoCacheRef = useRef(new Map<string, BookingDTO>());
  const prefersReducedMotion = useReducedMotion();
  const hasAnimatedRef = useRef(false);
  const measureFrameRef = useRef<number | null>(null);

  const rowVirtualizer = useWindowVirtualizer({
    count: sorted.length >= VIRTUALIZE_MIN_ITEMS ? sorted.length : 0,
    estimateSize: (index) => {
      const id = sorted[index]?.id;
      if (!id) return 140;
      return rowMeasureCacheRef.current.get(id) ?? 140;
    },
    overscan: 6,
  });
  const shouldVirtualize = sorted.length >= VIRTUALIZE_MIN_ITEMS;
  const virtualRows = rowVirtualizer.getVirtualItems();
  const visibleBookingIds = useMemo(() => {
    if (!shouldVirtualize) {
      return bookingIds;
    }
    return virtualRows
      .map((row) => sorted[row.index]?.id)
      .filter((id): id is string => Boolean(id));
  }, [bookingIds, shouldVirtualize, sorted, virtualRows]);

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

  useBookingRealtime({
    restaurantId: summary.restaurantId,
    targetDate: summary.date,
    bookingIds,
    visibleBookingIds,
    summary,
    isSummaryFetching: isRefetching,
    enabled: bookings.length > 0,
  });

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

  const shouldAnimate = !prefersReducedMotion && !hasAnimatedRef.current && sorted.length > 0;

  useEffect(() => {
    if (sorted.length > 0) {
      hasAnimatedRef.current = true;
    }
  }, [sorted.length]);

  const getBookingDTO = (booking: OpsTodayBooking) => {
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
      booking.loyaltyTier ?? '',
      booking.reference ?? '',
      booking.checkedInAt ?? '',
      booking.checkedOutAt ?? '',
      (booking.tableAssignments ?? []).length,
      booking.requiresTableAssignment ? '1' : '0',
      summary.restaurantId,
      summary.timezone,
      summary.date,
      restaurantSlug ?? '',
    ].join('|');

    const cacheKey = `${booking.id}:${signature}`;
    const existing = dtoCacheRef.current.get(cacheKey);
    if (existing) return existing;

    const startIso = toIsoTime(summary.date, booking.startTime ?? null);
    const endIso = toIsoTime(summary.date, booking.endTime ?? null);
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
      loyaltyTier: booking.loyaltyTier ?? null,
      tableAssignments: booking.tableAssignments,
      requiresTableAssignment: booking.requiresTableAssignment,
    };

    dtoCacheRef.current.set(cacheKey, bookingDTO);
    return bookingDTO;
  };

  if (filtered.length === 0) {
    return (
      <Card className="border-dashed border-border/60 bg-muted/30">
        <div className="flex flex-col items-center gap-3 py-10 px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-card shadow-sm ring-1 ring-border/50">
            <Search className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-base font-semibold text-foreground">No bookings found</p>
            <p className="text-sm text-muted-foreground">
              Adjust filters to see more results.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Sort Controls */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <span className="text-sm font-medium text-muted-foreground">Sort</span>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <Select value={sortKey} onValueChange={(val) => onSortKeyChange(val as BookingSortKey)}>
            <SelectTrigger className="h-9 w-full rounded-lg bg-card sm:w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="time">Time</SelectItem>
              <SelectItem value="party">Party Size</SelectItem>
              <SelectItem value="name">Guest Name</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortDir} onValueChange={(val) => onSortDirChange(val as BookingSortDir)}>
            <SelectTrigger className="h-9 w-full rounded-lg bg-card sm:w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">Ascending</SelectItem>
              <SelectItem value="desc">Descending</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isRefetching ? (
        <div
          className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Updating bookings...
        </div>
      ) : null}

      {/* Booking Cards */}
      {shouldVirtualize ? (
        <motion.div
          className="relative"
          initial={shouldAnimate ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={shouldAnimate ? { duration: 0.2, ease: 'easeOut' } : undefined}
        >
          <div className="relative" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
            {virtualRows.map((virtualRow) => {
              const booking = sorted[virtualRow.index];
              if (!booking) return null;

              const hasStartTime = Boolean(booking.startTime);
              const bookingDTO = getBookingDTO(booking);

              const temporalInfo = getOpsBookingTemporalInfo(booking, summary, now);
              const allowAssignmentsForBooking =
                allowTableAssignments && hasAssignmentHandlers && temporalInfo.state !== 'past';

              const pendingAction =
                pendingLifecycleAction?.bookingId === booking.id ? pendingLifecycleAction.action : null;
              const actionsDisabled =
                isLifecycleLockActive &&
                Boolean(pendingLifecycleAction?.bookingId) &&
                pendingLifecycleAction?.bookingId !== booking.id;

              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
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
                  className="absolute left-0 top-0 w-full will-change-transform"
                  style={{ transform: `translate3d(0, ${virtualRow.start}px, 0)` }}
                >
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
                    onAssignTable={onAssignTable}
                    onUnassignTable={onUnassignTable}
                    pendingAction={pendingAction}
                    actionsDisabled={actionsDisabled}
                    allowTableAssignments={allowAssignmentsForBooking}
                    timeLabelOverride={hasStartTime ? null : 'Time TBD'}
                    highlightUrgency={hasStartTime}
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
          {sorted.map((booking) => {
            const hasStartTime = Boolean(booking.startTime);
            const bookingDTO = getBookingDTO(booking);
            const temporalInfo = getOpsBookingTemporalInfo(booking, summary, now);
            const allowAssignmentsForBooking =
              allowTableAssignments && hasAssignmentHandlers && temporalInfo.state !== 'past';
            const pendingAction =
              pendingLifecycleAction?.bookingId === booking.id ? pendingLifecycleAction.action : null;
            const actionsDisabled =
              isLifecycleLockActive &&
              Boolean(pendingLifecycleAction?.bookingId) &&
              pendingLifecycleAction?.bookingId !== booking.id;

            return (
              <div key={booking.id}>
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
                  onAssignTable={onAssignTable}
                  onUnassignTable={onUnassignTable}
                  pendingAction={pendingAction}
                  actionsDisabled={actionsDisabled}
                  allowTableAssignments={allowAssignmentsForBooking}
                  timeLabelOverride={hasStartTime ? null : 'Time TBD'}
                  highlightUrgency={hasStartTime}
                />
              </div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}

// Legacy BookingCard removed; this file renders `OpsBookingCard` for the list.
