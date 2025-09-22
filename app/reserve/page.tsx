"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { track } from "@/lib/analytics";
import {
  BOOKING_TYPES_UI,
  SEATING_PREFERENCES_UI,
  type BookingType,
  type SeatingPreference,
} from "@/lib/enums";
import { DEFAULT_RESTAURANT_ID, DEFAULT_VENUE } from "@/lib/venue";

// =============================================================================================
// ICONS (using lucide-react conventions for consistency with shadcn/ui)
// =============================================================================================
const Icon = {
  Calendar: (p: React.SVGProps<SVGSVGElement>) => (
    <svg
      {...p}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </svg>
  ),
  Users: (p: React.SVGProps<SVGSVGElement>) => (
    <svg
      {...p}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="m18 8-3.49 3.5" />
    </svg>
  ),
  Clock: (p: React.SVGProps<SVGSVGElement>) => (
    <svg
      {...p}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  ),
  Utensils: (p: React.SVGProps<SVGSVGElement>) => (
    <svg
      {...p}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
      <path d="M7 2v20" />
      <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3z" />
    </svg>
  ),
  Chair: (p: React.SVGProps<SVGSVGElement>) => (
    <svg
      {...p}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6" />
      <path d="M18 12h-2V7a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v5H5" />
      <path d="M4 20h16" />
    </svg>
  ),
  Info: (p: React.SVGProps<SVGSVGElement>) => (
    <svg
      {...p}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  ),
  Check: (p: React.SVGProps<SVGSVGElement>) => (
    <svg
      {...p}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  CheckCircle: (p: React.SVGProps<SVGSVGElement>) => (
    <svg
      {...p}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  ),
  AlertCircle: (p: React.SVGProps<SVGSVGElement>) => (
    <svg
      {...p}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  ),
  ChevronLeft: (p: React.SVGProps<SVGSVGElement>) => (
    <svg
      {...p}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  ),
  ChevronDown: (p: React.SVGProps<SVGSVGElement>) => (
    <svg
      {...p}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  ),
  Pencil: (p: React.SVGProps<SVGSVGElement>) => (
    <svg
      {...p}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  ),
  Trash2: (p: React.SVGProps<SVGSVGElement>) => (
    <svg
      {...p}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  ),
  Spinner: (p: React.SVGProps<SVGSVGElement>) => (
    <svg
      {...p}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  ),
};

// =============================================================================================
// UTILITIES
// =============================================================================================
const storageKeys = {
  contacts: "bookingflow-contacts",
};

type BookingOption = (typeof BOOKING_TYPES_UI)[number];

const BOOKING_TYPE_LABELS: Record<BookingOption, string> = {
  lunch: "Lunch",
  dinner: "Dinner",
  drinks: "Drinks & cocktails",
};

const U = {
  cn: (...inputs: Array<string | false | undefined | null>) => inputs.filter(Boolean).join(" "),
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
    const normalized = U.normalizeTime(time);
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
    const normalized = U.normalizeTime(time);
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
    const windows = U.serviceWindows(dateStr);
    return {
      lunch: U.slotsForRange(windows.lunch.start, windows.lunch.end),
      dinner: U.slotsForRange(windows.dinner.start, windows.dinner.end),
      drinks: U.slotsForRange(windows.drinks.start, windows.drinks.end),
    } satisfies Record<BookingOption, string[]>;
  },
  bookingTypeFromTime(time: string, dateStr: string): BookingOption {
    const windows = U.serviceWindows(dateStr);
    const minutes = U.timeToMinutes(time);
    const inRange = (window: { start: string; end: string }) => {
      const startMinutes = U.timeToMinutes(window.start);
      const endMinutes = U.timeToMinutes(window.end);
      return minutes >= startMinutes && minutes < endMinutes;
    };

    if (inRange(windows.lunch)) return "lunch";
    if (inRange(windows.dinner)) return "dinner";
    if (inRange(windows.drinks)) return "drinks";

    return minutes >= U.timeToMinutes(windows.dinner.start) ? "dinner" : "lunch";
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

// =============================================================================================
// SHADCN-LIKE COMPONENT MOCKS (for single-file portability)
// =============================================================================================
type ButtonVariant = "default" | "destructive" | "outline" | "ghost";
type ButtonSize = "default" | "sm" | "lg";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      className={U.cn(
        "flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = "Input";

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", type, ...props }, ref) => {
    const variants: Record<ButtonVariant, string> = {
      default: "bg-slate-900 text-white hover:bg-slate-700",
      destructive: "bg-red-500 text-white hover:bg-red-600",
      outline: "border border-slate-300 bg-transparent hover:bg-slate-100",
      ghost: "hover:bg-slate-100",
    };
    const sizes: Record<ButtonSize, string> = {
      default: "h-10 px-4 py-2",
      sm: "h-9 rounded-md px-3",
      lg: "h-11 rounded-md px-8",
    };
    return (
      <button
        className={U.cn(
          "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none",
          variants[variant],
          sizes[size],
          className,
        )}
        ref={ref}
        type={type ?? "button"}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={U.cn("rounded-xl border bg-white text-slate-900 shadow", className)} {...props} />
);
const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={U.cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
);
const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className, ...props }) => (
  <h3 className={U.cn("font-semibold leading-none tracking-tight", className)} {...props} />
);
const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ className, ...props }) => (
  <p className={U.cn("text-sm text-slate-500", className)} {...props} />
);
const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={U.cn("p-6 pt-0", className)} {...props} />
);
const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={U.cn("flex items-center p-6 pt-0", className)} {...props} />
);

const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      className={U.cn("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className)}
      ref={ref}
      {...props}
    />
  ),
);
Label.displayName = "Label";

