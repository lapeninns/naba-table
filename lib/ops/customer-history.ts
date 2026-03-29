import {
  OPS_GUEST_RETURNING_MIN_BOOKINGS,
  OPS_GUEST_VIP_MIN_BOOKINGS,
} from '@/lib/ops/customers';

import type { OpsCustomersSummary } from '@/types/ops';

export type CustomerHistoryMarketingFilter = 'all' | 'opted_in' | 'opted_out';
export type CustomerHistoryLastVisitFilter = 'any' | '30d' | '90d' | '365d' | 'never';
export type CustomerHistorySortBy = 'last_visit' | 'bookings';
export type CustomerHistorySortOrder = 'asc' | 'desc';
export type CustomerHistoryBookingStatus =
  | 'confirmed'
  | 'pending'
  | 'cancelled'
  | 'completed'
  | 'PRIORITY_WAITLIST'
  | 'no_show'
  | 'pending_allocation'
  | 'checked_in';

export type CustomerIdentityRecord = {
  id: string;
  restaurantId: string;
  name: string;
  email: string;
  phone: string;
  marketingOptIn: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CustomerBookingRecord = {
  id: string;
  customerId: string;
  restaurantId: string;
  status: CustomerHistoryBookingStatus;
  partySize: number;
  createdAt: string;
  startAt: string | null;
};

export type CustomerHistoryRecord = CustomerIdentityRecord & {
  firstBookingAt: string | null;
  lastVisitAt: string | null;
  totalBookings: number;
  totalCovers: number;
  totalCancellations: number;
};

export type CustomerHistoryFilters = {
  lastVisit: CustomerHistoryLastVisitFilter;
  minBookings: number;
};

const CANCELLED_BOOKING_STATUSES = new Set<CustomerHistoryBookingStatus>(['cancelled', 'no_show']);
const EXCLUDED_BOOKING_STATUSES = new Set<CustomerHistoryBookingStatus>(['PRIORITY_WAITLIST']);

const LAST_VISIT_FILTER_DAYS: Record<
  Exclude<CustomerHistoryLastVisitFilter, 'any' | 'never'>,
  number
> = {
  '30d': 30,
  '90d': 90,
  '365d': 365,
};

function parseIsoTimestamp(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function toIsoString(timestamp: number | null): string | null {
  if (timestamp === null) {
    return null;
  }

  return new Date(timestamp).toISOString();
}

function isIncludedBooking(status: CustomerHistoryBookingStatus): boolean {
  return !EXCLUDED_BOOKING_STATUSES.has(status);
}

function isPastVisit(booking: CustomerBookingRecord, nowMs: number): boolean {
  if (CANCELLED_BOOKING_STATUSES.has(booking.status) || EXCLUDED_BOOKING_STATUSES.has(booking.status)) {
    return false;
  }

  const occurrenceMs = parseIsoTimestamp(booking.startAt) ?? parseIsoTimestamp(booking.createdAt);
  if (occurrenceMs === null) {
    return false;
  }

  return occurrenceMs <= nowMs;
}

export function buildCustomerHistoryRecords(
  customers: CustomerIdentityRecord[],
  bookings: CustomerBookingRecord[],
  now: Date = new Date(),
): CustomerHistoryRecord[] {
  const bookingBuckets = new Map<string, CustomerBookingRecord[]>();

  for (const booking of bookings) {
    if (!isIncludedBooking(booking.status)) {
      continue;
    }

    const current = bookingBuckets.get(booking.customerId);
    if (current) {
      current.push(booking);
    } else {
      bookingBuckets.set(booking.customerId, [booking]);
    }
  }

  const nowMs = now.getTime();

  return customers.map((customer) => {
    const customerBookings = bookingBuckets.get(customer.id) ?? [];
    let firstBookingMs: number | null = null;
    let lastVisitMs: number | null = null;
    let totalBookings = 0;
    let totalCovers = 0;
    let totalCancellations = 0;

    for (const booking of customerBookings) {
      totalBookings += 1;
      totalCovers += booking.partySize;

      if (CANCELLED_BOOKING_STATUSES.has(booking.status)) {
        totalCancellations += 1;
      }

      const occurrenceMs = parseIsoTimestamp(booking.startAt) ?? parseIsoTimestamp(booking.createdAt);
      if (occurrenceMs !== null && (firstBookingMs === null || occurrenceMs < firstBookingMs)) {
        firstBookingMs = occurrenceMs;
      }

      if (
        isPastVisit(booking, nowMs) &&
        occurrenceMs !== null &&
        (lastVisitMs === null || occurrenceMs > lastVisitMs)
      ) {
        lastVisitMs = occurrenceMs;
      }
    }

    return {
      ...customer,
      firstBookingAt: toIsoString(firstBookingMs),
      lastVisitAt: toIsoString(lastVisitMs),
      totalBookings,
      totalCovers,
      totalCancellations,
    };
  });
}

export function filterCustomerHistoryRecords(
  records: CustomerHistoryRecord[],
  filters: CustomerHistoryFilters,
  now: Date = new Date(),
): CustomerHistoryRecord[] {
  const minBookings = Math.max(0, filters.minBookings);
  const lastVisit = filters.lastVisit;
  const nowMs = now.getTime();
  const cutoffDays = lastVisit !== 'any' && lastVisit !== 'never' ? LAST_VISIT_FILTER_DAYS[lastVisit] : null;
  const cutoffMs = cutoffDays ? nowMs - cutoffDays * 24 * 60 * 60 * 1000 : null;

  return records.filter((record) => {
    if (record.totalBookings < minBookings) {
      return false;
    }

    if (lastVisit === 'any') {
      return true;
    }

    if (lastVisit === 'never') {
      return record.lastVisitAt === null;
    }

    const lastVisitMs = parseIsoTimestamp(record.lastVisitAt);
    if (lastVisitMs === null || cutoffMs === null) {
      return false;
    }

    return lastVisitMs >= cutoffMs;
  });
}

export function sortCustomerHistoryRecords(
  records: CustomerHistoryRecord[],
  sortBy: CustomerHistorySortBy,
  sortOrder: CustomerHistorySortOrder,
): CustomerHistoryRecord[] {
  const direction = sortOrder === 'asc' ? 1 : -1;

  return records.toSorted((left, right) => {
    if (sortBy === 'bookings') {
      if (left.totalBookings !== right.totalBookings) {
        return direction * (left.totalBookings - right.totalBookings);
      }
    } else {
      const leftVisit = parseIsoTimestamp(left.lastVisitAt);
      const rightVisit = parseIsoTimestamp(right.lastVisitAt);

      if (leftVisit === null && rightVisit !== null) return 1;
      if (leftVisit !== null && rightVisit === null) return -1;
      if (leftVisit !== null && rightVisit !== null && leftVisit !== rightVisit) {
        return direction * (leftVisit - rightVisit);
      }
    }

    return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
  });
}

export function summarizeCustomerHistoryRecords(
  records: CustomerHistoryRecord[],
): OpsCustomersSummary {
  let total = 0;
  let optedIn = 0;
  let optedOut = 0;
  let returning = 0;
  let vip = 0;
  let neverVisited = 0;

  for (const record of records) {
    total += 1;
    if (record.marketingOptIn) {
      optedIn += 1;
    } else {
      optedOut += 1;
    }
    if (record.totalBookings >= OPS_GUEST_RETURNING_MIN_BOOKINGS) {
      returning += 1;
    }
    if (record.totalBookings >= OPS_GUEST_VIP_MIN_BOOKINGS) {
      vip += 1;
    }
    if (record.lastVisitAt === null) {
      neverVisited += 1;
    }
  }

  return {
    total,
    optedIn,
    optedOut,
    returning,
    vip,
    neverVisited,
  };
}
