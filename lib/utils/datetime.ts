import { DateTime } from 'luxon';

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_TIME_ZONE = 'UTC';

export function isoToLocalInput(iso?: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const tzOffset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - tzOffset * 60000);
  return localDate.toISOString().slice(0, 16);
}

export function localInputToIso(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

type DateParts = {
  year: string;
  month: string;
  day: string;
};

function resolveDateTime(value: string | Date, timeZone: string): DateTime | null {
  if (value instanceof Date) {
    const parsed = DateTime.fromJSDate(value).setZone(timeZone);
    return parsed.isValid ? parsed : null;
  }

  if (DATE_KEY_PATTERN.test(value)) {
    const parsed = DateTime.fromISO(value, { zone: timeZone });
    return parsed.isValid ? parsed : null;
  }

  const parsed = DateTime.fromISO(value, { setZone: true }).setZone(timeZone);
  return parsed.isValid ? parsed : null;
}

function extractDateParts(date: Date, timeZone: string): DateParts {
  const parsed = resolveDateTime(date, timeZone);
  if (!parsed) {
    return { year: "0000", month: "01", day: "01" };
  }

  return {
    year: parsed.toFormat("yyyy"),
    month: parsed.toFormat("MM"),
    day: parsed.toFormat("dd"),
  };
}

export function getDateInTimezone(date: Date, timeZone: string): string {
  const parts = extractDateParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function getTodayInTimezone(timeZone: string): string {
  return DateTime.now().setZone(timeZone || DEFAULT_TIME_ZONE).toISODate() ?? getDateInTimezone(new Date(), timeZone);
}

export function dateKeyToCalendarDate(value?: string | null): Date | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = DateTime.fromISO(value, { zone: DEFAULT_TIME_ZONE });
  if (!parsed.isValid) {
    return undefined;
  }

  return new Date(parsed.year, parsed.month - 1, parsed.day, 12);
}

export function shiftDateKey(value: string, days: number): string | null {
  const parsed = DateTime.fromISO(value, { zone: DEFAULT_TIME_ZONE });
  if (!parsed.isValid) {
    return null;
  }
  return parsed.plus({ days }).toISODate();
}

export function getDayOfWeekFromDateKey(value: string): number | null {
  const parsed = DateTime.fromISO(value, { zone: DEFAULT_TIME_ZONE });
  if (!parsed.isValid) {
    return null;
  }
  return parsed.weekday % 7;
}

export function formatDateKey(date: Date): string {
  const parsed = DateTime.fromJSDate(date);
  return parsed.isValid ? parsed.toFormat("yyyy-MM-dd") : "";
}

export function formatDateReadable(value: string | Date, timeZone: string): string {
  const parsed = resolveDateTime(value, timeZone || DEFAULT_TIME_ZONE);
  return parsed ? parsed.setLocale("en-GB").toFormat("cccc d LLLL yyyy") : "";
}

export function formatDateReadableShort(value: string | Date, timeZone: string): string {
  const parsed = resolveDateTime(value, timeZone || DEFAULT_TIME_ZONE);
  return parsed ? parsed.setLocale("en-GB").toFormat("ccc d LLL yyyy") : "";
}

export function formatTimeRange(start: string | null, end: string | null, timeZone: string): string {
  if (!start && !end) return "Time TBC";
  const zone = timeZone || DEFAULT_TIME_ZONE;

  const withTime = (time: string | null) => {
    if (!time) return null;
    const parsed = DateTime.fromISO(`2000-01-01T${time}`, { zone });
    return parsed.isValid ? parsed.setLocale("en-GB").toFormat("HH:mm") : null;
  };

  const startLabel = withTime(start) ?? "Time TBC";
  const endLabel = withTime(end);

  return endLabel ? `${startLabel} – ${endLabel}` : startLabel;
}
