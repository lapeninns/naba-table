import { describe, expect, it, vi } from 'vitest';

import { deriveBookingState } from '@/components/features/guest/dashboard/booking-derivations';

import type { BookingDTO } from '@/hooks/useBookings';

function createBooking(overrides: Partial<BookingDTO> = {}): BookingDTO {
  return {
    id: overrides.id ?? 'booking-1',
    restaurantName: overrides.restaurantName ?? 'White Horse',
    restaurantSlug: overrides.restaurantSlug ?? 'white-horse',
    restaurantTimezone: overrides.restaurantTimezone ?? 'Europe/London',
    partySize: overrides.partySize ?? 2,
    startIso: overrides.startIso ?? '2026-07-01T19:30',
    endIso: overrides.endIso ?? '2026-07-01T21:00',
    status: overrides.status ?? 'confirmed',
    notes: overrides.notes ?? null,
    ...overrides,
  };
}

describe('deriveBookingState', () => {
  it('classifies venue-local timestamps consistently for next booking selection', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-01T17:00:00.000Z'));

    const state = deriveBookingState([
      createBooking({ id: 'later', startIso: '2026-07-01T20:30', endIso: '2026-07-01T22:00' }),
      createBooking({ id: 'next', startIso: '2026-07-01T19:30', endIso: '2026-07-01T21:00' }),
    ]);

    expect(state.nextBooking?.id).toBe('next');
    expect(state.liveBooking).toBeNull();

    vi.useRealTimers();
  });
});