const Checkbox = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      type="checkbox"
      ref={ref}
      className={U.cn(
        "h-4 w-4 shrink-0 rounded-sm border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Checkbox.displayName = "Checkbox";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      className={U.cn(
        "flex min-h-[80px] w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

const AlertDialog: React.FC<{
  open: boolean;
  onOpenChange: React.Dispatch<React.SetStateAction<boolean>>;
  onConfirm: () => void;
  title: string;
  description: string;
}> = ({ open, onOpenChange, onConfirm, title, description }) => {
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (open && confirmRef.current) {
      confirmRef.current.focus();
    }
  }, [open]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={() => onOpenChange(false)}
      role="presentation"
    >
      <div
        className="relative m-4 w-full max-w-md rounded-lg bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <div className="p-6">
          <h3 id="alert-dialog-title" className="text-lg font-semibold">
            {title}
          </h3>
          <p id="alert-dialog-description" className="mt-2 text-sm text-slate-600">
            {description}
          </p>
        </div>
        <div className="flex justify-end gap-2 rounded-b-lg bg-slate-50 px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button ref={confirmRef} variant="destructive" onClick={onConfirm}>
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
};

// =============================================================================================
// STATE TYPES & HELPERS
// =============================================================================================
type SeatingOption = (typeof SEATING_PREFERENCES_UI)[number];

type ApiBooking = {
  id: string;
  restaurant_id: string;
  table_id: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  reference: string;
  party_size: number;
  booking_type: BookingType;
  seating_preference: SeatingPreference;
  status: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  notes: string | null;
  marketing_opt_in: boolean;
  loyalty_points_awarded: number;
  created_at: string;
  updated_at: string;
};

/* eslint-disable no-unused-vars */
type BookingEditHandler = (booking: ApiBooking) => void;
type BookingMutationHandler = (booking: ApiBooking) => Promise<void> | void;
/* eslint-enable no-unused-vars */

type BookingDetails = {
  bookingId: string | null;
  restaurantId: string;
  date: string;
  time: string;
  party: number;
  bookingType: BookingOption;
  seating: SeatingOption;
  notes: string;
  name: string;
  email: string;
  phone: string;
  rememberDetails: boolean;
  agree: boolean;
  marketingOptIn: boolean;
};

type LastAction = "create" | "update" | "waitlist" | null;

type State = {
  step: 1 | 2 | 3 | 4;
  submitting: boolean;
  loading: boolean;
  error: string | null;
  editingId: string | null;
  lastAction: LastAction;
  waitlisted: boolean;
  allocationPending: boolean;
  bookings: ApiBooking[];
  details: BookingDetails;
  lastConfirmed: ApiBooking | null;
};

type Action =
  | { type: "SET_STEP"; step: State["step"] }
  | { type: "SET_FIELD"; key: keyof BookingDetails; value: BookingDetails[keyof BookingDetails] }
  | { type: "SET_SUBMITTING"; value: boolean }
  | { type: "SET_LOADING"; value: boolean }
  | { type: "SET_ERROR"; message: string | null }
  | { type: "SET_BOOKINGS"; bookings: ApiBooking[] }
  | {
      type: "SET_CONFIRMATION";
      payload: {
        bookings: ApiBooking[];
        booking: ApiBooking | null;
        lastAction: Exclude<LastAction, null>;
        waitlisted: boolean;
        allocationPending: boolean;
      };
    }
  | { type: "START_EDIT"; bookingId: string }
  | { type: "RESET_FORM" }
  | {
      type: "HYDRATE_CONTACTS";
      payload: Pick<BookingDetails, "name" | "email" | "phone"> & { rememberDetails?: boolean };
    };

const BOOKING_OPTIONS_SET = new Set<BookingOption>(BOOKING_TYPES_UI);
const SEATING_OPTIONS_SET = new Set<SeatingOption>(SEATING_PREFERENCES_UI);

function toBookingOption(value: BookingType): BookingOption {
  return BOOKING_OPTIONS_SET.has(value as BookingOption) ? (value as BookingOption) : BOOKING_TYPES_UI[0];
}

function toSeatingOption(value: SeatingPreference): SeatingOption {
  if (SEATING_OPTIONS_SET.has(value as SeatingOption)) {
    return value as SeatingOption;
  }
  if (value === "window" || value === "booth" || value === "bar") {
    return "indoor";
  }
  return SEATING_PREFERENCES_UI[0];
}

const getInitialDetails = (): BookingDetails => ({
  bookingId: null,
  restaurantId: DEFAULT_RESTAURANT_ID,
  date: U.formatForDateInput(new Date()),
  time: "",
  party: 2,
  bookingType: BOOKING_TYPES_UI[0],
  seating: SEATING_PREFERENCES_UI[0],
  notes: "",
  name: "",
  email: "",
  phone: "",
  rememberDetails: false,
  agree: false,
  marketingOptIn: false,
});

const getInitialState = (): State => ({
  step: 1,
  submitting: false,
  loading: false,
  error: null,
  editingId: null,
  lastAction: null,
  waitlisted: false,
  allocationPending: false,
  bookings: [],
  details: getInitialDetails(),
  lastConfirmed: null,
});

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, step: action.step, error: null };
    case "SET_FIELD":
      return {
        ...state,
        error: null,
        details: {
          ...state.details,
          [action.key]: action.value,
        },
      };
    case "SET_SUBMITTING":
      return { ...state, submitting: action.value };
    case "SET_LOADING":
      return { ...state, loading: action.value };
    case "SET_ERROR":
      return { ...state, error: action.message };
    case "SET_BOOKINGS":
      return { ...state, bookings: action.bookings };
    case "SET_CONFIRMATION": {
      const { bookings, booking, lastAction, waitlisted, allocationPending } = action.payload;
      const updatedDetails = {
        ...state.details,
        bookingId: booking ? booking.id : null,
        restaurantId: booking ? booking.restaurant_id : state.details.restaurantId,
        date: booking ? booking.booking_date : state.details.date,
        time: booking ? U.normalizeTime(booking.start_time) : state.details.time,
        party: booking ? booking.party_size : state.details.party,
        bookingType: booking ? toBookingOption(booking.booking_type) : state.details.bookingType,
        seating: booking ? toSeatingOption(booking.seating_preference) : state.details.seating,
        notes: booking?.notes ?? state.details.notes,
        marketingOptIn: booking ? booking.marketing_opt_in : state.details.marketingOptIn,
      };

      return {
        ...state,
        step: 4,
        submitting: false,
        loading: false,
        editingId: null,
        bookings,
        lastAction,
        waitlisted,
        allocationPending,
        lastConfirmed: booking ?? state.lastConfirmed,
        details: updatedDetails,
        error: null,
      };
    }
    case "START_EDIT": {
      const booking = state.bookings.find((entry) => entry.id === action.bookingId);
      if (!booking) return state;
      return {
        ...state,
        step: 1,
        submitting: false,
        editingId: booking.id,
        lastAction: null,
        waitlisted: false,
        error: null,
        details: {
          ...state.details,
          bookingId: booking.id,
          restaurantId: booking.restaurant_id,
          date: booking.booking_date,
          time: U.normalizeTime(booking.start_time),
          party: booking.party_size,
          bookingType: toBookingOption(booking.booking_type),
          seating: toSeatingOption(booking.seating_preference),
          notes: booking.notes ?? "",
          name: booking.customer_name,
          email: booking.customer_email,
          phone: booking.customer_phone,
          marketingOptIn: booking.marketing_opt_in,
        },
      };
    }
    case "RESET_FORM": {
      const base = getInitialDetails();
      const shouldRemember = state.details.rememberDetails;
      return {
        ...state,
        step: 1,
        submitting: false,
        loading: false,
        editingId: null,
        lastAction: null,
        waitlisted: false,
        allocationPending: false,
        error: null,
        details: {
          ...base,
          rememberDetails: shouldRemember,
          name: shouldRemember ? state.details.name : "",
          email: shouldRemember ? state.details.email : "",
          phone: shouldRemember ? state.details.phone : "",
        },
      };
    }
    case "HYDRATE_CONTACTS":
      return {
        ...state,
        details: {
          ...state.details,
          name: action.payload.name,
          email: action.payload.email,
          phone: action.payload.phone,
          rememberDetails: action.payload.rememberDetails ?? true,
        },
      };
    default:
      return state;
  }
};

