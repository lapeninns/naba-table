import { DateTime } from 'luxon';

import { normalizeTime, toMinutes } from '@reserve/shared/time';

const DEFAULT_BOOKING_TIMEZONE = 'Europe/London';
const ISO_WITH_EXPLICIT_OFFSET = /(Z|[+-]\d{2}:\d{2})$/i;

export function resolveBookingTimezone(timezone?: string | null): string {
  const candidate = timezone?.trim();
  return candidate && candidate.length > 0 ? candidate : DEFAULT_BOOKING_TIMEZONE;
}

export function parseBookingDateTime(
  value: string | null | undefined,
  timezone?: string | null,
): DateTime | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  const zone = resolveBookingTimezone(timezone);
  const parsed = ISO_WITH_EXPLICIT_OFFSET.test(trimmed)
    ? DateTime.fromISO(trimmed, { setZone: true }).setZone(zone)
    : DateTime.fromISO(trimmed, { zone });

  return parsed.isValid ? parsed : null;
}

export function parseBookingDateTimeToDate(
  value: string | null | undefined,
  timezone?: string | null,
): Date | null {
  return parseBookingDateTime(value, timezone)?.toJSDate() ?? null;
}

export function getBookingDateTimeMillis(
  value: string | null | undefined,
  timezone?: string | null,
): number | null {
  const parsed = parseBookingDateTime(value, timezone);
  return parsed ? parsed.toUTC().toMillis() : null;
}

export function toBookingUtcIso(
  date: string | null | undefined,
  time: string | null | undefined,
  timezone?: string | null,
): string | null {
  const normalizedDate = date?.trim();
  if (!normalizedDate) {
    return null;
  }

  const normalizedTime = normalizeTime(time) ?? '00:00';
  const zone = resolveBookingTimezone(timezone);
  const parsed = DateTime.fromISO(`${normalizedDate}T${normalizedTime}`, { zone });

  if (!parsed.isValid) {
    return null;
  }

  return parsed.toUTC().toISO();
}

export function extractBookingClockTime(
  value: string | null | undefined,
  timezone?: string | null,
): string | null {
  const normalized = normalizeTime(value);
  if (normalized) {
    return normalized;
  }

  const parsed = parseBookingDateTime(value, timezone);
  return parsed ? parsed.toFormat('HH:mm') : null;
}

export function getBookingClockMinutes(
  value: string | null | undefined,
  timezone?: string | null,
): number | null {
  const clockTime = extractBookingClockTime(value, timezone);
  return clockTime ? toMinutes(clockTime) : null;
}
