import { DateTime } from 'luxon';

export const DEFAULT_OPS_BOOKINGS_WINDOW_MINUTES = 90;

export type OpsDateRange = {
  date: string;
  from: string;
  to: string;
  timezone?: string | null;
};

export function sanitizeTimeParam(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!/^\d{2}:\d{2}$/.test(trimmed)) return null;
  const [hours, minutes] = trimmed.split(':').map((part) => Number(part));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return trimmed;
}

export function buildOpsDateRange(date: string | null | undefined, timezone?: string | null): OpsDateRange | null {
  if (!date) return null;

  const trimmed = date.trim();
  if (trimmed.length === 0) return null;

  const zone = timezone ?? 'UTC';
  const dt = DateTime.fromISO(trimmed, { zone });
  if (!dt.isValid) return null;

  const start = dt.startOf('day').toUTC();
  const end = start.plus({ days: 1 });

  const fromIso = start.toISO();
  const toIso = end.toISO();

  if (!fromIso || !toIso) return null;

  return {
    date: dt.toFormat('yyyy-LL-dd'),
    from: fromIso,
    to: toIso,
    timezone,
  };
}

export function buildOpsTimeWindowRange(
  date: string | null | undefined,
  time: string | null | undefined,
  windowMinutes: number = DEFAULT_OPS_BOOKINGS_WINDOW_MINUTES,
  timezone?: string | null,
): OpsDateRange | null {
  if (!date) return null;

  const trimmedDate = date.trim();
  if (trimmedDate.length === 0) return null;

  const sanitizedTime = sanitizeTimeParam(time);
  if (!sanitizedTime) return null;

  const zone = timezone ?? 'UTC';
  const dt = DateTime.fromISO(`${trimmedDate}T${sanitizedTime}`, { zone });
  if (!dt.isValid) return null;

  const start = dt.minus({ minutes: windowMinutes }).toUTC();
  const end = dt.plus({ minutes: windowMinutes }).toUTC();

  const fromIso = start.toISO();
  const toIso = end.toISO();

  if (!fromIso || !toIso) return null;

  return {
    date: dt.toFormat('yyyy-LL-dd'),
    from: fromIso,
    to: toIso,
    timezone,
  };
}
