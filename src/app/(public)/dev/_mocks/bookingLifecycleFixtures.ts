import type { Reservation } from '@entities/reservation/reservation.schema';

export type BookingLifecycleFixtureKey = 'active' | 'pending' | 'cancelled';

type FixtureDefinition = {
  label: string;
  reservation: Reservation;
};

const baseReservation: Reservation = {
  id: '22222222-2222-4222-8222-222222222222',
  restaurantId: '11111111-1111-4111-8111-111111111111',
  restaurantName: 'The Fox',
  restaurantSlug: 'the-fox',
  restaurantTimezone: 'Europe/London',
  bookingDate: '2026-02-10',
  startTime: '19:00',
  partySize: 2,
  startAt: '2026-02-10T19:00:00.000Z',
  endAt: '2026-02-10T20:30:00.000Z',
  bookingType: 'dinner',
  seatingPreference: 'window',
  status: 'confirmed',
  customerName: 'Guest Booker',
  customerEmail: 'guest+active@example.com',
  customerPhone: '+441111111111',
  marketingOptIn: true,
  notes: 'Window table please',
  reference: 'NB1234',
  clientRequestId: '66666666-6666-4666-8666-666666666666',
  idempotencyKey: 'fixture-idempotency-key',
  pendingRef: null,
  metadata: null,
  createdAt: '2026-02-01T10:00:00.000Z',
};

const fixtures: Record<BookingLifecycleFixtureKey, FixtureDefinition> = {
  active: {
    label: 'Active booking detail + receipt',
    reservation: baseReservation,
  },
  pending: {
    label: 'Pending confirmation booking detail + receipt',
    reservation: {
      ...baseReservation,
      id: '44444444-4444-4444-8444-444444444444',
      customerEmail: 'guest+pending@example.com',
      customerPhone: '+442222222222',
      reference: 'NB9012',
      status: 'pending',
      bookingDate: '2026-02-12',
      startTime: '18:30',
      startAt: '2026-02-12T18:30:00.000Z',
      endAt: '2026-02-12T20:00:00.000Z',
    },
  },
  cancelled: {
    label: 'Cancelled booking detail + receipt',
    reservation: {
      ...baseReservation,
      id: '55555555-5555-4555-8555-555555555555',
      customerEmail: 'guest+cancelled@example.com',
      customerPhone: '+443333333333',
      reference: 'NB3456',
      status: 'cancelled',
      bookingDate: '2026-02-12',
      startTime: '18:30',
      startAt: '2026-02-12T18:30:00.000Z',
      endAt: '2026-02-12T20:00:00.000Z',
    },
  },
};

export function getBookingLifecycleFixture(
  key: string | null | undefined,
): FixtureDefinition | null {
  if (!key) return null;
  return fixtures[key as BookingLifecycleFixtureKey] ?? null;
}

export function getDefaultBookingLifecycleFixture(): FixtureDefinition {
  return fixtures.active;
}
