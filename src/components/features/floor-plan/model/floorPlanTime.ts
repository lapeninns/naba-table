import { DateTime } from 'luxon';

export const MINUTE_MS = 60_000;

export function parseIsoMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = DateTime.fromISO(value, { setZone: true });
  return parsed.isValid ? parsed.toMillis() : null;
}

/** "19:05" in the restaurant's timezone. */
export function formatClock(ms: number, timezone: string): string {
  return DateTime.fromMillis(ms, { zone: timezone }).toFormat('HH:mm');
}

export function formatHour(ms: number, timezone: string): string {
  return DateTime.fromMillis(ms, { zone: timezone }).toFormat('HH');
}

/** "1h 5m", "45m". Negative input is treated as zero. */
export function formatDuration(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / MINUTE_MS));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export function minutesBetween(fromMs: number, toMs: number): number {
  return Math.round((toMs - fromMs) / MINUTE_MS);
}

/** "Fri 25 Sep" */
export function formatShortDate(date: string): string {
  return DateTime.fromISO(date).toFormat('ccc d LLL');
}

/** "Friday 25 September" */
export function formatLongDate(date: string): string {
  return DateTime.fromISO(date).toFormat('cccc d LLLL');
}

export function addDaysToDate(date: string, days: number): string {
  return DateTime.fromISO(date).plus({ days }).toISODate() ?? date;
}

export function todayInTimezone(nowMs: number, timezone: string): string {
  return DateTime.fromMillis(nowMs, { zone: timezone }).toISODate() ?? '';
}

export function roundToStep(ms: number, stepMinutes: number): number {
  const step = stepMinutes * MINUTE_MS;
  return Math.round(ms / step) * step;
}
