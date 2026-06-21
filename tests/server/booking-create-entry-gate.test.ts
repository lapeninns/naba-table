import { describe, expect, it, vi } from 'vitest';

import {
  runBookingCreateEntryGate,
  type BookingCreateEntryEventRecorder,
  type BookingCreateEntryRateLimiter,
  type BookingCreateEntryRequestContextBuilder,
  type BookingCreateEntryRestaurantResolver,
} from '@/server/bookings/create-entry-gate';

import type { BookingCreateRequest } from '@/server/bookings/request-validation';

const bookingRequest = {
  restaurantId: '11111111-1111-4111-8111-111111111111',
  date: '2026-07-01',
  time: '18:30',
  party: 4,
  bookingType: 'dinner',
  name: 'Alex Guest',
  email: 'alex@example.com',
  phone: '07123456789',
  marketingOptIn: false,
} as BookingCreateRequest;

const requestContext = {
  headerIdempotencyKey: 'idempotency-key-1',
  clientRequestId: 'client-request-1',
  opsEmailProvidedHeader: false,
  isOpsWalkIn: false,
  requestSource: 'api.bookings' as const,
  bookingSource: 'api' as const,
  bookingDetails: null,
};

const headers = new Headers({ 'Idempotency-Key': 'idempotency-key-1' });

describe('runBookingCreateEntryGate', () => {
  it('resolves restaurant context, builds request context, and allows non-limited requests', async () => {
    const restaurantResolver = vi.fn(async () => ({
      ok: true,
      restaurantId: bookingRequest.restaurantId,
      source: 'payload' as const,
    })) as BookingCreateEntryRestaurantResolver;
    const requestContextBuilder = vi.fn(
      () => requestContext,
    ) as BookingCreateEntryRequestContextBuilder;
    const rateLimiter = vi.fn(async () => ({
      ok: true,
      limit: 60,
      remaining: 59,
      resetAt: 1_779_541_200_000,
      source: 'memory' as const,
    })) as BookingCreateEntryRateLimiter;

    await expect(
      runBookingCreateEntryGate({
        clientIp: '192.0.2.10',
        headers,
        rateLimiter,
        request: bookingRequest,
        requestContextBuilder,
        restaurantResolver,
      }),
    ).resolves.toEqual({
      kind: 'continue',
      restaurantId: bookingRequest.restaurantId,
      requestContext,
    });

    expect(restaurantResolver).toHaveBeenCalledWith({
      restaurantId: bookingRequest.restaurantId,
      restaurantSlug: bookingRequest.restaurantSlug,
    });
    expect(requestContextBuilder).toHaveBeenCalledWith(headers);
    expect(rateLimiter).toHaveBeenCalledWith({
      identifier: `bookings:create:${bookingRequest.restaurantId}:192.0.2.10`,
      limit: 60,
      windowMs: 60_000,
    });
  });

  it('returns the existing restaurant resolution failure payload', async () => {
    const restaurantResolver = vi.fn(async () => ({
      ok: false,
      status: 404,
      code: 'RESTAURANT_NOT_FOUND',
      error: 'Restaurant not found',
    })) as BookingCreateEntryRestaurantResolver;
    const rateLimiter = vi.fn() as unknown as BookingCreateEntryRateLimiter;

    const result = await runBookingCreateEntryGate({
      clientIp: '192.0.2.10',
      headers,
      rateLimiter,
      request: bookingRequest,
      restaurantResolver,
    });

    expect(result.kind).toBe('response');
    if (result.kind !== 'response') {
      return;
    }

    await expect(result.response.json()).resolves.toEqual({
      error: 'Restaurant not found',
      code: 'RESTAURANT_NOT_FOUND',
    });
    expect(result.response.status).toBe(404);
    expect(rateLimiter).not.toHaveBeenCalled();
  });

  it('returns the existing rate-limit response and records rate-limit observability', async () => {
    const eventRecorder = vi.fn(async () => undefined) as BookingCreateEntryEventRecorder;
    const restaurantResolver = vi.fn(async () => ({
      ok: true,
      restaurantId: bookingRequest.restaurantId,
      source: 'payload' as const,
    })) as BookingCreateEntryRestaurantResolver;
    const requestContextBuilder = vi.fn(() => ({
      ...requestContext,
      requestSource: 'ops.walkin' as const,
      bookingSource: 'ops.walkin' as const,
    })) as BookingCreateEntryRequestContextBuilder;
    const rateLimiter = vi.fn(async () => ({
      ok: false,
      limit: 60,
      remaining: 0,
      resetAt: Date.now() + 30_000,
      source: 'memory' as const,
    })) as BookingCreateEntryRateLimiter;

    const result = await runBookingCreateEntryGate({
      clientIp: '192.0.2.10',
      eventRecorder,
      headers,
      rateLimiter,
      request: bookingRequest,
      requestContextBuilder,
      restaurantResolver,
    });

    expect(result.kind).toBe('response');
    if (result.kind !== 'response') {
      return;
    }

    await expect(result.response.json()).resolves.toMatchObject({
      error: 'Too many booking requests. Please try again in a moment.',
      code: 'RATE_LIMITED',
    });
    expect(result.response.status).toBe(429);
    expect(result.response.headers.get('Retry-After')).toBeTruthy();
    expect(result.response.headers.get('X-RateLimit-Limit')).toBe('60');
    expect(result.response.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(eventRecorder).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'ops.walkin',
        eventType: 'booking_creation.rate_limited',
        severity: 'warning',
        context: expect.objectContaining({
          restaurant_id: bookingRequest.restaurantId,
          rate_source: 'memory',
        }),
      }),
    );
  });
});