// =============================================================================================
// FORM UI HELPERS
// =============================================================================================
const Field: React.FC<{
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  className?: string;
  children: React.ReactNode;
}> = ({ id, label, required, error, children, className }) => (
  <div className={U.cn("grid w-full items-center gap-1.5", className)}>
    <Label htmlFor={id} className="flex items-center">
      {label}
      {required && <span className="ml-1 text-red-500">*</span>}
    </Label>
    {children}
    {error && (
      <p className="flex items-center gap-1 text-sm text-red-600">
        <Icon.AlertCircle className="h-4 w-4" />
        {error}
      </p>
    )}
  </div>
);

const Step1: React.FC<{ state: State; dispatch: React.Dispatch<Action> }> = ({ state, dispatch }) => {
  const { date, time, party, bookingType, seating, notes } = state.details;

  const serviceSlots = useMemo(() => U.slotsByService(date), [date]);
  const diningSlots = useMemo(() => {
    const combined = [...serviceSlots.lunch, ...serviceSlots.dinner];
    return Array.from(new Set(combined));
  }, [serviceSlots]);
  const slots = useMemo(
    () => (bookingType === "drinks" ? serviceSlots.drinks : diningSlots),
    [bookingType, diningSlots, serviceSlots],
  );

  const slotTypeMap = useMemo(() => {
    const map = new Map<string, BookingOption>();
    serviceSlots.lunch.forEach((slot) => map.set(slot, "lunch"));
    serviceSlots.dinner.forEach((slot) => map.set(slot, "dinner"));
    serviceSlots.drinks.forEach((slot) => {
      if (!map.has(slot)) {
        map.set(slot, "drinks");
      }
    });
    return map;
  }, [serviceSlots]);

  const partyOptions = useMemo(() => Array.from({ length: 12 }, (_, index) => index + 1), []);

  const ensureAlignedBookingType = useCallback(
    (slot: string | undefined) => {
      if (!slot) return;
      const inferred = slotTypeMap.get(slot);
      if (inferred && inferred !== bookingType) {
        dispatch({ type: "SET_FIELD", key: "bookingType", value: inferred });
      }
    },
    [bookingType, dispatch, slotTypeMap],
  );

  const ensureTimeForType = useCallback(
    (targetType: BookingOption) => {
      const candidateSlots = targetType === "drinks" ? serviceSlots.drinks : diningSlots;
      if (!candidateSlots.length) {
        dispatch({ type: "SET_FIELD", key: "time", value: "" });
        return;
      }
      const preferredSlot = candidateSlots.includes(time) ? time : candidateSlots[0];
      if (preferredSlot && time !== preferredSlot) {
        dispatch({ type: "SET_FIELD", key: "time", value: preferredSlot });
        track("select_time", { time: preferredSlot });
      }
    },
    [diningSlots, dispatch, serviceSlots.drinks, time],
  );

  useEffect(() => {
    if (!slots.length) {
      if (time) {
        dispatch({ type: "SET_FIELD", key: "time", value: "" });
      }
      return;
    }

    if (!time || !slots.includes(time)) {
      const nextSlot = slots[0];
      ensureAlignedBookingType(nextSlot);
      if (time !== nextSlot && nextSlot) {
        dispatch({ type: "SET_FIELD", key: "time", value: nextSlot });
      }
      return;
    }

    if (bookingType !== "drinks") {
      ensureAlignedBookingType(time);
    }
  }, [bookingType, dispatch, ensureAlignedBookingType, slots, time]);

  const handleSlotSelect = (slot: string) => {
    if (!slot) return;
    ensureAlignedBookingType(slot);
    if (slot !== time) {
      dispatch({ type: "SET_FIELD", key: "time", value: slot });
      track("select_time", { time: slot });
    }
  };

  const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextDate = event.target.value;
    dispatch({ type: "SET_FIELD", key: "date", value: nextDate });
    if (nextDate) {
      track("select_date", { date: nextDate });
    }
  };

  const handlePartySelect = (nextParty: number) => {
    if (party === nextParty) return;
    dispatch({ type: "SET_FIELD", key: "party", value: nextParty });
    track("select_party", { party: nextParty });
  };

  const handleBookingTypeSelect = (nextType: BookingOption) => {
    if (nextType === bookingType) return;
    dispatch({ type: "SET_FIELD", key: "bookingType", value: nextType });
    ensureTimeForType(nextType);
  };

  const canContinue = Boolean(date && time && party > 0);

  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader className="space-y-3">
        <CardTitle className="text-2xl">
          {state.editingId ? "Modify booking details" : "Plan your visit"}
        </CardTitle>
        <CardDescription className="text-sm text-slate-600">
          Select a date, time, and group size to see available slots.
        </CardDescription>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          <span className="font-medium text-slate-900">Next step:</span> Choose a time to continue.
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <Field id="date" label="Date" required>
          <Input
            type="date"
            id="date"
            value={date}
            min={U.formatForDateInput(new Date())}
            onChange={handleDateChange}
          />
        </Field>

        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm font-medium text-slate-900">
            <Icon.Clock className="h-4 w-4" /> Time
          </Label>
          <p className="text-xs text-slate-500">Scroll horizontally to see more times.</p>
          <div className="flex snap-x gap-2 overflow-x-auto pb-2">
            {slots.length === 0 && (
              <span className="text-sm text-slate-500">No availability for this selection.</span>
            )}
            {slots.map((slot) => (
              <Button
                key={slot}
                variant={time === slot ? "default" : "outline"}
                className="min-w-[88px] justify-center rounded-full"
                onClick={() => handleSlotSelect(slot)}
              >
                {U.formatTime(slot)}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium text-slate-900">Guests</Label>
          <div className="flex snap-x gap-2 overflow-x-auto pb-2">
            {partyOptions.map((option) => (
              <Button
                key={option}
                variant={party === option ? "default" : "outline"}
                className="min-w-[64px] justify-center rounded-full"
                onClick={() => handlePartySelect(option)}
              >
                {option}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium text-slate-900">Service</Label>
          <div className="flex flex-wrap gap-2">
            {BOOKING_TYPES_UI.map((option) => (
              <Button
                key={option}
                variant={bookingType === option ? "default" : "outline"}
                size="sm"
                className="rounded-full"
                onClick={() => handleBookingTypeSelect(option)}
              >
                {U.formatBookingLabel(option)}
              </Button>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            Drinks reservations show bar availability; lunch and dinner align to table service.
          </p>
        </div>

        <details className="group rounded-lg border border-slate-200 bg-slate-50 p-4">
          <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-slate-900">
            Additional preferences
            <Icon.ChevronDown className="h-5 w-5 transition group-open:rotate-180" />
          </summary>
          <div className="mt-4 space-y-6">
            <Field id="seating" label="Seating preference">
              <div className="flex flex-wrap gap-2">
                {SEATING_PREFERENCES_UI.map((option) => (
                  <Button
                    key={option}
                    variant={seating === option ? "default" : "outline"}
                    size="sm"
                    className="rounded-full"
                    onClick={() => dispatch({ type: "SET_FIELD", key: "seating", value: option })}
                  >
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </Button>
                ))}
              </div>
            </Field>
            <Field id="notes" label="Notes (optional)">
              <Textarea
                id="notes"
                value={notes}
                onChange={(event) => dispatch({ type: "SET_FIELD", key: "notes", value: event.target.value })}
                placeholder="e.g., birthday celebration, dietary requirements"
              />
            </Field>
          </div>
        </details>
      </CardContent>
      <CardFooter className="sticky bottom-0 left-0 right-0 -mx-1 -mb-1 flex justify-end gap-2 border-t border-slate-100 bg-white/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:backdrop-blur">
        <Button onClick={() => dispatch({ type: "SET_STEP", step: 2 })} disabled={!canContinue}>
          Continue
        </Button>
      </CardFooter>
    </Card>
  );
};

const Step2: React.FC<{ state: State; dispatch: React.Dispatch<Action> }> = ({ state, dispatch }) => {
  const { name, email, phone, agree, rememberDetails, marketingOptIn } = state.details;
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const nameOk = name.trim().length >= 2;
  const emailOk = U.isEmail(email);
  const phoneOk = U.isUKPhone(phone);
  const canContinue = nameOk && emailOk && phoneOk && agree;
  const showAgreementError = attemptedSubmit && !agree;

  const handleContinue = () => {
    setAttemptedSubmit(true);
    if (!canContinue) return;
    track("details_submit", {
      marketing_opt_in: marketingOptIn ? 1 : 0,
      terms_checked: agree ? 1 : 0,
    });
    dispatch({ type: "SET_STEP", step: 3 });
  };

  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader className="space-y-3">
        <CardTitle className="text-2xl">Tell us how to reach you</CardTitle>
        <CardDescription className="text-sm text-slate-600">
          We’ll send confirmation and any updates to the contact details below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-4 rounded-xl border border-slate-200 p-4">
          <h3 className="text-base font-semibold text-slate-900">Contact details</h3>
          <div className="space-y-4">
            <Field id="name" label="Full name" required error={name && !nameOk ? "Please enter at least two characters." : ""}>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(event) => dispatch({ type: "SET_FIELD", key: "name", value: event.target.value })}
                placeholder="Jane Smith"
                autoComplete="name"
              />
            </Field>
            <Field id="email" label="Email address" required error={email && !emailOk ? "Please enter a valid email." : ""}>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => dispatch({ type: "SET_FIELD", key: "email", value: event.target.value })}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </Field>
            <Field
              id="phone"
              label="UK phone number"
              required
              error={phone && !phoneOk ? "Please enter a valid UK mobile number (e.g., 07123 456789)." : ""}
            >
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(event) => dispatch({ type: "SET_FIELD", key: "phone", value: event.target.value })}
                placeholder="07123 456789"
                autoComplete="tel"
              />
            </Field>
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-slate-200 p-4">
          <h3 className="text-base font-semibold text-slate-900">Preferences</h3>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Checkbox
                id="remember"
                checked={rememberDetails}
                onChange={(event) =>
                  dispatch({ type: "SET_FIELD", key: "rememberDetails", value: event.target.checked })
                }
              />
              <div className="space-y-1">
                <Label htmlFor="remember" className="text-sm font-medium text-slate-900">
                  Remember my details on this device
                </Label>
                <p className="text-xs text-slate-500">
                  Saves your name and contact info locally so future bookings are faster. Clear anytime from this step.
                </p>
              </div>
            </div>

            <div className={U.cn(
              "space-y-2 rounded-lg border px-4 py-3",
              showAgreementError ? "border-red-200 bg-red-50" : "border-slate-200 bg-slate-50",
            )}>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="agree"
                  checked={agree}
                  onChange={(event) => dispatch({ type: "SET_FIELD", key: "agree", value: event.target.checked })}
                />
                <div className="space-y-1">
                  <Label htmlFor="agree" className="text-sm font-medium text-slate-900">
                    I agree to the
                    {" "}
                    <Link href="/terms/SajiloReserveX" target="_blank" rel="noopener noreferrer" className="underline">
                      SajiloReserveX Terms
                    </Link>
                    {" "}and
                    {" "}
                    <Link href="/terms/venue" target="_blank" rel="noopener noreferrer" className="underline">
                      Venue Terms
                    </Link>
                    .
                  </Label>
                  <p className="text-xs text-slate-500">Each link opens in a new tab so you keep your progress here.</p>
                </div>
              </div>
              {showAgreementError && (
                <p className="flex items-center gap-1 text-xs text-red-600">
                  <Icon.AlertCircle className="h-4 w-4" /> Please accept the terms to continue.
                </p>
              )}
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="marketing"
                checked={marketingOptIn}
                onChange={(event) =>
                  dispatch({ type: "SET_FIELD", key: "marketingOptIn", value: event.target.checked })
                }
              />
              <div className="space-y-1">
                <Label htmlFor="marketing" className="text-sm font-medium text-slate-900">
                  Send me SajiloReserveX news and offers (optional)
                </Label>
                <p className="text-xs text-slate-500">Occasional updates only. Unsubscribe anytime from any email.</p>
              </div>
            </div>
          </div>
        </section>
      </CardContent>
      <CardFooter className="sticky bottom-0 left-0 right-0 -mx-1 -mb-1 flex flex-col gap-2 border-t border-slate-100 bg-white/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <Button variant="outline" onClick={() => dispatch({ type: "SET_STEP", step: 1 })} className="w-full sm:w-auto">
          Back
        </Button>
        <Button onClick={handleContinue} disabled={!canContinue} className="w-full sm:w-auto">
          Review booking
        </Button>
      </CardFooter>
    </Card>
  );
};

const ConfirmationSummaryView: React.FC<{
  booking: ApiBooking | null;
  details: BookingDetails;
  waitlisted: boolean;
  allocationPending: boolean;
  lastAction: LastAction;
  onCancelAmend: () => void;
  onViewUpdate: () => void;
  onClose: () => void;
}> = ({ booking, details, waitlisted, allocationPending, lastAction, onCancelAmend, onViewUpdate, onClose }) => {
  const summaryDate = details.date ? U.formatSummaryDate(details.date) : "TBC";
  const summaryTime = details.time ? U.formatTime(details.time) : "TBC";
  const partyText = `${details.party} ${details.party === 1 ? "guest" : "guests"}`;
  const reference = booking?.reference ?? (waitlisted ? "WAITLIST" : "Pending");
  const guestName = booking?.customer_name ?? details.name;
  const isWaitlisted = waitlisted;
  const isAllocationPending = allocationPending && !isWaitlisted;
  const heading = isWaitlisted
    ? "You're on the waiting list"
    : isAllocationPending
      ? "Manual allocation pending"
      : lastAction === "update"
        ? "Booking updated"
        : "Booking confirmed";

  const description = isWaitlisted
    ? `We’ll notify ${details.email} if a table opens near ${summaryTime} on ${summaryDate}.`
    : isAllocationPending
      ? `Our host team will assign the best available table and follow up at ${details.email}.`
      : `A confirmation email has been sent to ${details.email}.`;

  const iconClassName = isWaitlisted ? "text-amber-500" : isAllocationPending ? "text-sky-500" : "text-green-500";
  const HeadingIcon = isWaitlisted ? Icon.Info : isAllocationPending ? Icon.Clock : Icon.CheckCircle;

  const handleClose = () => {
    onClose();
  };

  const venue = DEFAULT_VENUE;

  return (
    <div className="space-y-6">
      <div
        className={U.cn(
          "flex flex-col gap-3 rounded-2xl border px-5 py-5 sm:flex-row sm:items-center",
          isWaitlisted
            ? "border-amber-200 bg-amber-50"
            : isAllocationPending
              ? "border-sky-200 bg-sky-50"
              : "border-green-200 bg-green-50",
        )}
        role="status"
      >
        <HeadingIcon className={U.cn("h-10 w-10", iconClassName)} />
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-slate-900">{heading}</h2>
          <p className="text-sm text-slate-700">{description}</p>
          {isWaitlisted && (
            <p className="text-xs text-slate-600">
              Tip: keep an eye on your inbox—we’ll release the table to the next guest if we don’t hear back.
            </p>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Booking recap</CardTitle>
          <CardDescription>Save or update your reservation details below.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div className="space-y-1">
              <dt className="text-slate-600">Booking reference</dt>
              <dd className="text-base font-semibold text-slate-900">{reference}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-slate-600">Guest</dt>
              <dd className="text-base font-medium text-slate-900">{guestName || "Guest"}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-slate-600">Date</dt>
              <dd className="text-base font-medium text-slate-900">{summaryDate}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-slate-600">Time</dt>
              <dd className="text-base font-medium text-slate-900">{summaryTime}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-slate-600">Party</dt>
              <dd className="text-base font-medium text-slate-900">{partyText}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-slate-600">Venue</dt>
              <dd className="text-base font-medium text-slate-900">
                <p>{venue.name}</p>
                <p className="text-sm text-slate-600">{venue.address}</p>
              </dd>
            </div>
            {details.marketingOptIn && (
              <div className="space-y-1">
                <dt className="text-slate-600">Marketing updates</dt>
                <dd className="text-base text-slate-900">Opted in</dd>
              </div>
            )}
            {details.notes && (
              <div className="space-y-1 sm:col-span-2">
                <dt className="text-slate-600">Notes</dt>
                <dd className="text-base text-slate-900">{details.notes}</dd>
              </div>
            )}
          </dl>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
          <Button onClick={onCancelAmend} variant="outline" className="w-full sm:w-auto">
            Cancel / Amend
          </Button>
          <Button variant="ghost" className="w-full sm:w-auto" onClick={onViewUpdate}>
            View / Update (login)
          </Button>
          <Button variant="default" className="w-full sm:w-auto" onClick={handleClose}>
            Close
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Venue policy</CardTitle>
          <CardDescription>
            {venue.name} · {venue.phone} · {venue.email}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-700">{venue.policy}</p>
          <div className="text-sm text-slate-600">
            <p>Need help? Call us on {venue.phone} or email {venue.email}.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const ConfirmationStep: React.FC<{
  state: State;
  dispatch: React.Dispatch<Action>;
  onEdit: BookingEditHandler;
  onCancel: BookingMutationHandler;
  onLookup: () => Promise<void> | void;
  onNewBooking: () => void;
  forceManageView?: boolean;
}> = ({ state, dispatch, onEdit, onCancel, onLookup, onNewBooking, forceManageView = false }) => {
  const router = useRouter();
  const hasSummary = Boolean(state.lastConfirmed || state.lastAction);
  const initialMode = forceManageView || !hasSummary ? "manage" : "summary";
  const [mode, setMode] = useState<"summary" | "manage">(initialMode);

  useEffect(() => {
    if (forceManageView || !hasSummary) {
      setMode("manage");
    }
  }, [forceManageView, hasSummary]);

  const handleCancelAmend = async () => {
    setMode("manage");
    if (!state.bookings.length) {
      await onLookup();
    }
  };

  const handleViewUpdate = () => {
    router.push("/signin?redirect=/my-bookings");
  };

  const handleClose = () => {
    router.push("/thank-you");
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <div className="flex justify-center sm:justify-start">
        <div className="flex rounded-full border border-slate-200 bg-slate-50 p-1">
          {(hasSummary
            ? [
                { id: "summary" as const, label: "Confirmation" },
                { id: "manage" as const, label: "Manage bookings" },
              ]
            : [{ id: "manage" as const, label: "Manage bookings" }]
          ).map((tab) => {
            const isActive = mode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMode(tab.id)}
                className={U.cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition",
                  isActive ? "bg-white text-slate-900 shadow" : "text-slate-500 hover:text-slate-800",
                  tab.id === "summary" && !hasSummary ? "cursor-not-allowed opacity-50" : "",
                )}
                disabled={tab.id === "summary" && !hasSummary}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {mode === "summary" && hasSummary ? (
        <ConfirmationSummaryView
          booking={state.lastConfirmed}
          details={state.details}
          waitlisted={state.waitlisted}
          allocationPending={state.allocationPending}
          lastAction={state.lastAction}
          onCancelAmend={handleCancelAmend}
          onViewUpdate={handleViewUpdate}
          onClose={handleClose}
        />
      ) : (
        <ManageBookings
          state={state}
          dispatch={dispatch}
          onEdit={onEdit}
          onCancel={onCancel}
          onLookup={onLookup}
          onNewBooking={onNewBooking}
          onBack={hasSummary ? () => setMode("summary") : undefined}
        />
      )}
    </div>
  );
};

const Step3: React.FC<{ state: State; dispatch: React.Dispatch<Action>; onConfirm: () => void | Promise<void> }> = ({ state, dispatch, onConfirm }) => {
  const details = state.details;

  useEffect(() => {
    if (details.date && details.time) {
      track("confirm_open", {
        date: details.date,
        time: details.time,
        party: details.party,
      });
    } else {
      track("confirm_open");
    }
  }, [details.date, details.time, details.party]);

  const summaryValue = details.date && details.time
    ? `${details.party} at ${U.formatTime(details.time)} on ${U.formatSummaryDate(details.date)}`
    : `${details.party} guest${details.party === 1 ? "" : "s"}`;

  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader className="space-y-3">
        <CardTitle className="text-2xl">Review and confirm</CardTitle>
        <CardDescription className="text-sm text-slate-600">
          Double-check the details below. You can edit any section before confirming.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {state.error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <Icon.AlertCircle className="mt-0.5 h-4 w-4" />
              <span>{state.error}</span>
            </div>
          )}
          <dl className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
            <div className="space-y-1">
              <dt className="text-xs uppercase tracking-wide text-slate-500">Summary</dt>
              <dd className="text-sm font-semibold text-slate-900">{summaryValue}</dd>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto px-0 text-xs text-slate-600 hover:text-slate-900"
                onClick={() => dispatch({ type: "SET_STEP", step: 1 })}
              >
                Edit selection
              </Button>
            </div>
            <div className="space-y-1">
              <dt className="text-xs uppercase tracking-wide text-slate-500">Party size</dt>
              <dd className="text-sm font-medium text-slate-900">
                {details.party} {details.party === 1 ? "guest" : "guests"}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs uppercase tracking-wide text-slate-500">Full name</dt>
              <dd className="text-sm font-medium text-slate-900">{details.name}</dd>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto px-0 text-xs text-slate-600 hover:text-slate-900"
                onClick={() => dispatch({ type: "SET_STEP", step: 2 })}
              >
                Edit contact info
              </Button>
            </div>
            <div className="space-y-1">
              <dt className="text-xs uppercase tracking-wide text-slate-500">Email</dt>
              <dd className="text-sm font-medium text-slate-900">{details.email}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs uppercase tracking-wide text-slate-500">Phone</dt>
              <dd className="text-sm font-medium text-slate-900">{details.phone}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs uppercase tracking-wide text-slate-500">Booking type</dt>
              <dd className="text-sm font-medium text-slate-900">{U.formatBookingLabel(details.bookingType)}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs uppercase tracking-wide text-slate-500">Marketing updates</dt>
              <dd className="text-sm font-medium text-slate-900">
                {details.marketingOptIn ? "Subscribed" : "Not subscribed"}
              </dd>
            </div>
            {details.notes && (
              <div className="space-y-1 sm:col-span-2">
                <dt className="text-xs uppercase tracking-wide text-slate-500">Notes</dt>
                <dd className="text-sm text-slate-700">{details.notes}</dd>
              </div>
            )}
          </dl>
        </div>
      </CardContent>
      <CardFooter className="sticky bottom-0 left-0 right-0 -mx-1 -mb-1 flex flex-col gap-2 border-t border-slate-100 bg-white/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <Button variant="outline" onClick={() => dispatch({ type: "SET_STEP", step: 2 })} className="w-full sm:w-auto">
          Back
        </Button>
        <Button onClick={onConfirm} disabled={state.submitting} className="w-full sm:w-auto">
          {state.submitting ? (
            <>
              <Icon.Spinner className="mr-2 h-4 w-4 animate-spin" /> Processing...
            </>
          ) : (
            "Confirm booking"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

function ManageBookings({
  state,
  dispatch,
  onEdit,
  onCancel,
  onLookup,
  onNewBooking,
  onBack,
}: {
  state: State;
  dispatch: React.Dispatch<Action>;
  onEdit: BookingEditHandler;
  onCancel: BookingMutationHandler;
  onLookup: () => Promise<void> | void;
  onNewBooking: () => void;
  onBack?: () => void;
}) {
  const { bookings, lastConfirmed, lastAction, waitlisted, allocationPending, details, error, loading } = state;
  const [bookingToCancel, setBookingToCancel] = useState<ApiBooking | null>(null);

  const isWaitlisted = waitlisted;
  const isAllocationPending = allocationPending && !isWaitlisted;
  const heading = lastAction === "update" && !isWaitlisted && !isAllocationPending
    ? "Booking updated"
    : isWaitlisted
      ? "You're on the waiting list"
      : isAllocationPending
        ? "Manual allocation pending"
        : "Reservation confirmed";

  const HeadingIcon = isWaitlisted ? Icon.Info : isAllocationPending ? Icon.Clock : Icon.CheckCircle;
  const iconClassName = isWaitlisted ? "text-amber-500" : isAllocationPending ? "text-sky-500" : "text-green-500";
  const confirmationEmail = lastConfirmed?.customer_email ?? details.email;

  const description = isWaitlisted
    ? `We'll notify ${confirmationEmail} if a table opens near ${U.formatTime(details.time)} on ${U.formatDate(details.date)}.`
    : isAllocationPending
      ? `Our host team will assign the best available table and follow up at ${confirmationEmail}.`
      : `A confirmation has been sent to ${confirmationEmail}.`;

  const emailValue = details.email?.trim() ?? "";
  const phoneValue = details.phone?.trim() ?? "";
  const canLookup = Boolean(emailValue && phoneValue);

  const handleLookupSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onLookup();
  };

  const handleConfirmCancel = async () => {
    if (!bookingToCancel) return;
    await onCancel(bookingToCancel);
    setBookingToCancel(null);
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <div className="text-center">
        <HeadingIcon className={`mx-auto h-12 w-12 ${iconClassName}`} />
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">{heading}</h1>
        {confirmationEmail && (
          <p className="mt-2 text-slate-600">{description}</p>
        )}
        {onBack && (
          <div className="mt-4 flex justify-center">
            <Button variant="outline" onClick={onBack} disabled={loading}>
              Back to confirmation
            </Button>
          </div>
        )}
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your bookings</CardTitle>
          <CardDescription>Look up, modify, or cancel upcoming reservations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleLookupSubmit} className="space-y-4 rounded-xl border border-slate-200 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="manage-email">Email</Label>
                <Input
                  id="manage-email"
                  type="email"
                  value={details.email}
                  onChange={(event) => dispatch({ type: "SET_FIELD", key: "email", value: event.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="manage-phone">Phone</Label>
                <Input
                  id="manage-phone"
                  type="tel"
                  value={details.phone}
                  onChange={(event) => dispatch({ type: "SET_FIELD", key: "phone", value: event.target.value })}
                  required
                />
              </div>
            </div>
            <Button type="submit" disabled={!canLookup || loading} className="w-full sm:w-auto">
              {loading ? (
                <>
                  <Icon.Spinner className="mr-2 h-4 w-4 animate-spin" /> Fetching
                </>
              ) : (
                "Find my bookings"
              )}
            </Button>
          </form>

          {bookings.length > 0 ? (
            <ul className="space-y-4">
              {bookings.map((booking) => (
                <li key={booking.id}>
                  <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-base font-semibold text-slate-900">
                        {U.formatDate(booking.booking_date)} at {U.formatTime(booking.start_time)}
                      </p>
                      <p className="text-sm text-slate-600">
                        {booking.party_size} {booking.party_size === 1 ? "guest" : "guests"} · {U.formatBookingLabel(toBookingOption(booking.booking_type))}
                      </p>
                      <p className="text-xs uppercase tracking-wide text-slate-400">Ref: {booking.reference}</p>
                      <p className="text-xs text-slate-500">Booked for {booking.customer_name}</p>
                    </div>
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                      <Button
                        variant="outline"
                        onClick={() => onEdit(booking)}
                        disabled={loading}
                        className="w-full sm:w-auto"
                      >
                        <Icon.Pencil className="mr-2 h-4 w-4" /> Modify
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => setBookingToCancel(booking)}
                        disabled={loading}
                        className="w-full sm:w-auto"
                      >
                        <Icon.Trash2 className="mr-2 h-4 w-4" /> Cancel
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-slate-500">
              You have no active bookings.
            </div>
          )}
        </CardContent>
        <CardFooter className="justify-center border-t border-slate-100 bg-slate-50">
          <Button onClick={onNewBooking} disabled={loading} className="w-full sm:w-auto">
            Make a new booking
          </Button>
        </CardFooter>
      </Card>

      <AlertDialog
        open={Boolean(bookingToCancel)}
        onOpenChange={(open) => {
          if (!open) setBookingToCancel(null);
        }}
        onConfirm={handleConfirmCancel}
        title="Cancel this booking?"
        description="This action cannot be undone. The reservation will be released immediately."
      />
    </div>
  );
}

// =============================================================================================
// MAIN COMPONENT
// =============================================================================================
function BookingFlowContent() {
  const [state, dispatch] = useReducer(reducer, undefined, getInitialState);
  const { rememberDetails, name, email, phone } = state.details;
  const searchParams = useSearchParams();
  const manageInitRef = useRef(false);
  const stepsMeta = useMemo(
    () => [
      { id: 1, label: "Plan", helper: "Pick date, time, and party" },
      { id: 2, label: "Details", helper: "Share contact information" },
      { id: 3, label: "Review", helper: "Double-check and confirm" },
      { id: 4, label: "Manage", helper: "View confirmation or update" },
    ],
    [],
  );

  const selectionSummary = useMemo(() => {
    const formattedDate = state.details.date ? U.formatSummaryDate(state.details.date) : "Choose a date";
    const formattedTime = state.details.time ? U.formatTime(state.details.time) : "Pick a time";
    const partyText = state.details.party
      ? `${state.details.party} ${state.details.party === 1 ? "guest" : "guests"}`
      : "Add guests";

    return {
      formattedDate,
      formattedTime,
      partyText,
    };
  }, [state.details.date, state.details.party, state.details.time]);

  const handleLookupBookings = useCallback(
    async (overrides?: { email?: string; phone?: string; restaurantId?: string }) => {
      const emailValue = (overrides?.email ?? state.details.email ?? "").trim();
      const phoneValue = (overrides?.phone ?? state.details.phone ?? "").trim();
      const restaurantIdValue =
        overrides?.restaurantId ?? state.details.restaurantId ?? DEFAULT_RESTAURANT_ID;

      if (!emailValue || !phoneValue) {
        dispatch({ type: "SET_ERROR", message: "Provide your email and phone number to manage reservations." });
        return;
      }

      dispatch({ type: "SET_FIELD", key: "email", value: emailValue });
      dispatch({ type: "SET_FIELD", key: "phone", value: phoneValue });
      dispatch({ type: "SET_FIELD", key: "restaurantId", value: restaurantIdValue });

      dispatch({ type: "SET_LOADING", value: true });
      dispatch({ type: "SET_ERROR", message: null });

      try {
        const params = new URLSearchParams({
          email: emailValue,
          phone: phoneValue,
          restaurantId: restaurantIdValue,
        });

        const response = await fetch(`/api/bookings?${params.toString()}`);
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(typeof data?.error === "string" ? data.error : "Unable to load bookings");
        }

        dispatch({ type: "SET_BOOKINGS", bookings: data.bookings ?? [] });
        dispatch({ type: "SET_STEP", step: 4 });
      } catch (error: any) {
        dispatch({ type: "SET_ERROR", message: error?.message ?? "Unable to load bookings" });
      } finally {
        dispatch({ type: "SET_LOADING", value: false });
      }
    },
    [state.details.email, state.details.phone, state.details.restaurantId],
  );

  // Load remembered contact details
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(storageKeys.contacts);
      if (stored) {
        const parsed = JSON.parse(stored) as { name: string; email: string; phone: string };
        if (parsed.name || parsed.email || parsed.phone) {
          dispatch({ type: "HYDRATE_CONTACTS", payload: { ...parsed, rememberDetails: true } });
        }
      }
    } catch (error) {
      console.error("Failed to load contact details", error);
    }
  }, []);

  // Persist remembered contacts with explicit consent
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (rememberDetails) {
        window.localStorage.setItem(storageKeys.contacts, JSON.stringify({ name, email, phone }));
      } else {
        window.localStorage.removeItem(storageKeys.contacts);
      }
    } catch (error) {
      console.error("Failed to persist contact details", error);
    }
  }, [rememberDetails, name, email, phone]);

  useEffect(() => {
    const view = searchParams.get("view");
    if (view !== "manage" || manageInitRef.current) {
      return;
    }

    manageInitRef.current = true;

    const emailParam = searchParams.get("email") ?? "";
    const phoneParam = searchParams.get("phone") ?? "";
    const restaurantParam =
      searchParams.get("restaurantId") ?? state.details.restaurantId ?? DEFAULT_RESTAURANT_ID;

    if (emailParam) {
      dispatch({ type: "SET_FIELD", key: "email", value: emailParam });
    }
    if (phoneParam) {
      dispatch({ type: "SET_FIELD", key: "phone", value: phoneParam });
    }
    if (restaurantParam) {
      dispatch({ type: "SET_FIELD", key: "restaurantId", value: restaurantParam });
    }

    if (emailParam && phoneParam) {
      void handleLookupBookings({
        email: emailParam,
        phone: phoneParam,
        restaurantId: restaurantParam,
      });
    } else {
      dispatch({ type: "SET_STEP", step: 4 });
      dispatch({
        type: "SET_ERROR",
        message: "Enter your email and phone number to manage reservations.",
      });
    }
  }, [handleLookupBookings, searchParams, state.details.restaurantId]);

  const handleConfirm = async () => {
    const normalizedTime = U.normalizeTime(state.details.time);

    if (!normalizedTime) {
      dispatch({ type: "SET_ERROR", message: "Please select a time for your reservation." });
      return;
    }

    dispatch({ type: "SET_ERROR", message: null });
    dispatch({ type: "SET_SUBMITTING", value: true });

    const restaurantId = state.details.restaurantId || DEFAULT_RESTAURANT_ID;
    const payload = {
      restaurantId,
      date: state.details.date,
      time: normalizedTime,
      party: state.details.party,
      bookingType:
        state.details.bookingType === "drinks"
          ? "drinks"
          : U.bookingTypeFromTime(normalizedTime, state.details.date),
      seating: state.details.seating,
      notes: state.details.notes ? state.details.notes : undefined,
      name: state.details.name.trim(),
      email: state.details.email.trim(),
      phone: state.details.phone.trim(),
      marketingOptIn: state.details.marketingOptIn,
    };

    const isUpdate = Boolean(state.editingId);
    const endpoint = isUpdate ? `/api/bookings/${state.editingId}` : "/api/bookings";
    const method = isUpdate ? "PUT" : "POST";

    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 202) {
        track("booking_created", {
          waitlisted: 1,
          allocation_pending: data.allocationPending ? 1 : 0,
          party: state.details.party,
          start_time: normalizedTime,
        });
        dispatch({
          type: "SET_CONFIRMATION",
          payload: {
            bookings: data.bookings ?? [],
            booking: null,
            lastAction: "waitlist",
            waitlisted: true,
            allocationPending: Boolean(data.allocationPending),
          },
        });
        return;
      }

      if (!response.ok) {
        const message = typeof data?.error === "string" ? data.error : "Unable to process booking";
        dispatch({ type: "SET_ERROR", message });
        dispatch({ type: "SET_SUBMITTING", value: false });
        return;
      }

      dispatch({
        type: "SET_CONFIRMATION",
        payload: {
          bookings: data.bookings ?? [],
          booking: data.booking ?? null,
          lastAction:
            data.waitlisted || data.allocationPending
              ? "waitlist"
              : isUpdate
                ? "update"
                : "create",
          waitlisted: Boolean(data.waitlisted),
          allocationPending: Boolean(data.allocationPending),
        },
      });

      if (data?.booking) {
        track("booking_created", {
          waitlisted: data.waitlisted ? 1 : 0,
          allocation_pending: data.allocationPending ? 1 : 0,
          party: data.booking.party_size,
          start_time: data.booking.start_time,
          reference: data.booking.reference,
        });
      }
    } catch (error: any) {
      dispatch({
        type: "SET_ERROR",
        message: error?.message ?? "Unable to process booking",
      });
      dispatch({ type: "SET_SUBMITTING", value: false });
    }
  };

  const handleEditBooking = (booking: ApiBooking) => {
    dispatch({ type: "SET_ERROR", message: null });
    dispatch({ type: "START_EDIT", bookingId: booking.id });
  };

  const handleNewBooking = () => {
    dispatch({ type: "SET_ERROR", message: null });
    dispatch({ type: "RESET_FORM" });
  };

  const handleCancelBooking = async (booking: ApiBooking) => {
    if (!state.details.email || !state.details.phone) {
      dispatch({ type: "SET_ERROR", message: "Provide your email and phone number to manage reservations." });
      return;
    }

    dispatch({ type: "SET_LOADING", value: true });
    dispatch({ type: "SET_ERROR", message: null });

    const restaurantId = state.details.restaurantId || DEFAULT_RESTAURANT_ID;

    try {
      const params = new URLSearchParams({
        email: state.details.email.trim(),
        phone: state.details.phone.trim(),
        restaurantId,
      });

      const response = await fetch(`/api/bookings/${booking.id}?${params.toString()}`, {
        method: "DELETE",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Unable to cancel booking");
      }

      dispatch({ type: "SET_BOOKINGS", bookings: data.bookings ?? [] });
    } catch (error: any) {
      dispatch({ type: "SET_ERROR", message: error?.message ?? "Unable to cancel booking" });
    } finally {
      dispatch({ type: "SET_LOADING", value: false });
    }
  };

  const renderStep = () => {
    switch (state.step) {
      case 1:
        return <Step1 state={state} dispatch={dispatch} />;
      case 2:
        return <Step2 state={state} dispatch={dispatch} />;
      case 3:
        return <Step3 state={state} dispatch={dispatch} onConfirm={handleConfirm} />;
      case 4:
        return (
          <ConfirmationStep
            state={state}
            dispatch={dispatch}
            onEdit={handleEditBooking}
            onCancel={handleCancelBooking}
            onLookup={handleLookupBookings}
            onNewBooking={handleNewBooking}
            forceManageView={searchParams.get("view") === "manage"}
          />
        );
      default:
        return null;
    }
  };

  return (
    <main className="min-h-screen w-full bg-slate-50 px-4 py-10 font-sans text-slate-800 sm:py-16">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <section className="rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-sm backdrop-blur supports-[backdrop-filter]:backdrop-blur-sm sm:p-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Reserve your table</h1>
            <p className="text-sm text-slate-600">
              Complete each step to secure your booking. We’ll keep your progress if you need to jump back.
            </p>
            <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <span className="font-medium text-slate-900">{selectionSummary.partyText}</span>
              <span aria-hidden="true">•</span>
              <span>{selectionSummary.formattedTime}</span>
              <span aria-hidden="true">•</span>
              <span>{selectionSummary.formattedDate}</span>
            </div>
          </div>
          <ol className="mt-5 grid gap-3 sm:grid-cols-2">
            {stepsMeta.map((stepItem) => {
              const isActive = state.step === stepItem.id;
              const isComplete = state.step > stepItem.id;
              return (
                <li
                  key={stepItem.id}
                  className={U.cn(
                    "flex items-start gap-3 rounded-xl border px-3 py-3 transition",
                    isActive
                      ? "border-slate-900 bg-slate-900/5 text-slate-900"
                      : isComplete
                        ? "border-green-200 bg-green-50 text-slate-700"
                        : "border-slate-200 bg-white text-slate-600",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={U.cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold",
                      isActive
                        ? "bg-slate-900 text-white"
                        : isComplete
                          ? "bg-green-500 text-white"
                          : "bg-slate-200 text-slate-600",
                    )}
                  >
                    {isComplete ? <Icon.Check className="h-4 w-4" /> : stepItem.id}
                  </span>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold leading-tight">{stepItem.label}</p>
                    <p className="text-xs text-slate-500 sm:text-sm">{stepItem.helper}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
        <div>{renderStep()}</div>
      </div>
    </main>
  );
}

export default function BookingFlowPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen w-full items-center justify-center bg-slate-50 px-4 py-12">
        <div className="space-y-3 text-center text-slate-600">
          <Icon.Spinner className="mx-auto h-8 w-8 animate-spin" />
          <p>Loading reservation flow…</p>
        </div>
      </main>
    }>
      <BookingFlowContent />
    </Suspense>
  );
}
