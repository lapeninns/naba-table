import { describe, expect, it } from 'vitest';

import { findMatchingReservation } from '@features/reservations/wizard/utils/timeoutRecovery';
import { getTimeoutContactGuidance } from '@features/reservations/wizard/hooks/useReservationWizard';

import type { Reservation } from '@entities/reservation/reservation.schema';
import type { ReservationDraft } from '@features/reservations/wizard/model/reducer';

function makeReservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    restaurantId: '22222222-2222-4222-8222-222222222222',
    restaurantName: 'Test Restaurant',
    restaurantSlug: 'test-restaurant',
    restaurantTimezone: 'Europe/London',
    bookingDate: '2026-04-01',
    startTime: '19:00',
    endTime: '20:30',
    startAt: '2026-04-01T18:00:00Z',
    endAt: '2026-04-01T19:30:00Z',
    partySize: 2,
    bookingType: 'dinner',
    status: 'confirmed',
    customerName: 'Guest Booker',
    customerEmail: 'guest@example.com',
    customerPhone: '+447950272147',
    marketingOptIn: false,
    notes: null,
    reference: 'ABC123',
    clientRequestId: null,
    idempotencyKey: null,
    pendingRef: null,
    metadata: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeDraft(overrides: Partial<ReservationDraft> = {}): ReservationDraft {
  return {
    restaurantId: '22222222-2222-4222-8222-222222222222',
    restaurantSlug: 'test-restaurant',
    date: '2026-04-01',
    time: '19:00',
    party: 2,
    bookingType: 'dinner',
    notes: null,
    name: 'Guest Booker',
    email: 'guest@example.com',
    phone: '07950 272147',
    marketingOptIn: false,
    ...overrides,
  };
}

describe('timeoutRecovery phone matching', () => {
  it('matches equivalent UK phone formats during timeout recovery', () => {
    const booking = makeReservation();
    const draft = makeDraft();

    expect(findMatchingReservation([booking], draft)).toEqual(booking);
  });
});

describe('timeout recovery guidance', () => {
  it('directs phone-only guests to their confirmation messages @contract', () => {
    expect(getTimeoutContactGuidance({ email: '' })).toEqual({
      error:
        'We could not confirm the booking in time. Please check your phone for a confirmation before trying again.',
      alert: 'If you received a confirmation message you are all set—otherwise retry now.',
    });
  });

  it('retains email guidance when an email address is available @contract', () => {
    expect(getTimeoutContactGuidance({ email: 'guest@example.com' }).error).toContain(
      'check your email',
    );
  });
});
