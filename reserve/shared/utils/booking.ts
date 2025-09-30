import { BOOKING_TYPES_UI } from '@shared/config/booking';
import { cn } from '@shared/lib/cn';

import type { SeatingPreference } from '@shared/config/booking';

export const storageKeys = {
  contacts: 'bookingflow-contacts',
};

export type BookingOption = (typeof BOOKING_TYPES_UI)[number];

const BOOKING_TYPE_LABELS: Record<BookingOption, string> = {
  lunch: 'Lunch',
  dinner: 'Dinner',
  drinks: 'Drinks & cocktails',
};

for (const type of BOOKING_TYPES_UI) {
  if (!BOOKING_TYPE_LABELS[type as BookingOption]) {
    BOOKING_TYPE_LABELS[type as BookingOption] = type
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
}

const EUROPE_LONDON = 'Europe/London';

const toDate = (date: string, time: string) => new Date(`${date}T${time}:00`);

const formatWithIntl = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: EUROPE_LONDON, ...options });

const normalizeTime = (value: string) => {
  if (!value) return '';
  const trimmed = value.trim();
  return trimmed.length >= 5 ? trimmed.slice(0, 5) : trimmed;
};

const timeToMinutes = (time: string) => {
  const normalized = normalizeTime(time);
  if (!normalized) return 0;
  const [hours, minutes] = normalized.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

const slotsForRange = (start = '12:00', end = '22:00', step = 30) => {
  const slots: string[] = [];
  let cursor = toDate('1970-01-01', start);
  const endDate = toDate('1970-01-01', end);
  while (cursor < endDate) {
    slots.push(cursor.toTimeString().slice(0, 5));
    cursor = new Date(cursor.getTime() + step * 60_000);
  }
  return slots;
};

const serviceWindows = (dateStr: string) => {
  const baseDate = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
  const day = baseDate.getDay();
  const isWeekend = day === 0 || day === 6;
  const close = '23:00';

  const lunchEnd = isWeekend ? '17:00' : '15:00';
  const happyHour = isWeekend ? null : ({ start: '15:00', end: '17:00' } as const);

  const lunch = { start: '12:00', end: lunchEnd } as const;
  const dinner = { start: '17:00', end: close } as const;
  const drinks = { start: '12:00', end: close } as const;

  return { lunch, dinner, drinks, happyHour };
};

const formatBookingLabel = (type: BookingOption) =>
  BOOKING_TYPE_LABELS[type] ??
  type.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

export const bookingHelpers = {
  cn,
  normalizeTime,
  timeToMinutes,
  slotsForRange,
  serviceWindows,
  formatBookingLabel,
  isUKPhone(value: string) {
    return /^(?:\+44|44|0)7\d{9}$/.test(value.replace(/\s/g, ''));
  },
  isEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  },
  formatDate(date: string) {
    if (!date) return '';
    const formatter = formatWithIntl({
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const parts = formatter.formatToParts(new Date(`${date}T00:00:00Z`));
    const weekday = parts.find((part) => part.type === 'weekday')?.value ?? '';
    const day = parts.find((part) => part.type === 'day')?.value ?? '';
    const month = parts.find((part) => part.type === 'month')?.value ?? '';
    const year = parts.find((part) => part.type === 'year')?.value ?? '';

    const body = [day, month, year].filter(Boolean).join(' ');
    return [weekday, body].filter(Boolean).join(', ');
  },
  formatTime(time: string) {
    const normalized = normalizeTime(time);
    if (!normalized) return '';
    const formatter = formatWithIntl({
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return formatter.format(toDate('1970-01-01', normalized));
  },
  formatSummaryDate(date: string) {
    if (!date) return '';
    const formatter = formatWithIntl({
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    });
    const parts = formatter.formatToParts(new Date(`${date}T00:00:00Z`));
    const month = parts.find((part) => part.type === 'month')?.value ?? '';
    const day = parts.find((part) => part.type === 'day')?.value ?? '';
    const year = parts.find((part) => part.type === 'year')?.value ?? '';
    return [month, day, year].filter(Boolean).join(' ').trim();
  },
  slotsByService(dateStr: string) {
    const windows = serviceWindows(dateStr);
    return {
      lunch: slotsForRange(windows.lunch.start, windows.lunch.end),
      dinner: slotsForRange(windows.dinner.start, windows.dinner.end),
      drinks: slotsForRange(windows.drinks.start, windows.drinks.end),
    } satisfies Record<BookingOption, string[]>;
  },
  bookingTypeFromTime(time: string, dateStr: string): BookingOption {
    const windows = serviceWindows(dateStr);
    const minutes = timeToMinutes(time);
    const inRange = (window: { start: string; end: string }) => {
      const startMinutes = timeToMinutes(window.start);
      const endMinutes = timeToMinutes(window.end);
      return minutes >= startMinutes && minutes < endMinutes;
    };

    if (windows.happyHour && inRange(windows.happyHour)) return 'drinks';
    if (inRange(windows.lunch)) return 'lunch';
    if (inRange(windows.dinner)) return 'dinner';
    return minutes >= timeToMinutes(windows.dinner.start) ? 'dinner' : 'lunch';
  },
  formatForDateInput(value: Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },
};

export type BookingHelpers = typeof bookingHelpers;

export type BookingServiceWindows = ReturnType<typeof bookingHelpers.serviceWindows>;
export type BookingSlotsByService = ReturnType<typeof bookingHelpers.slotsByService>;

export type BookingTimeWindow = {
  start: string;
  end: string;
};

export type SeatingOption = SeatingPreference;
