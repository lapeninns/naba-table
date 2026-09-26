import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetPosthogServerClientForTests } from '@/lib/posthog/server';
import { parseBookingAttemptHeaders } from '@/server/bookings/attempt-context';
import { buildBookingCreateFailureResponse } from '@/server/bookings/create-failure-response';

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
      error: 'Something went wrong on our side. Try again.',
      message: 'Something went wrong on our side. Try again.',
      code: 'INTERNAL_ERROR',
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

    // The captured exception properties never include the customer email or phone
    // and always carry the release metadata used for source-map association.
    const exceptionProps = captureException.mock.calls[0]?.[2] ?? {};
    const serialized = JSON.stringify([capture.mock.calls, captureException.mock.calls]);
    expect(serialized).not.toContain('ada@example.com');
    expect(serialized).not.toContain('07123456789');
    expect(exceptionProps).toMatchObject({
      restaurantId: bookingRequest.restaurantId,
      path: '/api/bookings',
      source: 'api',
      release: 'nabatable-web',
      deploySha: expect.any(String),
    });
  });

  it('threads the attempt and correlation ids through the event, exception, and log', () => {
    const capture = vi.fn();
    const captureException = vi.fn();
    resetPosthogServerClientForTests({
      capture,
      captureException,
      flush: vi.fn(),
      shutdown: vi.fn(),
    });
    const logger = vi.fn();

    buildBookingCreateFailureResponse({
      attempt: { attemptId: '4f7c1f6a-52ef-4444-9df1-3f4f9a4e21aa', attemptNumber: 2 },
      correlationId: 'corr-1234567890',
      error: new Error('Database unavailable'),
      eventRecorder: vi.fn(),
      logger,
      request: bookingRequest,
      restaurantId: bookingRequest.restaurantId!,
    });

    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'booking_create_failed',
        properties: expect.objectContaining({
          attemptId: '4f7c1f6a-52ef-4444-9df1-3f4f9a4e21aa',
          attempt: 2,
          correlationId: 'corr-1234567890',
        }),
      }),
    );
    expect(captureException.mock.calls[0]?.[2]).toMatchObject({
      attemptId: '4f7c1f6a-52ef-4444-9df1-3f4f9a4e21aa',
      correlationId: 'corr-1234567890',
    });
    expect(logger).toHaveBeenCalledWith(
      'booking create failed',
      expect.objectContaining({
        attemptId: '4f7c1f6a-52ef-4444-9df1-3f4f9a4e21aa',
        attempt: 2,
        correlationId: 'corr-1234567890',
      }),
    );
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
      message:
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

  it('logs structured booking context through the failure logger without the email', () => {
    const eventRecorder = vi.fn();
    const logger = vi.fn();
    const error = new Error('Database unavailable');

    buildBookingCreateFailureResponse({
      error,
      eventRecorder,
      logger,
      request: bookingRequest,
      restaurantId: bookingRequest.restaurantId!,
    });

    expect(logger).toHaveBeenCalledWith('booking create failed', {
      code: 'INTERNAL_SERVER_ERROR',
      status: 500,
      route: '/api/bookings',
      restaurantId: bookingRequest.restaurantId,
      date: bookingRequest.date,
      party: bookingRequest.party,
      error,
    });
    expect(JSON.stringify(logger.mock.calls[0]?.[1]?.code ?? '')).not.toContain('ada');
    const loggedContext = logger.mock.calls[0]?.[1] as Record<string, unknown>;
    expect('email' in loggedContext).toBe(false);
    expect('debugInfo' in loggedContext).toBe(false);
  });
});

describe('booking attempt headers', () => {
  const headersOf = (entries: Record<string, string>): Pick<Headers, 'get'> => ({
    get: (name: string) => entries[name.toLowerCase()] ?? null,
  });

  it('parses valid attempt headers', () => {
    expect(
      parseBookingAttemptHeaders(
        headersOf({
          'x-booking-attempt-id': '4f7c1f6a-52ef-4444-9df1-3f4f9a4e21aa',
          'x-booking-attempt': '3',
        }),
      ),
    ).toEqual({ attemptId: '4f7c1f6a-52ef-4444-9df1-3f4f9a4e21aa', attemptNumber: 3 });
  });

  it('rejects malformed or unsafe attempt headers', () => {
    expect(
      parseBookingAttemptHeaders(
        headersOf({
          'x-booking-attempt-id': '<script>x</script>',
          'x-booking-attempt': 'NaN',
        }),
      ),
    ).toEqual({ attemptId: 'scriptxscript', attemptNumber: null });
    expect(
      parseBookingAttemptHeaders(
        headersOf({ 'x-booking-attempt-id': 'ab', 'x-booking-attempt': '9999' }),
      ),
    ).toEqual({ attemptId: null, attemptNumber: null });
    expect(parseBookingAttemptHeaders(headersOf({}))).toEqual({
      attemptId: null,
      attemptNumber: null,
    });
  });
});
