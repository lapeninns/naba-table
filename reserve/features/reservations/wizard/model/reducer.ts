import { reservationConfigResult } from '@reserve/shared/config/reservations';
import { formatDateForInput } from '@reserve/shared/formatting/booking';
import { normalizeTime } from '@reserve/shared/time';
import { BOOKING_TYPES_UI, type BookingType } from '@shared/config/booking';

import type { BookingOption } from '@reserve/shared/booking';
import type { BookingSubmissionUiError } from '@reserve/shared/error';

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
  status: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  notes: string | null;
  source: string;
  marketing_opt_in: boolean;
  whatsapp_opt_in: boolean;
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
  icon?: string;
  ariaLabel?: string;
  role?: 'primary' | 'secondary' | 'support';
  fullWidth?: boolean;
  srLabel?: string;
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
  notes: string;
  name: string;
  email: string;
  phone: string;
  rememberDetails: boolean;
  agree: boolean;
  marketingOptIn: boolean;
  whatsappOptIn: boolean;
};

export type BookingWizardMode = 'customer' | 'ops';

export type LastAction = 'create' | 'update' | null;

export type WizardStep = 1 | 2 | 3 | 4;

export type State = {
  step: WizardStep;
  submitting: boolean;
  loading: boolean;
  error: string | null;
  submissionError: BookingSubmissionUiError | null;
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
  | { type: 'SET_SUBMISSION_ERROR'; error: BookingSubmissionUiError | null }
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
      details: Partial<BookingDetails>;
    };

export type ReservationDraft = {
  restaurantId?: string;
  restaurantSlug?: string;
  date: string;
  time: string;
  party: number;
  bookingType: BookingOption;
  notes?: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  marketingOptIn: boolean;
  whatsappOptIn: boolean;
};

export function toBookingOption(value: BookingType): BookingOption {
  const normalized = (value ?? '').toString().trim();
  if (BOOKING_TYPES_UI.includes(normalized as BookingOption)) {
    return normalized as BookingOption;
  }
  return BOOKING_TYPES_UI[0];
}

export const getInitialDetails = (overrides?: Partial<BookingDetails>): BookingDetails => {
  const base: BookingDetails = {
    bookingId: null,
    restaurantId: '',
    restaurantSlug: '',
    restaurantName: '',
    restaurantAddress: '',
    restaurantTimezone: '',
    reservationDurationMinutes: reservationConfigResult.config.defaultDurationMinutes,
    date: formatDateForInput(new Date()),
    time: '',
    party: 1,
    bookingType: BOOKING_TYPES_UI[0],
    notes: '',
    name: '',
    email: '',
    phone: '',
    rememberDetails: false,
    agree: false,
    marketingOptIn: false,
    whatsappOptIn: false,
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
    agree: false,
  } satisfies BookingDetails;
};

export const getInitialState = (overrides?: Partial<BookingDetails>): State => ({
  step: 1,
  submitting: false,
  loading: false,
  error: null,
  submissionError: null,
  editingId: null,
  lastAction: null,
  bookings: [],
  details: getInitialDetails(overrides),
  lastConfirmed: null,
});

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, step: action.step, error: null, submissionError: null };
    case 'SET_FIELD':
      return {
        ...state,
        error: null,
        submissionError: null,
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
    case 'SET_SUBMISSION_ERROR':
      return { ...state, submissionError: action.error };
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
        notes: booking?.notes ?? state.details.notes,
        marketingOptIn: booking ? booking.marketing_opt_in : state.details.marketingOptIn,
        whatsappOptIn: booking ? booking.whatsapp_opt_in : state.details.whatsappOptIn,
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
        submissionError: null,
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
        submissionError: null,
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
          notes: booking.notes ?? '',
          name: booking.customer_name,
          email: booking.customer_email,
          phone: booking.customer_phone,
          marketingOptIn: booking.marketing_opt_in,
          whatsappOptIn: booking.whatsapp_opt_in,
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
        submissionError: null,
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
        error: null,
        submissionError: null,
        details: {
          ...state.details,
          name: action.payload.name,
          email: action.payload.email,
          phone: action.payload.phone,
          rememberDetails: action.payload.rememberDetails ?? false,
          agree: false,
        },
      };
    case 'HYDRATE_DETAILS':
      return {
        ...state,
        step: 1,
        editingId: null,
        error: null,
        submissionError: null,
        details: {
          ...state.details,
          ...action.details,
          agree: false,
        },
      };
    default:
      return state;
  }
}
