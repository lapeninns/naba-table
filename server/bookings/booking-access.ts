import { DateTime } from 'luxon';

import type { Tables } from '@/types/supabase';

type BookingRow = Pick<Tables<'bookings'>, 'booking_date' | 'start_time' | 'end_time' | 'start_at' | 'end_at'>;

function resolveLocalDateTime(
  date: string | null,
  time: string | null,
  timezone: string,
): DateTime | null {
  if (!date || !time) return null;
  const dt = DateTime.fromISO(`${date}T${time}`, { zone: timezone });
  return dt.isValid ? dt : null;
}

function toUtcIso(dt: DateTime | null): string | null {
  if (!dt) return null;
  const utc = dt.toUTC();
  return utc.isValid ? utc.toISO() : null;
}

export function resolveBookingEndAtUtc(booking: BookingRow, timezone: string): string | null {
  if (booking.end_at) {
    return booking.end_at;
  }

  const endLocal = resolveLocalDateTime(booking.booking_date, booking.end_time, timezone);
  if (!endLocal) {
    return null;
  }

  const startLocal = resolveLocalDateTime(booking.booking_date, booking.start_time, timezone);
  const resolvedEnd =
    startLocal && endLocal <= startLocal
      ? endLocal.plus({ days: 1 })
      : endLocal;

  return toUtcIso(resolvedEnd);
}
