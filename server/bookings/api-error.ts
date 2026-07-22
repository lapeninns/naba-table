import { PastBookingError } from '@/server/bookings/pastTimeValidation';
import { OperatingHoursError } from '@/server/bookings/timeValidation';
import { ServiceNotFoundError, ServiceOverrunError } from '@/server/capacity/policy';
import { CustomerContactStorageError } from '@/server/customer-contact-errors';

import type { Json } from '@/types/supabase';

export type BookingApiError = {
  status: number;
  body: {
    error: string;
    code: string;
    details?: unknown;
    stack?: string;
  };
};

export type BookingCreateFailureObservabilityEvent = {
  source: 'api.bookings';
  eventType: 'booking.create.failure';
  severity: 'error';
  context: {
    message: string;
    restaurantId: string;
    bookingDate: string;
    emailDomain: string | null;
    phoneSuffix: string | null;
    errorCode: string;
    details: Json | null;
  };
};

export function mapBookingApiError(error: unknown): BookingApiError {
  if (error instanceof OperatingHoursError) {
    return {
      status: 400,
      body: {
        error: error.message,
        code: 'OPERATING_HOURS_CLOSED',
        details: error.reason,
      },
    };
  }

  if (error instanceof PastBookingError) {
    return {
      status: 422,
      body: {
        error: error.message,
        code: error.code,
        details: error.details,
      },
    };
  }

  // Contact storage rejected by the customers table (NOT NULL / CHECK):
  // customer-safe 422 with an actionable message instead of the former
  // INTERNAL_SERVER_ERROR (July 2026 booking-500 cluster).
  if (error instanceof CustomerContactStorageError) {
    return {
      status: 422,
      body: {
        error: error.message,
        code: error.code,
      },
    };
  }

  // Controlled availability failure: a time outside every service window (or
  // one that cannot fit before service ends) is a customer-safe 422, never a
  // 500 and never a silently force-fitted booking.
  if (error instanceof ServiceNotFoundError || error instanceof ServiceOverrunError) {
    return {
      status: 422,
      body: {
        error:
          'The selected time is outside the bookable service hours for this restaurant. Please choose a different time.',
        code: 'OUTSIDE_SERVICE_HOURS',
      },
    };
  }

  const dbError = error && typeof error === 'object' ? (error as Record<string, unknown>) : {};
  if (dbError.code === '23505') {
    return {
      status: 409,
      body: {
        error:
          'These contact details partially match an existing guest record. Use the same email and phone number as previous bookings, or contact the restaurant.',
        code: 'DUPLICATE_RESOURCE',
      },
    };
  }

  return {
    status: 500,
    body: {
      error: 'Unable to create booking',
      code: 'INTERNAL_SERVER_ERROR',
    },
  };
}

export function buildBookingCreateFailureObservabilityEvent({
  apiError,
  restaurantId,
  bookingDate,
  email,
  phone,
}: {
  apiError: BookingApiError;
  restaurantId: string;
  bookingDate: string;
  email: string;
  phone: string;
}): BookingCreateFailureObservabilityEvent {
  const emailDomain = email.includes('@') ? email.split('@')[1] : null;
  const phoneSuffix = phone ? phone.slice(-4) : null;

  return {
    source: 'api.bookings',
    eventType: 'booking.create.failure',
    severity: 'error',
    context: {
      message: apiError.body.error,
      restaurantId,
      bookingDate,
      emailDomain,
      phoneSuffix,
      errorCode: apiError.body.code,
      details: (apiError.body.details as Json) || null,
    },
  };
}
