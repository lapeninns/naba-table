
import { segmentAt, toMs } from './timeSelection';

import type { FloorPlanTable, ResolvedTableState, ServiceState } from './types';
import type { TableTimelineBookingRef, TableTimelineSegment } from '@/types/ops';

/** Minutes before a booking's end where a seated table reads as "finishing". */
export const FINISHING_THRESHOLD_MIN = 15;
/** Minutes after a booked start with no check-in before it reads as "overdue" (no-show risk). */
export const OVERDUE_GRACE_MIN = 20;

const MINUTE_MS = 60_000;

export type DeriveServiceStateInput = {
  segment: TableTimelineSegment | null;
  tMs: number;
  isWalkIn?: boolean;
  finishingThresholdMin?: number;
  overdueGraceMin?: number;
};

/**
 * Map a table's timeline segment + booking lifecycle at scrub time T → one of the
 * seven service states. Pure and deterministic: depends only on its inputs.
 *
 * Real signals (src/types/ops.ts, server/ops/table-timeline.ts):
 *  - segment.state: 'available' | 'reserved' | 'hold' | 'out_of_service'
 *  - booking.status: 'checked_in' is the only hard "seated" signal; confirmed/pending are booked-ahead
 *  - booking.startAt / endAt: the computed block window (drives derived finishing/overdue)
 *
 * Honest gaps:
 *  - 'finishing'/'overdue' have no backing column → time-derived from endAt/startAt vs T.
 *  - 'walkin' source isn't on the timeline ref yet → caller passes isWalkIn (false until P6),
 *    so walk-ins collapse into 'seated' until the server exposes bookingType.
 */
export function deriveServiceState({
  segment,
  tMs,
  isWalkIn = false,
  finishingThresholdMin = FINISHING_THRESHOLD_MIN,
  overdueGraceMin = OVERDUE_GRACE_MIN,
}: DeriveServiceStateInput): ServiceState {
  if (!segment) return 'free';
  if (segment.state === 'available' || segment.state === 'out_of_service') return 'free';
  if (segment.state === 'hold') return 'held';

  // segment.state === 'reserved'
  const booking = segment.booking;
  if (!booking) return 'confirmed';

  const endMs = toMs(booking.endAt);
  const startMs = toMs(booking.startAt);
  const finishingMs = finishingThresholdMin * MINUTE_MS;
  const graceMs = overdueGraceMin * MINUTE_MS;

  if (booking.status === 'checked_in') {
    if (endMs !== null && tMs > endMs) return 'overdue';
    if (endMs !== null && tMs >= endMs - finishingMs) return 'finishing';
    return isWalkIn ? 'walkin' : 'seated';
  }

  if (
    booking.status === 'confirmed' ||
    booking.status === 'pending' ||
    booking.status === 'pending_allocation'
  ) {
    if (startMs !== null && tMs > startMs + graceMs) return 'overdue';
    return 'confirmed';
  }

  // completed / cancelled / no_show / PRIORITY_WAITLIST shouldn't surface in live segments.
  return 'free';
}

/** Resolve a table's full live state (segment + booking + out-of-service flag) at T. */
export function resolveTableState(
  table: FloorPlanTable,
  tMs: number,
  opts?: { finishingThresholdMin?: number; overdueGraceMin?: number },
): ResolvedTableState {
  const segment = segmentAt(table.segments, tMs);
  const outOfService =
    !table.active ||
    table.zoneActive === false ||
    String(table.status ?? '').toLowerCase() === 'out_of_service' ||
    segment?.state === 'out_of_service';
  const isWalkIn = isWalkInBooking(segment?.booking ?? null);
  const state = deriveServiceState({ segment, tMs, isWalkIn, ...opts });
  return { state, segment, booking: segment?.booking ?? null, outOfService };
}

/**
 * Walk-in detection. The timeline booking ref does not yet carry bookingType (plan P6),
 * so this reads an optional bookingType when present and otherwise returns false —
 * until the server exposes it, walk-ins render as 'seated'.
 */
function isWalkInBooking(
  booking: (TableTimelineBookingRef & { bookingType?: string | null }) | null,
): boolean {
  const bookingType = booking?.bookingType;
  if (!bookingType) return false;
  return /walk[\s-]?in/i.test(bookingType);
}
