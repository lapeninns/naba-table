import {
  RESERVATION_INTERVAL_MAX,
  RESERVATION_INTERVAL_MIN,
} from '@/lib/restaurants/reservation-interval';
import { normalizeTime } from '@reserve/shared/time';

export function canonicalizeRequiredTime(value: string): string {
  const normalized = normalizeTime(value);
  if (normalized) {
    return normalized;
  }
  const trimmed = value.trim();
  return trimmed.length >= 5 ? trimmed.slice(0, 5) : trimmed;
}

export function toInputTime(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  return canonicalizeRequiredTime(value);
}

export function toComparableTime(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const normalized = normalizeTime(value);
  if (normalized) {
    return normalized;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.length >= 5 ? trimmed.slice(0, 5) : trimmed;
}

export function parseIntervalInput(value: string): { value: number | null; error?: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { value: null };
  }
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed)) {
    return { value: null, error: 'Must be a whole number' };
  }
  if (parsed < RESERVATION_INTERVAL_MIN || parsed > RESERVATION_INTERVAL_MAX) {
    return {
      value: null,
      error: `Must be between ${RESERVATION_INTERVAL_MIN}-${RESERVATION_INTERVAL_MAX}`,
    };
  }
  return { value: parsed };
}

export function parseSlotTimesInput(value: string): { value: string[] | null; error?: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { value: null };
  }
  const parts = trimmed
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return { value: null };
  }
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const time = normalizeTime(part);
    if (!time) {
      return { value: null, error: 'Use HH:MM format (e.g. 16:00)' };
    }
    if (!seen.has(time)) {
      seen.add(time);
      normalized.push(time);
    }
  }
  return { value: normalized };
}

export function formatKitchenRange(start?: string | null, end?: string | null): string {
  if (!start || !end) {
    return 'Not set';
  }
  return `${start} – ${end}`;
}
