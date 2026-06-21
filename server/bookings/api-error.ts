import { PastBookingError } from '@/server/bookings/pastTimeValidation';
import { OperatingHoursError } from '@/server/bookings/timeValidation';

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

  const dbError = error && typeof error === 'object' ? (error as Record<string, unknown>) : {};
  if (dbError.code === '23505') {
    return {
      status: 409,
      body: {
        error: 'This booking conflicts with an existing record (duplicate phone or email).',
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
