import { describe, expect, it } from 'vitest';

import { HttpError } from '@/lib/http/errors';
import {
  CREATE_CONFLICT_MAX_RETRY_DELAY_MS,
  getRetryableConflictDelayMs,
  reservationDraftFingerprint,
} from '@features/reservations/wizard/api/createReservationRetry';

import type { ReservationDraft } from '@features/reservations/wizard/model/reducer';

const draft: ReservationDraft = {
  restaurantId: 'rest-1',
  restaurantSlug: 'the-fox',
  date: '2026-02-10',
  time: '19:00',
  party: 2,
  bookingType: 'dinner',
  notes: null,
  name: 'Guest Booker',
  email: 'guest@example.com',
  phone: '+441234567890',
  marketingOptIn: false,
  whatsappOptIn: false,
};

describe('getRetryableConflictDelayMs', () => {
  it('retries a retryable BOOKING_CONFLICT from the reserve api client after retryAfter', () => {
    expect(
      getRetryableConflictDelayMs({
        code: 'BOOKING_CONFLICT',
        message: 'This time slot was just booked. Please try again.',
        status: 409,
        body: { code: 'BOOKING_CONFLICT', retryable: true, retryAfter: 2 },
      }),
    ).toBe(2000);
  });

  it('reads retryable/retryAfter from an HttpError (fetchJson)', () => {
    expect(
      getRetryableConflictDelayMs(
        new HttpError({
          message: 'This time slot was just booked. Please try again.',
          status: 409,
          code: 'BOOKING_CONFLICT',
          retryable: true,
          retryAfter: 1,
        }),
      ),
    ).toBe(1000);
  });

  it('caps the delay and defaults a missing retryAfter to one second', () => {
    expect(
      getRetryableConflictDelayMs({ status: 409, code: 'BOOKING_CONFLICT', body: { retryable: true, retryAfter: 600 } }),
    ).toBe(CREATE_CONFLICT_MAX_RETRY_DELAY_MS);
    expect(
      getRetryableConflictDelayMs({ status: 409, code: 'BOOKING_CONFLICT', body: { retryable: true } }),
    ).toBe(1000);
  });

  it('does not retry terminal conflicts', () => {
    expect(
      getRetryableConflictDelayMs({ status: 409, code: 'BOOKING_CONFLICT', body: { retryable: false } }),
    ).toBeNull();
    expect(
      getRetryableConflictDelayMs({ status: 409, code: 'IDEMPOTENCY_KEY_REUSED', body: { retryable: false } }),
    ).toBeNull();
    expect(getRetryableConflictDelayMs({ status: 409, code: 'CAPACITY_EXCEEDED' })).toBeNull();
    expect(getRetryableConflictDelayMs({ status: 500, code: 'BOOKING_CONFLICT', body: { retryable: true } })).toBeNull();
    expect(getRetryableConflictDelayMs(new TypeError('Failed to fetch'))).toBeNull();
  });
});

describe('reservationDraftFingerprint', () => {
  it('is stable for the same draft and changes when the booking intent changes', () => {
    expect(reservationDraftFingerprint(draft)).toBe(reservationDraftFingerprint({ ...draft }));
    expect(reservationDraftFingerprint({ ...draft, party: 3 })).not.toBe(reservationDraftFingerprint(draft));
    expect(reservationDraftFingerprint({ ...draft, time: '19:30' })).not.toBe(
      reservationDraftFingerprint(draft),
    );
    expect(reservationDraftFingerprint(draft, 'booking-1')).not.toBe(reservationDraftFingerprint(draft));
  });
});
