'use client';

import { DateTime } from 'luxon';
import { useEffect, useMemo, useState } from 'react';

import { getOpsBookingActionRequirements, getOpsBookingTemporalInfo } from '@/utils/ops/todayBookingsAttention';

import { sortBookings, sortBookingsGrouped } from './utils';

import type { BookingFilter } from '../BookingsFilterBar';
import type { BookingSortDir, BookingSortKey } from './utils';
import type { OpsTodayBooking, OpsTodayBookingsSummary } from '@/types/ops';

export type UseBookingsListStateProps = {
  bookings: OpsTodayBooking[];
  filter: BookingFilter;
  searchQuery?: string;
  summary: OpsTodayBookingsSummary;
  allowTableAssignments: boolean;
  hasAssignmentHandlers: boolean;
  sortKey: BookingSortKey;
  sortDir: BookingSortDir;
};

export function useBookingsListState({
  bookings,
  filter,
  searchQuery,
  summary,
  allowTableAssignments,
  hasAssignmentHandlers,
  sortKey,
  sortDir,
}: UseBookingsListStateProps) {
  const [now, setNow] = useState(() => DateTime.now().setZone(summary.timezone));
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
  }, [summary.timezone, summary.date, isVisible]);

  const nowDate = useMemo(() => now.toJSDate(), [now]);

  const normalizedSearch = useMemo(() => (searchQuery ?? '').trim().toLowerCase(), [searchQuery]);
  const searchIndex = useMemo(() => {
    if (!normalizedSearch) return null;
    const index = new Map<string, string>();
    for (const booking of bookings) {
      const haystack = `${booking.customerName ?? ''} ${booking.reference ?? ''}`.toLowerCase();
      index.set(booking.id, haystack);
    }
    return index;
  }, [bookings, normalizedSearch]);

  const attentionNow = filter === 'attention' ? now : null;

  const filtered = useMemo(() => {
    let result = bookings;

    if (normalizedSearch && searchIndex) {
      const q = normalizedSearch;
      result = result.filter((b) => (searchIndex.get(b.id) ?? '').includes(q));
    }

    if (filter === 'all') return result;

    if (filter === 'upcoming') {
      return result.filter(
        (b) =>
          b.status === 'confirmed' ||
          b.status === 'PRIORITY_WAITLIST' ||
          b.status === 'pending' ||
          b.status === 'pending_allocation',
      );
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
  }, [
    attentionNow,
    allowTableAssignments,
    bookings,
    filter,
    hasAssignmentHandlers,
    normalizedSearch,
    searchIndex,
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
