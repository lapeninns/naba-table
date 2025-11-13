import { describe, expect, it, vi } from 'vitest';

import { findMatchingReservation, recoverBookingAfterTimeout } from '../timeoutRecovery';

import type { ReservationDraft } from '../../model/reducer';
import type { Reservation } from '@entities/reservation/reservation.schema';

const BASE_DRAFT: ReservationDraft = {
  restaurantId: '11111111-1111-4111-8111-111111111111',
  date: '2025-11-12',
  time: '19:00',
  party: 2,
  bookingType: 'dinner',
  seating: 'inside',
  notes: null,
  name: 'Guest Example',
  email: 'guest@example.com',
  phone: '+1 (555) 101-2020',
  marketingOptIn: false,
};

const NOW_ISO = new Date().toISOString();

const BASE_RESERVATION: Reservation = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  restaurantId: BASE_DRAFT.restaurantId,
  restaurantName: 'Demo',
  bookingDate: BASE_DRAFT.date,
  startTime: BASE_DRAFT.time,
  endTime: '20:30',
  startAt: '2025-11-12T19:00:00.000Z',
  endAt: '2025-11-12T20:30:00.000Z',
  partySize: BASE_DRAFT.party,
  bookingType: 'dinner',
  seatingPreference: 'inside',
  status: 'pending',
  customerName: BASE_DRAFT.name,
  customerEmail: BASE_DRAFT.email!,
  customerPhone: BASE_DRAFT.phone!,
  marketingOptIn: false,
  notes: null,
  reference: 'REF123',
  clientRequestId: null,
  idempotencyKey: null,
  pendingRef: null,
  metadata: null,
  createdAt: NOW_ISO,
  updatedAt: NOW_ISO,
};

describe('recoverBookingAfterTimeout', () => {
  it('returns match when first lookup succeeds', async () => {
    const fetcher = vi.fn().mockResolvedValue([BASE_RESERVATION]);
    const result = await recoverBookingAfterTimeout({
      draft: BASE_DRAFT,
      fetchBookings: fetcher,
      attempts: 1,
      delayMs: 0,
    });

    expect(result?.booking.id).toEqual(BASE_RESERVATION.id);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('retries until a later lookup matches', async () => {
    const mismatch = { ...BASE_RESERVATION, startTime: '20:00' } satisfies Reservation;
    const match = {
      ...BASE_RESERVATION,
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    } satisfies Reservation;
    const fetcher = vi.fn().mockResolvedValueOnce([mismatch]).mockResolvedValueOnce([match]);

    const result = await recoverBookingAfterTimeout({
      draft: BASE_DRAFT,
      fetchBookings: fetcher,
      attempts: 3,
      delayMs: 0,
    });

    expect(result?.booking.id).toEqual(match.id);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('returns null when contact info is missing', async () => {
    const fetcher = vi.fn();
    const result = await recoverBookingAfterTimeout({
      draft: { ...BASE_DRAFT, email: null },
      fetchBookings: fetcher,
    });

    expect(result).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('findMatchingReservation', () => {
  it('matches by restaurant/date/time/party/email/phone', () => {
    const match = findMatchingReservation([BASE_RESERVATION], BASE_DRAFT);
    expect(match?.id).toEqual(BASE_RESERVATION.id);
  });

  it('ignores cancelled or stale reservations', () => {
    const cancelled = { ...BASE_RESERVATION, status: 'cancelled' };
    const stale = {
      ...BASE_RESERVATION,
      createdAt: '2024-01-01T00:00:00.000Z',
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    } satisfies Reservation;

    const match = findMatchingReservation([cancelled, stale], BASE_DRAFT);
    expect(match).toBeNull();
  });

  it('normalizes phones before comparing', () => {
    const booking = {
      ...BASE_RESERVATION,
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      customerPhone: '555.101.2020',
      createdAt: NOW_ISO,
      updatedAt: NOW_ISO,
    } satisfies Reservation;
    const draft = { ...BASE_DRAFT, phone: '5551012020' } satisfies ReservationDraft;

    const match = findMatchingReservation([booking], draft);
    expect(match?.id).toEqual(booking.id);
  });
});
