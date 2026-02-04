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

export function sortBookingsGrouped(
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

export function toIsoTime(date: string, time: string | null) {
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
