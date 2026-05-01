'use client';

import { DateTime } from 'luxon';
import { useEffect, useMemo, useState } from 'react';

import { matchesBookingFilter } from '../bookingFilters';
import { sortBookings, sortBookingsGrouped } from './utils';

import type { BookingFilter } from '../BookingsFilterBar';
import type { BookingSortDir, BookingSortKey } from './utils';
import type { OpsTodayBooking, OpsTodayBookingsSummary } from '@/types/ops';

export type UseBookingsListStateProps = {
  bookings: OpsTodayBooking[];
  filter: BookingFilter;
  searchQuery?: string;
  summary: OpsTodayBookingsSummary;
  initialNowIso: string;
  allowTableAssignments: boolean;
  hasAssignmentHandlers: boolean;
  sortKey: BookingSortKey;
  sortDir: BookingSortDir;
  pendingLifecycleAction?: {
    bookingId: string | null;
    snapshot?: Pick<OpsTodayBooking, 'status' | 'startTime' | 'endTime'> | null;
  } | null;
};

function resolveInitialNow(initialNowIso: string, timezone: string): DateTime {
  const parsed = DateTime.fromISO(initialNowIso).setZone(timezone);
  return parsed.isValid ? parsed : DateTime.now().setZone(timezone);
}

export function useBookingsListState({
  bookings,
  filter,
  searchQuery,
  summary,
  initialNowIso,
  allowTableAssignments,
  hasAssignmentHandlers,
  sortKey,
  sortDir,
  pendingLifecycleAction,
}: UseBookingsListStateProps) {
  const [now, setNow] = useState(() => resolveInitialNow(initialNowIso, summary.timezone));
  const [isVisible, setIsVisible] = useState(true);

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
  }, [summary.timezone, isVisible]);

  const nowDate = useMemo(() => now.toJSDate(), [now]);

  const normalizedSearch = useMemo(() => (searchQuery ?? '').trim().toLowerCase(), [searchQuery]);
  const bookingsForSort = useMemo(() => {
    if (!pendingLifecycleAction?.bookingId || !pendingLifecycleAction.snapshot) {
      return bookings;
    }
    const { bookingId, snapshot } = pendingLifecycleAction;
    let replaced = false;
    const next = bookings.map((booking) => {
      if (booking.id !== bookingId) return booking;
      replaced = true;
      return {
        ...booking,
        status: snapshot.status,
        startTime: snapshot.startTime ?? booking.startTime,
        endTime: snapshot.endTime ?? booking.endTime,
      };
    });
    return replaced ? next : bookings;
  }, [bookings, pendingLifecycleAction]);
  const hasSearch = useMemo(() => normalizedSearch.length > 0, [normalizedSearch]);

  const filtered = useMemo(() => {
    let result = bookingsForSort;

    if (normalizedSearch && hasSearch) {
      const q = normalizedSearch;
      result = result.filter((booking) =>
        (
          booking.searchText ??
          `${booking.customerName ?? ''} ${booking.reference ?? ''}`.toLowerCase()
        ).includes(q),
      );
    }

    if (filter === 'all') return result;

    return result.filter((booking) =>
      matchesBookingFilter({
        booking,
        filter,
        summary,
        now,
        allowTableAssignments,
        hasAssignmentHandlers,
      }),
    );
  }, [
    allowTableAssignments,
    bookingsForSort,
    filter,
    hasAssignmentHandlers,
    now,
    normalizedSearch,
    hasSearch,
    summary,
  ]);

  const sorted = useMemo(() => {
    if (filter === 'all') {
      return sortBookingsGrouped(filtered, sortKey, sortDir);
    }
    return sortBookings(filtered, sortKey, sortDir);
  }, [filter, filtered, sortDir, sortKey]);

  return {
    now,
    nowDate,
    filtered,
    sorted,
  };
}
