import { DateTime } from 'luxon';

import { dateKeyToCalendarDate } from '@/lib/utils/datetime';
import { toBookingUtcIso } from '@reserve/shared/formatting/bookingDateTime';

import { formatMinutes } from './timeline';

export function parseLocalDateOnly(dateOnly: string): Date {
  return dateKeyToCalendarDate(dateOnly) ?? new Date(`${dateOnly}T00:00:00`);
}

export function getDateKeyDayOfWeek(dateOnly: string): number {
  const parsed = DateTime.fromISO(dateOnly, { zone: 'UTC' });
  if (!parsed.isValid) {
    return parseLocalDateOnly(dateOnly).getDay();
  }
  return parsed.weekday % 7;
}

export function getDateTimeTimestamp(
  dateOnly: string,
  totalMinutes: number,
  timezone?: string | null,
): number {
  const iso = toBookingUtcIso(dateOnly, formatMinutes(totalMinutes), timezone);
  const parsed = iso ? Date.parse(iso) : Number.NaN;
  if (!Number.isNaN(parsed)) {
    return parsed;
  }
  return parseLocalDateOnly(dateOnly).getTime() + totalMinutes * 60_000;
}

export function formatTimeParam(totalMinutes: number): string {
  return formatMinutes(totalMinutes);
}

export function formatDisplayTime(
  dateOnly: string,
  totalMinutes: number,
  timezone?: string | null,
): string {
  const timestamp = getDateTimeTimestamp(dateOnly, totalMinutes, timezone);
  const zone = timezone?.trim() || 'UTC';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp));
}
