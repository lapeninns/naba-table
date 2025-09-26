import { cn as mergeClassNames } from "@/lib/utils";
import { BOOKING_TYPES_UI } from "@/lib/enums";

export const storageKeys = {
  contacts: "bookingflow-contacts",
};

export type BookingOption = (typeof BOOKING_TYPES_UI)[number];

const BOOKING_TYPE_LABELS: Record<BookingOption, string> = {
  lunch: "Lunch",
  dinner: "Dinner",
  drinks: "Drinks & cocktails",
};

export const bookingHelpers = {
  cn: (...inputs: Array<string | false | undefined | null>) => mergeClassNames(inputs.filter(Boolean)),
  isUKPhone(value: string) {
    return /^(?:\+44|44|0)7\d{9}$/.test(value.replace(/\s/g, ""));
  },
  isEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  },
  formatDate(date: string) {
    if (!date) return "";

    const formatter = new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Europe/London",
    });

    const parts = formatter.formatToParts(new Date(`${date}T00:00:00Z`));
    const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
    const day = parts.find((part) => part.type === "day")?.value ?? "";
    const month = parts.find((part) => part.type === "month")?.value ?? "";
    const year = parts.find((part) => part.type === "year")?.value ?? "";

    const body = [day, month, year].filter(Boolean).join(" ");
    return [weekday, body].filter(Boolean).join(", ");
  },
  normalizeTime(value: string) {
    if (!value) return "";
    const trimmed = value.trim();
    if (trimmed.length >= 5) return trimmed.slice(0, 5);
    return trimmed;
  },
  formatTime(time: string) {
    const normalized = bookingHelpers.normalizeTime(time);
    if (!normalized) return "";
    return new Date(`1970-01-01T${normalized}:00`).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Europe/London",
    });
  },
  formatSummaryDate(date: string) {
    if (!date) return "";
    const parts = new Intl.DateTimeFormat("en-GB", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      timeZone: "Europe/London",
    }).formatToParts(new Date(`${date}T00:00:00Z`));
    const month = parts.find((part) => part.type === "month")?.value ?? "";
    const day = parts.find((part) => part.type === "day")?.value ?? "";
    const year = parts.find((part) => part.type === "year")?.value ?? "";
    return [month, day, year].filter(Boolean).join(" ").trim();
  },
  timeToMinutes(time: string) {
    const normalized = bookingHelpers.normalizeTime(time);
    if (!normalized) return 0;
    const [hours, minutes] = normalized.split(":").map(Number);
    return (hours || 0) * 60 + (minutes || 0);
  },
  slotsForRange(start: string = "12:00", end: string = "22:00", step: number = 30) {
    const out: string[] = [];
    let cursor = new Date(`1970-01-01T${start}:00`);
    const endDt = new Date(`1970-01-01T${end}:00`);
    while (cursor < endDt) {
      out.push(cursor.toTimeString().slice(0, 5));
      cursor = new Date(cursor.getTime() + step * 60000);
    }
    return out;
  },
  serviceWindows(dateStr: string) {
    const baseDate = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
    const day = baseDate.getDay();
    const isWeekend = day === 0 || day === 6; // Sunday or Saturday
    const close = "23:00";

    const lunchEnd = isWeekend ? "17:00" : "15:00";
    const happyHour: { start: string; end: string } | null = isWeekend
      ? null
      : { start: "15:00", end: "17:00" };

    const lunch: { start: string; end: string } = { start: "12:00", end: lunchEnd };
    const dinner: { start: string; end: string } = { start: "17:00", end: close };
    const drinks: { start: string; end: string } = { start: "12:00", end: close };

    return { lunch, dinner, drinks, happyHour };
  },
  slotsByService(dateStr: string) {
    const windows = bookingHelpers.serviceWindows(dateStr);
    return {
      lunch: bookingHelpers.slotsForRange(windows.lunch.start, windows.lunch.end),
      dinner: bookingHelpers.slotsForRange(windows.dinner.start, windows.dinner.end),
      drinks: bookingHelpers.slotsForRange(windows.drinks.start, windows.drinks.end),
    } satisfies Record<BookingOption, string[]>;
  },
  bookingTypeFromTime(time: string, dateStr: string): BookingOption {
    const windows = bookingHelpers.serviceWindows(dateStr);
    const minutes = bookingHelpers.timeToMinutes(time);
    const inRange = (window: { start: string; end: string }) => {
      const startMinutes = bookingHelpers.timeToMinutes(window.start);
      const endMinutes = bookingHelpers.timeToMinutes(window.end);
      return minutes >= startMinutes && minutes < endMinutes;
    };

    if (windows.happyHour && inRange(windows.happyHour)) return "drinks";
    if (inRange(windows.lunch)) return "lunch";
    if (inRange(windows.dinner)) return "dinner";

    return minutes >= bookingHelpers.timeToMinutes(windows.dinner.start) ? "dinner" : "lunch";
  },
  formatForDateInput(value: Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  },
  formatBookingLabel(type: BookingOption) {
    return BOOKING_TYPE_LABELS[type] ?? type.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  },
};

export type BookingHelpers = typeof bookingHelpers;
