import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildBookingCreatedSideEffectsPayload,
  dispatchBookingCreatedSideEffects,
} from '@/server/bookings/created-side-effects-payload';

import type { BookingRecord } from '@/server/bookings';
import type { BookingCreatedSideEffectsClient } from '@/server/bookings/created-side-effects-payload';

const booking = {
  id: 'booking-1',
  restaurant_id: 'restaurant-1',
  customer_id: 'customer-1',
  booking_date: '2026-05-23',
  start_time: '18:30',
  end_time: '20:00',
  booking_type: 'dinner',
  seating_preference: 'any',
  status: 'pending',
  party_size: 4,
  customer_name: 'Ada Lovelace',
  customer_email: 'ada@example.com',
  customer_phone: '07123456789',
  notes: null,
  source: 'api',
  loyalty_points_awarded: 0,
  created_at: '2026-05-23T11:00:00.000Z',
  updated_at: '2026-05-23T11:01:00.000Z',
  reference: 'REF123',
  client_request_id: 'request-1',
  idempotency_key: 'idem-1',
  pending_ref: null,
} as BookingRecord;

const sideEffectsClient = {} as BookingCreatedSideEffectsClient;

describe('buildBookingCreatedSideEffectsPayload', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('builds public booking side-effect payloads with email provided', () => {
    expect(
      buildBookingCreatedSideEffectsPayload({
        booking,
        idempotencyKey: 'idem-1',
        restaurantId: 'restaurant-1',
        isOpsWalkIn: false,
        opsEmailProvidedHeader: false,
      }),
    ).toEqual({
      booking: {
        ...booking,
      },
      idempotencyKey: 'idem-1',
      restaurantId: 'restaurant-1',
      emailProvided: true,
    });
  });

  it('uses the ops walk-in email-provided header for ops bookings', () => {
    expect(
      buildBookingCreatedSideEffectsPayload({
        booking,
        idempotencyKey: null,
        restaurantId: 'restaurant-1',
        isOpsWalkIn: true,
        opsEmailProvidedHeader: false,
      }),
    ).toMatchObject({
      idempotencyKey: null,
      restaurantId: 'restaurant-1',
      emailProvided: false,
    });

    expect(
      buildBookingCreatedSideEffectsPayload({
        booking,
        idempotencyKey: null,
        restaurantId: 'restaurant-1',
        isOpsWalkIn: true,
        opsEmailProvidedHeader: true,
      }).emailProvided,
    ).toBe(true);
  });

  it('validates booking payloads through the side-effect payload schema', () => {
    const invalidBooking = {
      ...booking,
      party_size: '4',
    } as unknown as BookingRecord;

    expect(() =>
      buildBookingCreatedSideEffectsPayload({
        booking: invalidBooking,
        idempotencyKey: null,
        restaurantId: 'restaurant-1',
        isOpsWalkIn: false,
        opsEmailProvidedHeader: false,
      }),
    ).toThrow();
  });

  it('dispatches created booking side effects with the built payload and client', async () => {
    const dispatcher = vi.fn(async () => ({ queued: true }));

    await dispatchBookingCreatedSideEffects({
      booking,
      client: sideEffectsClient,
      dispatcher,
      idempotencyKey: 'idem-1',
      isOpsWalkIn: false,
      opsEmailProvidedHeader: false,
      restaurantId: 'restaurant-1',
    });

    expect(dispatcher).toHaveBeenCalledWith(
      {
        booking: { ...booking },
        idempotencyKey: 'idem-1',
        restaurantId: 'restaurant-1',
        emailProvided: true,
      },
      { supabase: sideEffectsClient },
    );
  });

  it('marks an idempotent replay so only idempotent effects are re-ensured', async () => {
    const dispatcher = vi.fn(async () => ({ queued: true }));

    await dispatchBookingCreatedSideEffects({
      booking,
      client: sideEffectsClient,
      dispatcher,
      idempotencyKey: 'idem-1',
      isOpsWalkIn: false,
      opsEmailProvidedHeader: false,
      replay: true,
      restaurantId: 'restaurant-1',
    });

    expect(dispatcher).toHaveBeenCalledWith(
      {
        booking: { ...booking },
        idempotencyKey: 'idem-1',
        restaurantId: 'restaurant-1',
        emailProvided: true,
        replay: true,
      },
      { supabase: sideEffectsClient },
    );
  });

  it('retries transient side-effect dispatch failures with the route policy', async () => {
    vi.useFakeTimers();
    const dispatcher = vi
      .fn<() => Promise<{ queued: boolean }>>()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValue({ queued: true });
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    const result = dispatchBookingCreatedSideEffects({
      booking,
      client: sideEffectsClient,
      dispatcher,
      idempotencyKey: null,
      isOpsWalkIn: true,
      opsEmailProvidedHeader: true,
      restaurantId: 'restaurant-1',
    });

    await vi.advanceTimersByTimeAsync(200);
    await expect(result).resolves.toBeUndefined();

    expect(dispatcher).toHaveBeenCalledTimes(2);
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 200);
  });

  it('propagates final side-effect dispatch failures so the route can log them', async () => {
    vi.useFakeTimers();
    const finalError = new Error('side effects unavailable');
    const dispatcher = vi.fn<() => Promise<never>>().mockRejectedValue(finalError);

    const result = dispatchBookingCreatedSideEffects({
      booking,
      client: sideEffectsClient,
      dispatcher,
      idempotencyKey: null,
      isOpsWalkIn: false,
      opsEmailProvidedHeader: false,
      restaurantId: 'restaurant-1',
    });
    const assertion = expect(result).rejects.toThrow(finalError);

    await vi.advanceTimersByTimeAsync(200);
    await vi.advanceTimersByTimeAsync(400);

    await assertion;
    expect(dispatcher).toHaveBeenCalledTimes(3);
  });
});
