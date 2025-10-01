import { isReservationTime } from './types';

import type { ReservationTime } from './types';

export const MINUTES_PER_HOUR = 60;
export const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

export function normalizeTime(
  value: string | ReservationTime | null | undefined,
): ReservationTime | null {
  if (!value) return null;
  const raw = typeof value === 'string' ? value : (value as unknown as string);
  const trimmed = raw.trim();
  if (trimmed.length >= 5) {
    const candidate = trimmed.slice(0, 5);
    return isReservationTime(candidate) ? (candidate as ReservationTime) : null;
  }
  return isReservationTime(trimmed) ? (trimmed as ReservationTime) : null;
}

export function toMinutes(value: string | ReservationTime): number {
  const normalized = normalizeTime(value);
  if (!normalized) {
    throw new Error(`Invalid time value: ${value}`);
  }
  const [hours, minutes] = normalized.split(':').map(Number);
  return (hours || 0) * MINUTES_PER_HOUR + (minutes || 0);
}

export function fromMinutes(totalMinutes: number): ReservationTime {
  if (!Number.isFinite(totalMinutes)) {
    throw new Error(`Invalid minutes value: ${totalMinutes}`);
  }
  const clamped = ((totalMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = Math.floor(clamped / MINUTES_PER_HOUR)
    .toString()
    .padStart(2, '0');
  const minutes = Math.floor(clamped % MINUTES_PER_HOUR)
    .toString()
    .padStart(2, '0');
  return `${hours}:${minutes}` as ReservationTime;
}

export function clampMinutes(value: number, min = 0, max = MINUTES_PER_DAY): number {
  if (min > max) {
    throw new Error(`Invalid clamp range: min ${min} greater than max ${max}`);
  }
  return Math.min(Math.max(value, min), max);
}

export function minutesBetween(
  start: string | ReservationTime,
  end: string | ReservationTime,
): number {
  return toMinutes(end) - toMinutes(start);
}

export function createMinutesRange(
  start: string | ReservationTime,
  end: string | ReservationTime,
  stepMinutes: number,
): number[] {
  if (stepMinutes <= 0) {
    throw new Error(`Step minutes must be positive. Received ${stepMinutes}`);
  }
  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);
  const result: number[] = [];
  for (let minutes = startMinutes; minutes < endMinutes; minutes += stepMinutes) {
    result.push(minutes);
  }
  return result;
}

export function slotsForRange(
  start: string | ReservationTime,
  end: string | ReservationTime,
  stepMinutes: number,
): ReservationTime[] {
  return createMinutesRange(start, end, stepMinutes).map((minutes) => fromMinutes(minutes));
}
