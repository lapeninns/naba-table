import { describe, expect, it } from 'vitest';

import {
  buildBookingDto,
  buildRebookPath,
  buildReservationDisplay,
  buildReservationSharePayload,
  buildReservationVenue,
  calendarStatusFromReservation,
  feedbackTone,
  isPastReservation,
  resolvePastGraceMs,
  resolvePendingLockState,
  resolveReservationStatusConfig,
  shouldDisableReservationActions,
} from '@/components/features/booking/detail/reservationDetailDomain';

import type { Reservation } from '@entities/reservation/reservation.schema';

const baseReservation = {
  id: '11111111-1111-4111-8111-111111111111',
  restaurantId: '22222222-2222-4222-8222-222222222222',
  restaurantName: 'The Fox',
  restaurantSlug: 'the-fox',
  restaurantTimezone: 'Europe/London',
  bookingDate: '2026-07-01',
  startTime: '18:30:00',
  endTime: '20:00:00',
  startAt: '2026-07-01T18:30:00.000Z',
  endAt: '2026-07-01T20:00:00.000Z',
  partySize: 2,
  bookingType: 'dinner',
  status: 'confirmed',
  customerName: 'Guest Booker',
  customerEmail: 'guest@example.com',
  customerPhone: '+441234567890',
  marketingOptIn: false,
  notes: 'Window please',
  reference: 'NB1234',
  clientRequestId: null,
  idempotencyKey: null,
  pendingRef: null,
  metadata: null,
  createdAt: '2026-04-01T10:00:00.000Z',
  updatedAt: '2026-04-01T10:00:00.000Z',
} satisfies Reservation;

describe('reservationDetailDomain', () => {
  it('builds venue fallback data from the reservation when no venue is provided', () => {
    expect(
      buildReservationVenue({
        reservation: baseReservation,
        restaurantName: null,
      }),
    ).toEqual({
      name: 'The Fox',
      address: expect.any(String),
      timezone: 'Europe/London',
      slug: 'the-fox',
    });
  });

  it('formats reservation display values and falls back for missing dates', () => {
    expect(buildReservationDisplay(baseReservation.startAt, 'Europe/London')).toEqual({
      shortDate: expect.stringContaining('Jul'),
      fullDate: expect.stringContaining('2026'),
      time: expect.stringContaining('19:30'),
    });

    expect(buildReservationDisplay(null, 'Europe/London')).toEqual({
      shortDate: '—',
      fullDate: '—',
      time: '—',
    });
  });

  it('builds edit dialog and share payloads without UI dependencies', () => {
    const venue = buildReservationVenue({
      reservation: baseReservation,
      restaurantName: null,
    });

    expect(buildBookingDto(baseReservation, null, venue)).toMatchObject({
      id: baseReservation.id,
      restaurantId: baseReservation.restaurantId,
      restaurantName: 'Reservation',
      restaurantSlug: 'the-fox',
      restaurantTimezone: 'Europe/London',
      partySize: 2,
      status: 'confirmed',
      notes: 'Window please',
    });

    expect(
      buildReservationSharePayload({
        reservation: baseReservation,
        reservationId: baseReservation.id,
        venue,
        manageUrl: 'https://example.com/bookings/111',
      }),
    ).toMatchObject({
      reservationId: baseReservation.id,
      reference: 'NB1234',
      guestName: 'Guest Booker',
      guestEmail: 'guest@example.com',
      partySize: 2,
      status: 'confirmed',
      manageUrl: 'https://example.com/bookings/111',
    });
  });

  it('resolves action, lock, route, feedback, and status domain decisions', () => {
    const pendingReservation: Reservation = {
      ...baseReservation,
      status: 'pending',
      createdAt: '2026-04-01T10:00:00.000Z',
    };

    expect(
      resolvePendingLockState({
        reservation: pendingReservation,
        clockNow: Date.parse('2026-04-01T10:11:00.000Z'),
      }),
    ).toEqual({
      locked: true,
      lockTimestamp: Date.parse('2026-04-01T10:10:00.000Z'),
    });
    expect(
      isPastReservation({
        reservation: baseReservation,
        venueTimezone: 'Europe/London',
        clockNow: Date.parse('2026-07-01T18:40:00.000Z'),
        pastGraceMs: 5 * 60_000,
      }),
    ).toBe(true);
    expect(resolvePastGraceMs('abc')).toBe(5 * 60_000);
    expect(resolvePastGraceMs('2')).toBe(2 * 60_000);
    expect(
      shouldDisableReservationActions({
        reservation: baseReservation,
        pendingLocked: false,
        isPastReservation: false,
        canManage: false,
      }),
    ).toBe(true);
    expect(buildRebookPath({ reservation: baseReservation, venueSlug: null })).toBe(
      `/restaurants/the-fox/book?source=rebook&reservationId=${baseReservation.id}`,
    );
    expect(calendarStatusFromReservation('pending_allocation')).toBe('pending');
    expect(feedbackTone('error')).toBe('danger');
    expect(resolveReservationStatusConfig('checked_in')).toEqual({
      label: 'Checked In',
      tone: 'info',
      iconKey: 'checkedIn',
    });
  });
});
