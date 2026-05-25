import { describe, expect, it, vi } from 'vitest';

import {
  buildBookingCreateFailureResponse,
  maskEmailForBookingCreateLog,
} from '@/server/bookings/create-failure-response';

import type { BookingCreateRequest } from '@/server/bookings/request-validation';

const bookingRequest: BookingCreateRequest = {
  restaurantId: '11111111-1111-4111-8111-111111111111',
  restaurantSlug: 'old-crown',
  date: '2026-05-23',
  time: '18:30',
  party: 4,
  bookingType: 'dinner',
  notes: null,
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  phone: '07123456789',
  marketingOptIn: false,
};

describe('booking create failure response', () => {
  it('maps duplicate resource errors to the API response and records observability', async () => {
    const eventRecorder = vi.fn();
    const logger = vi.fn();

    const response = buildBookingCreateFailureResponse({
      error: { code: '23505', message: 'duplicate key' },
      eventRecorder,
      logger,
      request: bookingRequest,
      restaurantId: bookingRequest.restaurantId!,
    });

    await expect(response.json()).resolves.toEqual({
      error: 'This booking conflicts with an existing record (duplicate phone or email).',
      code: 'DUPLICATE_RESOURCE',
    });
    expect(response.status).toBe(409);
    expect(eventRecorder).toHaveBeenCalledWith({
      source: 'api.bookings',
      eventType: 'booking.create.failure',
      severity: 'error',
      context: {
        message: 'This booking conflicts with an existing record (duplicate phone or email).',
        restaurantId: bookingRequest.restaurantId,
        bookingDate: bookingRequest.date,
        emailDomain: 'example.com',
        phoneSuffix: '6789',
        errorCode: 'DUPLICATE_RESOURCE',
        details: null,
      },
    });
  });

  it('logs masked booking context without leaking the full email address', () => {
    const eventRecorder = vi.fn();
    const logger = vi.fn();

    buildBookingCreateFailureResponse({
      error: new Error('Database unavailable'),
      eventRecorder,
      logger,
      request: bookingRequest,
      restaurantId: bookingRequest.restaurantId!,
    });

    expect(logger).toHaveBeenCalledWith('[bookings][POST] Error finishing booking:', {
      message: 'Database unavailable',
      code: 'INTERNAL_SERVER_ERROR',
      stack: expect.any(String),
      debugInfo: {
        restaurantId: bookingRequest.restaurantId,
        date: bookingRequest.date,
        party: bookingRequest.party,
        email: 'ada...',
      },
    });
  });

  it('masks email addresses consistently for route debug logs', () => {
    expect(maskEmailForBookingCreateLog('xy@example.com')).toBe('xy...');
    expect(maskEmailForBookingCreateLog('ada@example.com')).toBe('ada...');
  });
});
