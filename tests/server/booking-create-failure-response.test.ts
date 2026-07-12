import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetPosthogServerClientForTests } from '@/lib/posthog/server';
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
  afterEach(() => {
    resetPosthogServerClientForTests();
  });

  it('captures a privacy-safe PostHog event and exception without changing the response', async () => {
    const capture = vi.fn();
    const captureException = vi.fn();
    resetPosthogServerClientForTests({
      capture,
      captureException,
      flush: vi.fn(),
      shutdown: vi.fn(),
    });

    const error = new Error('Database unavailable');
    const response = buildBookingCreateFailureResponse({
      error,
      eventRecorder: vi.fn(),
      logger: vi.fn(),
      request: bookingRequest,
      restaurantId: bookingRequest.restaurantId!,
    });

    // Response is unchanged by instrumentation.
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Unable to create booking',
      code: 'INTERNAL_SERVER_ERROR',
    });

    expect(capture).toHaveBeenCalledWith({
      distinctId: 'server:test',
      event: 'booking_create_failed',
      groups: { restaurant: bookingRequest.restaurantId },
      properties: {
        restaurantId: bookingRequest.restaurantId,
        code: 'INTERNAL_SERVER_ERROR',
        status: 500,
        source: 'api',
      },
    });

    // The captured exception properties never include the customer email or phone.
    const exceptionProps = captureException.mock.calls[0]?.[2] ?? {};
    const serialized = JSON.stringify([capture.mock.calls, captureException.mock.calls]);
    expect(serialized).not.toContain('ada@example.com');
    expect(serialized).not.toContain('07123456789');
    expect(exceptionProps).toMatchObject({
      restaurantId: bookingRequest.restaurantId,
      path: '/api/bookings',
      source: 'api',
    });
  });

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
      error:
        'These contact details partially match an existing guest record. Use the same email and phone number as previous bookings, or contact the restaurant.',
      code: 'DUPLICATE_RESOURCE',
    });
    expect(response.status).toBe(409);
    expect(eventRecorder).toHaveBeenCalledWith({
      source: 'api.bookings',
      eventType: 'booking.create.failure',
      severity: 'error',
      context: {
        message:
          'These contact details partially match an existing guest record. Use the same email and phone number as previous bookings, or contact the restaurant.',
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
    expect(maskEmailForBookingCreateLog('')).toBe('...');
    expect(maskEmailForBookingCreateLog('xy@example.com')).toBe('xy...');
    expect(maskEmailForBookingCreateLog('ada@example.com')).toBe('ada...');
  });
});
