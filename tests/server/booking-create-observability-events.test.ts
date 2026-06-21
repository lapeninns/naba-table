import { describe, expect, it } from 'vitest';

import {
  buildBookingCapacityPrecheckFailedObservabilityEvent,
  buildBookingCreateInsertFallbackObservabilityEvent,
  buildBookingCreateRateLimitedObservabilityEvent,
  buildBookingCreateRecoveredObservabilityEvent,
  buildBookingPastTimeBlockedObservabilityEvent,
} from '@/server/bookings/create-observability-events';

describe('booking create observability events', () => {
  it('builds the capacity-precheck failed event with existing context keys', () => {
    expect(
      buildBookingCapacityPrecheckFailedObservabilityEvent({
        source: 'api.bookings',
        restaurantId: 'restaurant-1',
        date: '2026-07-01',
        time: '19:00',
        partySize: 4,
        error: 'Capacity service unavailable',
      }),
    ).toEqual({
      source: 'api.bookings',
      eventType: 'booking.capacity_precheck.failed',
      severity: 'warning',
      context: {
        restaurantId: 'restaurant-1',
        date: '2026-07-01',
        time: '19:00',
        partySize: 4,
        error: 'Capacity service unavailable',
      },
    });
  });

  it('builds the create rate-limited event with existing context keys', () => {
    expect(
      buildBookingCreateRateLimitedObservabilityEvent({
        source: 'api.bookings',
        restaurantId: 'restaurant-1',
        ipScope: '127.0.0.0/24',
        resetAt: 1_779_541_200_000,
        limit: 60,
        windowMs: 60_000,
        rateSource: 'memory',
      }),
    ).toEqual({
      source: 'api.bookings',
      eventType: 'booking_creation.rate_limited',
      severity: 'warning',
      context: {
        restaurant_id: 'restaurant-1',
        ip_scope: '127.0.0.0/24',
        reset_at: '2026-05-23T13:00:00.000Z',
        limit: 60,
        window_ms: 60_000,
        rate_source: 'memory',
      },
    });
  });

  it('builds the past-time blocked event with validation details', () => {
    expect(
      buildBookingPastTimeBlockedObservabilityEvent({
        source: 'api.bookings',
        restaurantId: 'restaurant-1',
        ipScope: '127.0.0.0/24',
        details: {
          bookingTime: '2026-05-23T12:00:00 GMT+1',
          serverTime: '2026-05-23T13:00:00 GMT+1',
          timezone: 'Europe/London',
          gracePeriodMinutes: 5,
          timeDeltaMinutes: -60,
        },
      }),
    ).toEqual({
      source: 'api.bookings',
      eventType: 'booking.past_time.blocked',
      severity: 'warning',
      context: {
        restaurantId: 'restaurant-1',
        endpoint: 'bookings.create',
        actorRole: null,
        ipScope: '127.0.0.0/24',
        bookingTime: '2026-05-23T12:00:00 GMT+1',
        serverTime: '2026-05-23T13:00:00 GMT+1',
        timezone: 'Europe/London',
        gracePeriodMinutes: 5,
        timeDeltaMinutes: -60,
      },
    });
  });

  it('builds the recovered event with idempotency-key recovery method', () => {
    expect(
      buildBookingCreateRecoveredObservabilityEvent({
        source: 'api.bookings',
        restaurantId: 'restaurant-1',
        idempotencyKey: 'idem-1',
      }),
    ).toEqual({
      source: 'api.bookings',
      eventType: 'booking.create.recovered',
      severity: 'warning',
      context: {
        restaurantId: 'restaurant-1',
        idempotencyKey: 'idem-1',
        method: 'idempotency_key',
      },
    });
  });

  it('builds the recovered event with signature recovery method when no idempotency key exists', () => {
    expect(
      buildBookingCreateRecoveredObservabilityEvent({
        source: 'api.bookings',
        restaurantId: 'restaurant-1',
        idempotencyKey: null,
      }),
    ).toEqual({
      source: 'api.bookings',
      eventType: 'booking.create.recovered',
      severity: 'warning',
      context: {
        restaurantId: 'restaurant-1',
        idempotencyKey: undefined,
        method: 'signature',
      },
    });
  });

  it('builds the insert-fallback event with existing context shape', () => {
    expect(
      buildBookingCreateInsertFallbackObservabilityEvent({
        source: 'api.bookings',
        restaurantId: 'restaurant-1',
        idempotencyKey: 'idem-1',
      }),
    ).toEqual({
      source: 'api.bookings',
      eventType: 'booking.create.insert_fallback',
      severity: 'warning',
      context: {
        restaurantId: 'restaurant-1',
        idempotencyKey: 'idem-1',
      },
    });
  });

  it('keeps absent insert-fallback idempotency keys undefined', () => {
    expect(
      buildBookingCreateInsertFallbackObservabilityEvent({
        source: 'api.bookings',
        restaurantId: 'restaurant-1',
        idempotencyKey: null,
      }).context,
    ).toEqual({
      restaurantId: 'restaurant-1',
      idempotencyKey: undefined,
    });
  });
});
