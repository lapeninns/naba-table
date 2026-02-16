import { DateTime } from 'luxon';

import type { OpsTodayBooking } from '@/types/ops';

export type BookingSortKey = 'time' | 'party' | 'name';
export type BookingSortDir = 'asc' | 'desc';

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
    const tA = a.startTime
      ? new Date(`1970-01-01T${a.startTime}`).getTime()
      : Number.MAX_SAFE_INTEGER;
    const tB = b.startTime
      ? new Date(`1970-01-01T${b.startTime}`).getTime()
      : Number.MAX_SAFE_INTEGER;
    comparison = tA - tB;
  } else if (sortKey === 'party') {
    comparison = a.partySize - b.partySize;
  } else if (sortKey === 'name') {
    comparison = a.customerName.localeCompare(b.customerName);
  }

  return sortDir === 'asc' ? comparison : -comparison;
}

export function sortBookings(
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

/**
 * Get the relevant time for timeline sorting:
 * - For checked_in: endTime (when they'll finish / table frees up)
 * - For upcoming: startTime (when they arrive)
 */
function getTimelineTime(booking: OpsTodayBooking): number {
  const timeStr = booking.status === 'checked_in' ? booking.endTime : booking.startTime;
  if (!timeStr) return Number.MAX_SAFE_INTEGER;
  return new Date(`1970-01-01T${timeStr}`).getTime();
}

/**
 * Timeline merge sort for "All" filter:
 * Interleaves seated (by end time) and upcoming (by start time) based on
 * which event happens sooner. Completed bookings always sort to the bottom.
 */
export function sortBookingsGrouped(
  bookings: OpsTodayBooking[],
  sortKey: BookingSortKey,
  sortDir: BookingSortDir,
) {
  return [...bookings].sort((a, b) => {
    const groupA = getStatusGroup(a.status);
    const groupB = getStatusGroup(b.status);

    const aIsCompleted = groupA === 2;
    const bIsCompleted = groupB === 2;
    if (aIsCompleted && bIsCompleted) return compareBookings(a, b, sortKey, sortDir);
    if (aIsCompleted) return 1;
    if (bIsCompleted) return -1;

    const timeA = getTimelineTime(a);
    const timeB = getTimelineTime(b);
    if (timeA !== timeB) return timeA - timeB;

    return compareBookings(a, b, sortKey, sortDir);
  });
}

export function toIsoTime(date: string, time: string | null, timezone: string | null | undefined) {
  const normalizedZone =
    typeof timezone === 'string' && timezone.trim().length > 0 ? timezone.trim() : 'UTC';
  const normalizedTime = (() => {
    if (!time) return '00:00:00';
    const match = time.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!match) return time;
    const hours = match[1]?.padStart(2, '0') ?? '00';
    const minutes = match[2] ?? '00';
    const seconds = match[3] ?? '00';
    return `${hours}:${minutes}:${seconds}`;
  })();

  const zoned = DateTime.fromISO(`${date}T${normalizedTime}`, { zone: normalizedZone });
  if (zoned.isValid) {
    const iso = zoned.toUTC().toISO();
    if (iso) return iso;
  }

  // Last-resort fallback keeps API payload offset-aware even if zone/time input is malformed.
  return `${date}T${normalizedTime.endsWith('Z') ? normalizedTime : `${normalizedTime}Z`}`;
}
