import { reservationConfigResult } from '@reserve/shared/config/reservations';
import { normalizeTime } from '@reserve/shared/time';
import { BOOKING_TYPES_UI } from '@shared/config/booking';

import type { BookingOption } from '@reserve/shared/booking';
import type { ReservationDate, ReservationTime } from '@reserve/shared/time';

const formatterCache = new Map<string, Intl.DateTimeFormat>();

const BASE_LABELS: Record<BookingOption, string> = {
  lunch: 'Lunch',
  dinner: 'Dinner',
  drinks: 'Drinks & cocktails',
};

type FormattingOptions = {
  timezone?: string;
};

function resolveTimezone(override?: string): string {
  const candidate = override?.trim();
  if (candidate) {
    return candidate;
  }
  return reservationConfigResult.config.timezone ?? 'Europe/London';
}

function getFormatter(
  cacheKey: string,
  options: Intl.DateTimeFormatOptions,
  timezoneOverride?: string,
): Intl.DateTimeFormat {
  const timezone = resolveTimezone(timezoneOverride);
  const key = `${cacheKey}:${timezone}`;
  const existing = formatterCache.get(key);
  if (existing) return existing;
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    ...options,
  });
  formatterCache.set(key, formatter);
  return formatter;
}

const toDateString = (value: string | ReservationDate | null | undefined): string | null => {
  if (!value) return null;
  return typeof value === 'string' ? value : String(value);
};

export function formatBookingLabel(option: BookingOption): string {
  if (BASE_LABELS[option]) {
    return BASE_LABELS[option];
  }
  if ((BOOKING_TYPES_UI as readonly string[]).includes(option)) {
    return option.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }
  return option;
}

export function formatReservationDate(
  value: string | ReservationDate | null | undefined,
  options?: FormattingOptions,
): string {
  const date = toDateString(value);
  if (!date) return '';
  try {
    const formatter = getFormatter(
      'reservation-date',
      {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      },
      options?.timezone,
    );
    const parts = formatter.formatToParts(new Date(`${date}T00:00:00Z`));
    const weekday = parts.find((part) => part.type === 'weekday')?.value ?? '';
    const day = parts.find((part) => part.type === 'day')?.value ?? '';
    const month = parts.find((part) => part.type === 'month')?.value ?? '';
    const year = parts.find((part) => part.type === 'year')?.value ?? '';
    const body = [day, month, year].filter(Boolean).join(' ');
    return [weekday, body].filter(Boolean).join(', ');
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[formatReservationDate] failed to format date', { value, error });
    }
    return '';
  }
}

export function formatReservationDateShort(
  value: string | ReservationDate | null | undefined,
  options?: FormattingOptions,
): string {
  const date = toDateString(value);
  if (!date) return '';
  try {
    const formatter = getFormatter(
      'reservation-date-short',
      {
        weekday: 'short',
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      },
      options?.timezone,
    );
    return formatter.format(new Date(`${date}T00:00:00Z`));
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[formatReservationDateShort] failed to format date', { value, error });
    }
    return '';
  }
}

export function formatReservationTime(
  value: string | ReservationTime | null | undefined,
  _options?: FormattingOptions,
): string {
  const normalized = normalizeTime(value);
  if (!normalized) return '';
  const [hours = '00', minutes = '00'] = normalized.split(':');
  return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
}

export function formatReservationTimeFromDate(date: Date, options?: FormattingOptions): string {
  try {
    const formatter = getFormatter(
      'reservation-time-date',
      {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      },
      options?.timezone,
    );
    return formatter.format(date);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[formatReservationTimeFromDate] failed to format date instance', {
        date,
        error,
      });
    }
    return '';
  }
}

export function formatReservationSummaryDate(
  value: string | ReservationDate | null | undefined,
  options?: FormattingOptions,
): string {
  const date = toDateString(value);
  if (!date) return '';
  try {
    const formatter = getFormatter(
      'reservation-summary-date',
      {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      },
      options?.timezone,
    );
    const parts = formatter.formatToParts(new Date(`${date}T00:00:00Z`));
    const month = parts.find((part) => part.type === 'month')?.value ?? '';
    const day = parts.find((part) => part.type === 'day')?.value ?? '';
    const year = parts.find((part) => part.type === 'year')?.value ?? '';
    return [month, day, year].filter(Boolean).join(' ').trim();
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[formatReservationSummaryDate] failed to format date', { value, error });
    }
    return '';
  }
}

export function formatDateForInput(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
