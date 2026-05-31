import { describe, expect, it } from 'vitest';

import {
  buildBookingCreateFailureObservabilityEvent,
  mapBookingApiError,
} from '@/server/bookings/api-error';
import { PastBookingError } from '@/server/bookings/pastTimeValidation';
import { OperatingHoursError } from '@/server/bookings/timeValidation';

describe('booking API error mapper', () => {
  it('maps operating-hours errors to the existing public response shape', () => {
    expect(mapBookingApiError(new OperatingHoursError('CLOSED', 'Restaurant is closed.'))).toEqual({
      status: 400,
      body: {
        error: 'Restaurant is closed.',
        code: 'OPERATING_HOURS_CLOSED',
        details: 'CLOSED',
      },
    });
  });

  it('maps past-booking errors with validation details', () => {
    const details = {
      bookingTime: '2026-05-22T18:30:00.000Z',
      serverTime: '2026-05-22T19:00:00.000Z',
      timezone: 'Europe/London',
      gracePeriodMinutes: 5,
      timeDeltaMinutes: -30,
    };

    expect(mapBookingApiError(new PastBookingError('Booking is in the past.', details))).toEqual({
      status: 422,
      body: {
        error: 'Booking is in the past.',
        code: 'BOOKING_IN_PAST',
        details,
      },
    });
  });

  it('maps duplicate database errors to the public duplicate resource response', () => {
    expect(mapBookingApiError({ code: '23505', message: 'duplicate key' })).toEqual({
      status: 409,
      body: {
        error: 'This booking conflicts with an existing record (duplicate phone or email).',
        code: 'DUPLICATE_RESOURCE',
      },
    });
  });

  it('maps generic errors to a stable public response', () => {
    expect(mapBookingApiError(new Error('Database unavailable'))).toEqual({
      status: 500,
      body: {
        error: 'Unable to create booking',
        code: 'INTERNAL_SERVER_ERROR',
      },
    });
  });

  it('does not expose raw string or unknown failures', () => {
    expect(mapBookingApiError('plain failure')).toEqual({
      status: 500,
      body: {
        error: 'Unable to create booking',
        code: 'INTERNAL_SERVER_ERROR',
      },
    });

    expect(mapBookingApiError(null)).toEqual({
      status: 500,
      body: {
        error: 'Unable to create booking',
        code: 'INTERNAL_SERVER_ERROR',
      },
    });
  });
});

describe('booking create failure observability event builder', () => {
  it('builds the existing failure event shape with contact-derived metadata', () => {
    const details = {
      reason: 'outside_hours',
      requested: '2026-05-23T20:00:00.000Z',
    };

    expect(
      buildBookingCreateFailureObservabilityEvent({
        apiError: {
          status: 400,
          body: {
            error: 'Restaurant is closed.',
            code: 'OPERATING_HOURS_CLOSED',
            details,
          },
        },
        restaurantId: 'restaurant-1',
        bookingDate: '2026-05-23',
        email: 'ada@example.com',
        phone: '+44 7700 900123',
      }),
    ).toEqual({
      source: 'api.bookings',
      eventType: 'booking.create.failure',
      severity: 'error',
      context: {
        message: 'Restaurant is closed.',
        restaurantId: 'restaurant-1',
        bookingDate: '2026-05-23',
        emailDomain: 'example.com',
        phoneSuffix: '0123',
        errorCode: 'OPERATING_HOURS_CLOSED',
        details,
      },
    });
  });

  it('uses null fallbacks for malformed contact metadata and absent details', () => {
    expect(
      buildBookingCreateFailureObservabilityEvent({
        apiError: {
          status: 500,
          body: {
            error: 'Unable to create booking',
            code: 'INTERNAL_SERVER_ERROR',
          },
        },
        restaurantId: 'restaurant-1',
        bookingDate: '2026-05-23',
        email: 'not-an-email',
        phone: '',
      }),
    ).toEqual({
      source: 'api.bookings',
      eventType: 'booking.create.failure',
      severity: 'error',
      context: {
        message: 'Unable to create booking',
        restaurantId: 'restaurant-1',
        bookingDate: '2026-05-23',
        emailDomain: null,
        phoneSuffix: null,
        errorCode: 'INTERNAL_SERVER_ERROR',
        details: null,
      },
    });
  });
});
