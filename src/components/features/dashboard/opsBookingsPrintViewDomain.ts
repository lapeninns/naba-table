import { DateTime } from 'luxon';

import { formatDateReadable, formatTimeRange, getTodayInTimezone } from '@/lib/utils/datetime';
import { sanitizeDateParam } from '@/utils/ops/dashboard';

import { flattenTableAssignments } from './booking-details/utils';
import {
  getBookingFilterLabel,
  matchesBookingFilter,
  normalizeBookingFilter,
} from './bookingFilters';

import type { BookingFilter } from './BookingsFilterBar';
import type { OpsTodayBooking, OpsTodayBookingsSummary } from '@/types/ops';

export type BookingSortKey = 'time' | 'party' | 'name';
export type BookingSortDir = 'asc' | 'desc';

export type OpsBookingsPrintParams = {
  date?: string | string[];
  filter?: string | string[];
  search?: string | string[];
  sortKey?: string | string[];
  sortDir?: string | string[];
};

export type ParsedOpsBookingsPrintParams = {
  filter: BookingFilter;
  parsedDate: string | null;
  searchQuery: string;
  sortDir: BookingSortDir;
  sortKey: BookingSortKey;
  targetDate: string | null;
};

export type OpsBookingsPrintViewState = {
  filterLabel: string;
  readableDate: string;
  sortDirLabel: string;
  sortedBookings: OpsTodayBooking[];
  sortLabel: string;
};

export type OpsBookingsPrintTableRow = {
  id: string;
  nameLabel: string;
  notesLabel: string;
  partySize: number;
  tableLabel: string;
  timeLabel: string;
};

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

const SORT_KEYS: BookingSortKey[] = ['time', 'party', 'name'];
const SORT_DIRS: BookingSortDir[] = ['asc', 'desc'];

function pickFirst(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function parseFilter(value?: string | string[]): BookingFilter {
  return normalizeBookingFilter(pickFirst(value)) ?? 'all';
}

function parseSortKey(value?: string | string[]): BookingSortKey {
  const raw = pickFirst(value);
  if (raw && SORT_KEYS.includes(raw as BookingSortKey)) {
    return raw as BookingSortKey;
  }
  return 'time';
}

function parseSortDir(value?: string | string[]): BookingSortDir {
  const raw = pickFirst(value);
  if (raw && SORT_DIRS.includes(raw as BookingSortDir)) {
    return raw as BookingSortDir;
  }
  return 'asc';
}

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

function getSortLabel(sortKey: BookingSortKey) {
  if (sortKey === 'time') return 'Time';
  if (sortKey === 'party') return 'Party size';
  return 'Guest name';
}

function getSortDirLabel(sortDir: BookingSortDir) {
  return sortDir === 'asc' ? 'Ascending' : 'Descending';
}

export function parseOpsBookingsPrintParams(
  params: OpsBookingsPrintParams,
): ParsedOpsBookingsPrintParams {
  const parsedDate = sanitizeDateParam(pickFirst(params.date) ?? null);

  return {
    filter: parseFilter(params.filter),
    parsedDate,
    searchQuery: (pickFirst(params.search) ?? '').trim(),
    sortDir: parseSortDir(params.sortDir),
    sortKey: parseSortKey(params.sortKey),
    targetDate: parsedDate ?? null,
  };
}

export function shouldAllowPrintTableAssignments(
  summary: OpsTodayBookingsSummary | null,
  isSummaryReady: boolean,
): boolean {
  if (!summary || !isSummaryReady) return true;
  const today = getTodayInTimezone(summary.timezone);
  return summary.date >= today;
}

export function getOpsBookingsPrintNow(summary: OpsTodayBookingsSummary | null): DateTime {
  return summary ? DateTime.now().setZone(summary.timezone) : DateTime.now();
}

export function buildOpsBookingsPrintViewState({
  allowTableAssignments,
  filter,
  now,
  searchQuery,
  sortDir,
  sortKey,
  summary,
}: {
  allowTableAssignments: boolean;
  filter: BookingFilter;
  now: DateTime;
  searchQuery: string;
  sortDir: BookingSortDir;
  sortKey: BookingSortKey;
  summary: OpsTodayBookingsSummary;
}): OpsBookingsPrintViewState {
  let filteredBookings = summary.bookings;

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filteredBookings = filteredBookings.filter(
      (booking) =>
        booking.customerName.toLowerCase().includes(q) ||
        Boolean(booking.reference?.toLowerCase().includes(q)),
    );
  }

  if (filter !== 'all') {
    filteredBookings = filteredBookings.filter((booking) =>
      matchesBookingFilter({
        booking,
        filter,
        summary,
        now,
        allowTableAssignments,
        hasAssignmentHandlers: true,
      }),
    );
  }

  return {
    filterLabel: getBookingFilterLabel(filter),
    readableDate: formatDateReadable(summary.date, summary.timezone),
    sortDirLabel: getSortDirLabel(sortDir),
    sortedBookings:
      filter === 'all'
        ? sortBookingsGrouped(filteredBookings, sortKey, sortDir)
        : sortBookings(filteredBookings, sortKey, sortDir),
    sortLabel: getSortLabel(sortKey),
  };
}

export function buildOpsBookingsPrintTableRow(
  booking: OpsTodayBooking,
  timezone: string,
): OpsBookingsPrintTableRow {
  const tables = flattenTableAssignments(booking.tableAssignments);
  const numbers = tables.map((table) => table.tableNumber).filter(Boolean);
  const uniqueTableNumbers = Array.from(new Set(numbers));

  return {
    id: booking.id,
    nameLabel: booking.customerName?.trim() || 'Walk-in Guest',
    notesLabel: booking.notes?.trim() || '-',
    partySize: booking.partySize,
    tableLabel: uniqueTableNumbers.length > 0 ? uniqueTableNumbers.join(', ') : 'Unassigned',
    timeLabel: formatTimeRange(booking.startTime, booking.endTime, timezone),
  };
}
