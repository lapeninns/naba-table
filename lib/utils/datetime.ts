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

function extractDateParts(date: Date, timeZone: string): DateParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return { year, month, day };
}

export function getDateInTimezone(date: Date, timeZone: string): string {
  const parts = extractDateParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function getTodayInTimezone(timeZone: string): string {
  return getDateInTimezone(new Date(), timeZone);
}

function toDateInstance(value: string | Date): Date {
  if (value instanceof Date) {
    return new Date(value.getTime());
  }
  return new Date(`${value}T00:00:00`);
}

export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateReadable(value: string | Date, timeZone: string): string {
  const date = toDateInstance(value);
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const parts = formatter.formatToParts(date);
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const year = parts.find((part) => part.type === "year")?.value ?? "";

  return [weekday, day, month, year].filter(Boolean).join(" ").trim();
}

export function formatTimeRange(start: string | null, end: string | null, timeZone: string): string {
  if (!start && !end) return "Time TBC";

  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  });

  const withTime = (time: string | null) => {
    if (!time) return null;
    const [hours, minutes] = time.split(":");
    const date = new Date();
    date.setHours(Number.parseInt(hours ?? "0", 10), Number.parseInt(minutes ?? "0", 10), 0, 0);
    return formatter.format(date);
  };

  const startLabel = withTime(start) ?? "Time TBC";
  const endLabel = withTime(end);

  return endLabel ? `${startLabel} – ${endLabel}` : startLabel;
}
