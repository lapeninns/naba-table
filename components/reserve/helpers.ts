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
    return new Date(date).toLocaleDateString("en-GB", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Europe/London",
    });
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
    const day = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
    const isWeekend = day === 5 || day === 6;
    const isSunday = day === 0;

    const lunch: { start: string; end: string } = isWeekend
      ? { start: "11:30", end: "16:00" }
      : isSunday
        ? { start: "11:30", end: "15:30" }
        : { start: "12:00", end: "15:30" };

    const dinner: { start: string; end: string } = isWeekend
      ? { start: "18:00", end: "23:00" }
      : isSunday
        ? { start: "17:30", end: "21:30" }
        : { start: "17:30", end: "22:00" };

    const drinks: { start: string; end: string } = isWeekend
      ? { start: "15:00", end: "23:00" }
      : { start: "15:00", end: "22:30" };

    return { lunch, dinner, drinks };
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

    if (inRange(windows.lunch)) return "lunch";
    if (inRange(windows.dinner)) return "dinner";
    if (inRange(windows.drinks)) return "drinks";

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
