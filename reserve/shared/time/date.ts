import { toMinutes } from './time';
import { isReservationDate } from './types';

import type { ReservationDate, ReservationTime } from './types';

export const LONDON_TIME_ZONE = 'Europe/London';

export function parseReservationDate(value: string | ReservationDate): ReservationDate {
  if (typeof value === 'string' && !isReservationDate(value)) {
    throw new Error(`Invalid reservation date: ${value}`);
  }
  return value as ReservationDate;
}

export function toDateMidnight(value: string | ReservationDate): Date {
  const date = parseReservationDate(value);
  return new Date(`${date}T00:00:00`);
}

export function createDateFromParts(
  date: string | ReservationDate,
  time: string | ReservationTime,
): Date {
  const normalizedDate = parseReservationDate(date);
  const minutes = toMinutes(time);
  const [hours, mins] = [Math.floor(minutes / 60), minutes % 60];
  const result = new Date(`${normalizedDate}T00:00:00`);
  result.setHours(hours, mins, 0, 0);
  return result;
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function getDayKey(date: string | ReservationDate | Date): number {
  if (date instanceof Date) return date.getDay();
  return toDateMidnight(date).getDay();
}
