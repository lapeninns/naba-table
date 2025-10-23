import { reservationConfigResult } from '@reserve/shared/config/reservations';
import { formatDateForInput } from '@reserve/shared/formatting/booking';
import { normalizeTime } from '@reserve/shared/time';
import {
  BOOKING_TYPES_UI,
  SEATING_PREFERENCES_UI,
  type BookingType,
  type SeatingPreference,
} from '@shared/config/booking';
import {
  DEFAULT_RESTAURANT_ID,
  DEFAULT_RESTAURANT_SLUG,
  DEFAULT_VENUE,
} from '@shared/config/venue';

import type { BookingOption } from '@reserve/shared/booking';
import type { IconKey } from '@reserve/shared/ui/icons';

export type SeatingOption = (typeof SEATING_PREFERENCES_UI)[number];

export type ApiBooking = {
  id: string;
  restaurant_id: string;
  customer_id: string;
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
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  disabled?: boolean;
  loading?: boolean;
  icon?: IconKey;
  ariaLabel?: string;
};

export type BookingDetails = {
  bookingId: string | null;
  restaurantId: string;
  restaurantSlug: string;
  restaurantName: string;
  restaurantAddress: string;
  restaurantTimezone: string;
  reservationDurationMinutes: number;
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

export type BookingWizardMode = 'customer' | 'ops';

export type LastAction = 'create' | 'update' | null;

export type WizardStep = 1 | 2 | 3 | 4;

export type State = {
  step: WizardStep;
  submitting: boolean;
  loading: boolean;
  error: string | null;
  editingId: string | null;
  lastAction: LastAction;
  bookings: ApiBooking[];
  details: BookingDetails;
  lastConfirmed: ApiBooking | null;
};

export type Action =
  | { type: 'SET_STEP'; step: State['step'] }
  | { type: 'SET_FIELD'; key: keyof BookingDetails; value: BookingDetails[keyof BookingDetails] }
  | { type: 'SET_SUBMITTING'; value: boolean }
  | { type: 'SET_LOADING'; value: boolean }
  | { type: 'SET_ERROR'; message: string | null }
  | { type: 'SET_BOOKINGS'; bookings: ApiBooking[] }
  | {
      type: 'SET_CONFIRMATION';
      payload: {
        bookings: ApiBooking[];
        booking: ApiBooking | null;
        lastAction: Exclude<LastAction, null>;
      };
    }
  | { type: 'START_EDIT'; bookingId: string }
  | { type: 'RESET_FORM'; initialDetails?: Partial<BookingDetails> }
  | {
      type: 'HYDRATE_CONTACTS';
      payload: Pick<BookingDetails, 'name' | 'email' | 'phone'> & { rememberDetails?: boolean };
    }
  | {
      type: 'HYDRATE_DETAILS';
      details: BookingDetails;
    };

export type ReservationDraft = {
  restaurantId?: string;
  date: string;
  time: string;
  party: number;
  bookingType: BookingOption;
  seating: SeatingOption;
  notes?: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  marketingOptIn: boolean;
};

const SEATING_OPTIONS_SET = new Set<SeatingOption>(SEATING_PREFERENCES_UI);

export function toBookingOption(value: BookingType): BookingOption {
  const normalized = (value ?? '').toString().trim();
  return (normalized.length > 0 ? normalized : BOOKING_TYPES_UI[0]) as BookingOption;
}

export function toSeatingOption(value: SeatingPreference): SeatingOption {
  if (SEATING_OPTIONS_SET.has(value as SeatingOption)) {
    return value as SeatingOption;
  }
  if (value === 'window' || value === 'booth' || value === 'bar') {
    return 'indoor';
  }
  return SEATING_PREFERENCES_UI[0];
}

export const getInitialDetails = (overrides?: Partial<BookingDetails>): BookingDetails => {
  const base: BookingDetails = {
    bookingId: null,
    restaurantId: DEFAULT_RESTAURANT_ID,
    restaurantSlug: DEFAULT_RESTAURANT_SLUG,
    restaurantName: DEFAULT_VENUE.name,
    restaurantAddress: DEFAULT_VENUE.address,
    restaurantTimezone: DEFAULT_VENUE.timezone,
    reservationDurationMinutes: reservationConfigResult.config.defaultDurationMinutes,
    date: formatDateForInput(new Date()),
    time: '',
    party: 1,
    bookingType: BOOKING_TYPES_UI[0],
    seating: SEATING_PREFERENCES_UI[0],
    notes: '',
    name: '',
    email: '',
    phone: '',
    rememberDetails: true,
    agree: true,
    marketingOptIn: true,
  };

  if (!overrides) {
    return base;
  }

  return {
    ...base,
    ...overrides,
    restaurantId: overrides.restaurantId ?? base.restaurantId,
    restaurantSlug: overrides.restaurantSlug ?? base.restaurantSlug,
    restaurantName: overrides.restaurantName ?? base.restaurantName,
    restaurantAddress: overrides.restaurantAddress ?? base.restaurantAddress,
    restaurantTimezone: overrides.restaurantTimezone ?? base.restaurantTimezone,
    reservationDurationMinutes:
      overrides.reservationDurationMinutes ?? base.reservationDurationMinutes,
  } satisfies BookingDetails;
};

export const getInitialState = (overrides?: Partial<BookingDetails>): State => ({
  step: 1,
  submitting: false,
  loading: false,
  error: null,
  editingId: null,
  lastAction: null,
  bookings: [],
  details: getInitialDetails(overrides),
  lastConfirmed: null,
});

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, step: action.step, error: null };
    case 'SET_FIELD':
      return {
        ...state,
        error: null,
        details: {
          ...state.details,
          [action.key]: action.value,
        },
      };
    case 'SET_SUBMITTING':
      return { ...state, submitting: action.value };
    case 'SET_LOADING':
      return { ...state, loading: action.value };
    case 'SET_ERROR':
      return { ...state, error: action.message };
    case 'SET_BOOKINGS':
      return { ...state, bookings: action.bookings };
    case 'SET_CONFIRMATION': {
      const { bookings, booking, lastAction } = action.payload;
      const updatedDetails = {
        ...state.details,
        bookingId: booking ? booking.id : null,
        restaurantId: booking ? booking.restaurant_id : state.details.restaurantId,
        restaurantName: state.details.restaurantName,
        restaurantAddress: state.details.restaurantAddress,
        restaurantTimezone: state.details.restaurantTimezone,
        date: booking ? booking.booking_date : state.details.date,
        time: booking
          ? (normalizeTime(booking.start_time) ?? state.details.time)
          : state.details.time,
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
        lastConfirmed: booking ?? state.lastConfirmed,
        details: updatedDetails,
        error: null,
      };
    }
    case 'START_EDIT': {
      const booking = state.bookings.find((entry) => entry.id === action.bookingId);
      if (!booking) return state;
      return {
        ...state,
        step: 1,
        submitting: false,
        editingId: booking.id,
        lastAction: null,
        error: null,
        details: {
          ...state.details,
          bookingId: booking.id,
          restaurantId: booking.restaurant_id,
          restaurantName: state.details.restaurantName,
          restaurantAddress: state.details.restaurantAddress,
          restaurantTimezone: state.details.restaurantTimezone,
          date: booking.booking_date,
          time: normalizeTime(booking.start_time) ?? state.details.time,
          party: booking.party_size,
          bookingType: toBookingOption(booking.booking_type),
          seating: toSeatingOption(booking.seating_preference),
          notes: booking.notes ?? '',
          name: booking.customer_name,
          email: booking.customer_email,
          phone: booking.customer_phone,
          marketingOptIn: booking.marketing_opt_in,
        },
      };
    }
    case 'RESET_FORM': {
      const base = getInitialDetails(action.initialDetails);
      const shouldRemember = state.details.rememberDetails;
      return {
        ...state,
        step: 1,
        submitting: false,
        loading: false,
        editingId: null,
        lastAction: null,
        error: null,
        details: {
          ...base,
          rememberDetails: shouldRemember,
          name: shouldRemember ? state.details.name : '',
          email: shouldRemember ? state.details.email : '',
          phone: shouldRemember ? state.details.phone : '',
        },
      };
    }
    case 'HYDRATE_CONTACTS':
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
    case 'HYDRATE_DETAILS':
      return {
        ...state,
        step: 1,
        editingId: null,
        error: null,
        details: {
          ...state.details,
          ...action.details,
        },
      };
    default:
      return state;
  }
}
