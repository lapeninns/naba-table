import { describe, expect, it, vi } from 'vitest';

import {
  buildBookingCreateHttpResponse,
  type BookingCreateConfirmationTokenResolver,
  type BookingCreateRecoveryCookieBuilder,
} from '@/server/bookings/create-response';

import type { BookingRecord } from '@/server/bookings';

const booking = {
  id: 'booking-1',
  restaurant_id: '550e8400-e29b-41d4-a716-446655440000',
  booking_date: '2026-05-23',
  start_time: '18:30',
  end_time: '20:00',
  start_at: '2026-05-23T17:30:00.000Z',
  end_at: '2026-05-23T19:00:00.000Z',
  reference: 'REF123',
  party_size: 4,
  booking_type: 'dinner',
  seating_preference: 'any',
  status: 'pending',
  customer_name: 'Ada Lovelace',
  customer_email: 'ada@example.com',
  customer_phone: '07123456789',
  notes: null,
  client_request_id: 'request-1',
  created_at: '2026-05-23T11:00:00.000Z',
  updated_at: '2026-05-23T11:01:00.000Z',
} as BookingRecord;

function readSetCookie(response: Response): string {
  const headers = response.headers as Headers & {
    getSetCookie?: () => string[];
  };
  const cookies = headers.getSetCookie?.();

  if (cookies?.length) {
    return cookies.join('\n');
  }

  return response.headers.get('set-cookie') ?? '';
}

describe('buildBookingCreateHttpResponse', () => {
  it('builds the success response and attaches confirmation and recovery cookies', async () => {
    const confirmationTokenResolver = vi.fn(async () => 'confirmation-token-1');

    const response = await buildBookingCreateHttpResponse({
      booking,
      confirmationTokenResolver,
      loyaltyPointsAwarded: 0,
      recoverySecret: 'recovery-secret',
      recoveryTtlSeconds: 1800,
      restaurantId: booking.restaurant_id,
      reusedExisting: false,
      useUnifiedValidation: true,
    });

    await expect(response.json()).resolves.toMatchObject({
      booking: { id: 'booking-1' },
      duplicate: false,
      clientRequestId: 'request-1',
    });
    expect(response.status).toBe(201);
    expect(response.headers.get('X-Booking-Validation')).toBe('unified');
    expect(confirmationTokenResolver).toHaveBeenCalledWith({ booking, reusedExisting: false });

    const setCookie = readSetCookie(response);
    expect(setCookie).toContain('sr_confirm=confirmation-token-1');
    expect(setCookie).toContain('sr_access=');
    expect(setCookie).toContain('Max-Age=1800');
  });

  it('uses duplicate response semantics for reused bookings', async () => {
    const confirmationTokenResolver = vi.fn(async () => 'confirmation-token-1');

    const response = await buildBookingCreateHttpResponse({
      booking,
      confirmationTokenResolver,
      loyaltyPointsAwarded: 0,
      recoverySecret: null,
      recoveryTtlSeconds: null,
      restaurantId: booking.restaurant_id,
      reusedExisting: true,
      useUnifiedValidation: false,
    });

    await expect(response.json()).resolves.toMatchObject({
      duplicate: true,
      clientRequestId: 'request-1',
    });
    expect(response.status).toBe(200);
    expect(confirmationTokenResolver).toHaveBeenCalledWith({ booking, reusedExisting: true });
  });

  it('keeps booking success non-fatal when confirmation token resolution fails', async () => {
    const tokenError = new Error('token failed');
    const onTokenError = vi.fn();
    const confirmationTokenResolver = vi.fn(async () => {
      throw tokenError;
    }) as BookingCreateConfirmationTokenResolver;

    const response = await buildBookingCreateHttpResponse({
      booking,
      confirmationTokenResolver,
      loyaltyPointsAwarded: 0,
      onTokenError,
      recoverySecret: null,
      recoveryTtlSeconds: null,
      restaurantId: booking.restaurant_id,
      reusedExisting: false,
      useUnifiedValidation: false,
    });

    await expect(response.json()).resolves.toMatchObject({ booking: { id: 'booking-1' } });
    expect(response.status).toBe(201);
    expect(onTokenError).toHaveBeenCalledWith(tokenError);
    expect(readSetCookie(response)).not.toContain('sr_confirm=');
  });

  it('does not attach a recovery cookie when recovery token secret is absent', async () => {
    const response = await buildBookingCreateHttpResponse({
      booking,
      confirmationTokenResolver: vi.fn(async () => 'confirmation-token-1'),
      loyaltyPointsAwarded: 0,
      recoverySecret: '',
      recoveryTtlSeconds: 900,
      restaurantId: booking.restaurant_id,
      reusedExisting: false,
      useUnifiedValidation: false,
    });

    const setCookie = readSetCookie(response);
    expect(setCookie).toContain('sr_confirm=confirmation-token-1');
    expect(setCookie).not.toContain('sr_access=');
  });

  it('keeps booking success non-fatal when recovery cookie construction fails', async () => {
    const recoveryError = new Error('recovery failed');
    const onRecoveryCookieError = vi.fn();
    const recoveryCookieBuilder = vi.fn(() => {
      throw recoveryError;
    }) as BookingCreateRecoveryCookieBuilder;

    const response = await buildBookingCreateHttpResponse({
      booking,
      confirmationTokenResolver: vi.fn(async () => 'confirmation-token-1'),
      loyaltyPointsAwarded: 0,
      onRecoveryCookieError,
      recoveryCookieBuilder,
      recoverySecret: 'recovery-secret',
      recoveryTtlSeconds: 900,
      restaurantId: booking.restaurant_id,
      reusedExisting: false,
      useUnifiedValidation: false,
    });

    await expect(response.json()).resolves.toMatchObject({ booking: { id: 'booking-1' } });
    expect(response.status).toBe(201);
    expect(onRecoveryCookieError).toHaveBeenCalledWith(recoveryError);
    expect(readSetCookie(response)).toContain('sr_confirm=confirmation-token-1');
  });

  it('returns the same body and status for a key replay as for the original insert', async () => {
    const build = (createOrigin: 'inserted' | 'key_replay') =>
      buildBookingCreateHttpResponse({
        booking,
        confirmationTokenResolver: vi.fn(async () => null),
        createOrigin,
        creatorCapabilityEligible: true,
        loyaltyPointsAwarded: 0,
        recoverySecret: null,
        recoveryTtlSeconds: null,
        restaurantId: booking.restaurant_id,
        reusedExisting: createOrigin !== 'inserted',
        useUnifiedValidation: true,
      });

    const original = await build('inserted');
    const replay = await build('key_replay');

    expect(replay.status).toBe(original.status);
    expect(replay.status).toBe(201);
    await expect(replay.json()).resolves.toEqual(await original.json());
  });

  it('keeps duplicate semantics for recovered (non-creator) matches', async () => {
    const response = await buildBookingCreateHttpResponse({
      booking,
      confirmationTokenResolver: vi.fn(async () => null),
      createOrigin: 'recovered',
      creatorCapabilityEligible: false,
      loyaltyPointsAwarded: 0,
      recoverySecret: null,
      recoveryTtlSeconds: null,
      restaurantId: booking.restaurant_id,
      reusedExisting: true,
      useUnifiedValidation: false,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ duplicate: true });
  });
});
