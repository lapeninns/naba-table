'use client';

import { DateTime } from 'luxon';
import { useMemo } from 'react';

import { useCountdown } from '@/hooks/use-countdown';
import { formatRelativeTime } from '@/lib/utils/relative-time';

import type { BookingCountdownState } from '../types';

type UseBookingCountdownOptions = {
  /** Booking start time (ISO string or time string) */
  startTime: string | null;
  /** Service date in YYYY-MM-DD format */
  date: string;
  /** Restaurant timezone */
  timezone: string;
  /** When the guest checked in (ISO timestamp) */
  checkedInAt: string | null;
};

/**
 * Hook for managing booking countdown and time-related state
 * Single Responsibility: Time intelligence only
 */
export function useBookingCountdown({
  startTime,
  date,
  timezone,
  checkedInAt,
}: UseBookingCountdownOptions): BookingCountdownState {
  // Parse booking start time into DateTime
  const bookingStartTime = useMemo(() => {
    if (!startTime) return null;

    const dateTime = DateTime.fromISO(
      /^[0-9]{4}-[0-9]{2}-[0-9]{2}T/.test(startTime) ? startTime : `${date}T${startTime}`,
      { zone: timezone }
    );

    return dateTime.isValid ? dateTime : null;
  }, [startTime, date, timezone]);

  // Use the countdown hook
  const { minutesRemaining, timeStatus } = useCountdown(bookingStartTime);

  // Format relative start time
  const relativeStartTime = useMemo(() => {
    if (!bookingStartTime) return null;
    const now = DateTime.now().setZone(timezone);
    return formatRelativeTime(bookingStartTime, now, { style: 'long' });
  }, [bookingStartTime, timezone]);

  // Format checked-in relative time
  const checkedInRelativeTime = useMemo(() => {
    if (!checkedInAt) return null;
    const checkedInTime = DateTime.fromISO(checkedInAt);
    if (!checkedInTime.isValid) return null;
    const now = DateTime.now();
    return formatRelativeTime(checkedInTime, now, { style: 'long' });
  }, [checkedInAt]);

  return {
    minutesRemaining,
    timeStatus,
    relativeStartTime,
    checkedInRelativeTime,
  };
}
