import type { IconKey } from "@/components/reserve/icons";
import { bookingHelpers, type BookingOption } from "@/components/reserve/helpers";
import {
  BOOKING_TYPES_UI,
  SEATING_PREFERENCES_UI,
  type BookingType,
  type SeatingPreference,
} from "@/lib/enums";
import { DEFAULT_RESTAURANT_ID, DEFAULT_VENUE } from "@/lib/venue";

export type SeatingOption = (typeof SEATING_PREFERENCES_UI)[number];

export type ApiBooking = {
  id: string;
  restaurant_id: string;
  customer_id: string;
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
  source: string;
  marketing_opt_in: boolean;
  loyalty_points_awarded: number;
  created_at: string;
  updated_at: string;
};

export type StepAction = {
  id: string;
  label: string;
  onClick: () => void;
  variant?: "default" | "outline" | "ghost" | "destructive";
  disabled?: boolean;
  loading?: boolean;
  icon?: IconKey;
  ariaLabel?: string;
};

export type BookingDetails = {
  bookingId: string | null;
  restaurantId: string;
  restaurantName: string;
  restaurantAddress: string;
  restaurantTimezone: string;
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

export type LastAction = "create" | "update" | "waitlist" | null;

export type State = {
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

export type Action =
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

export function toBookingOption(value: BookingType): BookingOption {
  return BOOKING_OPTIONS_SET.has(value as BookingOption) ? (value as BookingOption) : BOOKING_TYPES_UI[0];
}

export function toSeatingOption(value: SeatingPreference): SeatingOption {
  if (SEATING_OPTIONS_SET.has(value as SeatingOption)) {
    return value as SeatingOption;
  }
  if (value === "window" || value === "booth" || value === "bar") {
    return "indoor";
  }
  return SEATING_PREFERENCES_UI[0];
}

export const getInitialDetails = (): BookingDetails => ({
  bookingId: null,
  restaurantId: DEFAULT_RESTAURANT_ID,
  restaurantName: DEFAULT_VENUE.name,
  restaurantAddress: DEFAULT_VENUE.address,
  restaurantTimezone: DEFAULT_VENUE.timezone,
  date: bookingHelpers.formatForDateInput(new Date()),
  time: "",
  party: 1,
  bookingType: BOOKING_TYPES_UI[0],
  seating: SEATING_PREFERENCES_UI[0],
  notes: "",
  name: "",
  email: "",
  phone: "",
  rememberDetails: true,
  agree: true,
  marketingOptIn: true,
});

export const getInitialState = (): State => ({
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

export function reducer(state: State, action: Action): State {
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
        restaurantName: state.details.restaurantName,
        restaurantAddress: state.details.restaurantAddress,
        restaurantTimezone: state.details.restaurantTimezone,
        date: booking ? booking.booking_date : state.details.date,
        time: booking ? bookingHelpers.normalizeTime(booking.start_time) : state.details.time,
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
          restaurantName: state.details.restaurantName,
          restaurantAddress: state.details.restaurantAddress,
          restaurantTimezone: state.details.restaurantTimezone,
          date: booking.booking_date,
          time: bookingHelpers.normalizeTime(booking.start_time),
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
          restaurantId: state.details.restaurantId,
          restaurantName: state.details.restaurantName,
          restaurantAddress: state.details.restaurantAddress,
          restaurantTimezone: state.details.restaurantTimezone,
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
}
