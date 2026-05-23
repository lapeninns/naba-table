import { DateTime } from 'luxon';

import { normalizeTime } from '@reserve/shared/time';

export type DateParts = {
  date: string | null;
  time: string | null;
};

export const toStartOfDay = (value: Date): Date => {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
};

export const extractDateParts = (
  iso: string | null | undefined,
  targetTimezone: string,
): DateParts => {
  if (!iso) {
    return { date: null, time: null };
  }
  const parsed = DateTime.fromISO(iso, { zone: 'utc' });
  if (!parsed.isValid) {
    return { date: null, time: null };
  }
  const zoned = parsed.setZone(targetTimezone, { keepLocalTime: false });
  return {
    date: zoned.toISODate(),
    time: zoned.toFormat('HH:mm'),
  };
};

export const toIsoString = (date: string, time: string, timezone: string): string | null => {
  const normalized = normalizeTime(time);
  if (!normalized) {
    return null;
  }
  const combined = DateTime.fromISO(`${date}T${normalized}`, { zone: timezone });
  if (!combined.isValid) {
    return null;
  }
  return combined.toUTC().toISO();
};
